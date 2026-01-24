const router = require("express").Router();
const crypto = require("crypto");
const db = require("../services/db");
const { sendMagicLink } = require("../services/mail");

if (!process.env.BASE_URL) {
  throw new Error("BASE_URL manquant");
}
if (!process.env.ADMIN_KEY) {
  throw new Error("ADMIN_KEY manquant");
}
const BASE_URL = process.env.BASE_URL;
const ADMIN_KEY = process.env.ADMIN_KEY;
const TOKEN_TTL_SECONDS = Number(process.env.TOKEN_TTL_SECONDS || "3600");

function nowSec() { return Math.floor(Date.now() / 1000); }
function randomToken() { return crypto.randomBytes(32).toString("hex"); }
function sha256Hex(s) { return crypto.createHash("sha256").update(s).digest("hex"); }

// Requêtes préparées (performance)
const q = {
  getUser: db.prepare("SELECT id, status, request_count, last_request_at, needs_link FROM users WHERE email=?"),
  getUserLogin: db.prepare("SELECT id, email, status, pseudo FROM users WHERE email=?"),
  insertUser: db.prepare("INSERT INTO users(email, status, request_count, last_request_at, needs_link) VALUES(?, 'pending', 1, ?, 0)"),
  updateRequest: db.prepare("UPDATE users SET request_count = request_count + 1, last_request_at = ? WHERE id=?"),
  updateStatus: db.prepare("UPDATE users SET status=? WHERE id=?"),
  setNeedsLink: db.prepare("UPDATE users SET needs_link = 1 WHERE id=?"),
  clearNeedsLink: db.prepare("UPDATE users SET needs_link = 0 WHERE id=?"),
  insertToken: db.prepare("INSERT INTO login_tokens(user_id, token_hash, expires_at) VALUES(?,?,?)"),
  getToken: db.prepare("SELECT id, expires_at, used_at FROM login_tokens WHERE user_id=? AND token_hash=?"),
  getValidTokenForUser: db.prepare("SELECT id FROM login_tokens WHERE user_id=? AND expires_at > ? AND used_at IS NULL LIMIT 1"),
  markUsed: db.prepare("UPDATE login_tokens SET used_at=? WHERE id=?"),
  cleanupTokens: db.prepare("DELETE FROM login_tokens WHERE expires_at < ? OR used_at IS NOT NULL")
};

const requireAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  // Comparaison timing-safe
  if (provided.length !== ADMIN_KEY.length || !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(ADMIN_KEY))) {
    return res.status(403).json({ error: "Admin refusé." });
  }
  next();
};

router.get("/health", (req, res) => {
  const user = req.session?.user || null;
  res.json({
    ok: true,
    hasSession: !!user,
    email: user?.email || null,
    pseudo: user?.pseudo || null,
  });
});

router.post("/request-access", (req, res) => {
  const e = (req.body?.email || "").trim().toLowerCase();
  if (!e || e.length > 254) return res.status(400).json({ error: "Email invalide." });

  const now = nowSec();
  const user = q.getUser.get(e);

  // Réponse neutre (évite de révéler le statut)
  const okMsg = "Demande reçue. Si ton accès est validé, tu recevras un lien dans la boite mail que tu as fourni.";

  if (user?.status === "banned") {
    // Tu peux aussi répondre neutre ici si tu veux être anti-enum totale
    return res.status(403).json({ error: "Accès refusé." });
  }

  // Rate-limit par email si user existe
  if (user?.last_request_at && user.last_request_at > now - 60) {
    return res.json({ ok: true, message: okMsg });
  }

  if (!user) {
    q.insertUser.run(e, now); // pending, needs_link=0
    return res.json({ ok: true, message: okMsg });
  }

  // Toujours tracer la demande
  q.updateRequest.run(now, user.id);

  // Si déjà approuvé => on marque "needs_link"
  if (user.status === "approved") {
    q.setNeedsLink.run(user.id);
  }

  return res.json({ ok: true, message: okMsg });
});

router.post("/send-link", requireAdmin, async (req, res) => {
  const e = (req.body?.email || "").trim().toLowerCase();
  const user = q.getUser.get(e);
  if (!user) return res.status(404).json({ error: "User introuvable." });
  if (user.status === "banned") return res.status(403).json({ error: "User banni." });
  if (user.status !== "approved") return res.status(403).json({ error: "User non approuvé." });
  if (user.needs_link !== 1) return res.status(400).json({ error: "L'utilisateur n'a pas demandé de lien." });

  const now = nowSec();
  const already = q.getValidTokenForUser.get(user.id, now);
  if (already) return res.status(429).json({ error: "Un lien est déjà actif (token non expiré)." });

  const token = randomToken();
  const expiresAt = now + TOKEN_TTL_SECONDS;
  q.insertToken.run(user.id, sha256Hex(token), expiresAt);
  q.clearNeedsLink.run(user.id);

  await sendMagicLink(e, `${BASE_URL}/play.html?email=${encodeURIComponent(e)}&token=${encodeURIComponent(token)}`);
  res.json({ ok: true, message: "Email envoyé.", expiresAt });
});


router.post("/login-with-token", (req, res) => {
  const e = (req.body?.email || "").trim().toLowerCase();
  const token = req.body?.token;
  if (!e || typeof token !== "string") return res.status(400).json({ error: "Paramètres manquants." });

  const user = q.getUserLogin.get(e);
  if (!user || user.status !== "approved") return res.status(403).json({ error: "Refusé." });

  const row = q.getToken.get(user.id, sha256Hex(token));
  if (!row) return res.status(403).json({ error: "Token invalide." });
  if (row.used_at) return res.status(403).json({ error: "Token déjà utilisé." });
  if (row.expires_at < nowSec()) return res.status(403).json({ error: "Token expiré." });

  q.markUsed.run(nowSec(), row.id);
  q.cleanupTokens.run(nowSec() - 3600);

  // Modifier la session - express-session créera automatiquement le cookie
  // Avec saveUninitialized: false, la session est créée quand on modifie req.session
  req.session.user = { id: user.id, email: user.email, pseudo: user.pseudo || null };

  // express-session définit automatiquement le cookie quand on modifie req.session
  // Le cookie sera défini juste avant l'envoi de la réponse par le middleware express-session
  console.log(`✅ Session créée pour: ${user.email} (session ID: ${req.sessionID})`);
  console.log(`   - Session modifiée: ${req.session ? 'Oui' : 'Non'}`);
  console.log(`   - User dans session: ${req.session.user ? req.session.user.email : 'Non'}`);

  // Envoyer la réponse - express-session définira le cookie Set-Cookie automatiquement
  res.json({ ok: true, message: "Connecté.", user: req.session.user, sessionId: req.sessionID });
});

module.exports = router;
