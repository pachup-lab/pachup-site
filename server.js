require("dotenv").config();

const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const http = require("http");
const { Server } = require("socket.io");

const authRoutes = require("./routes/auth.routes");
const playRoutes = require("./routes/play.routes");
const scoring = require("./scoring");

const app = express();

// important derrière nginx
app.set("trust proxy", 1);

const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "http://localhost:5173";

const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));

// CORS configuré pour accepter l'origine depuis l'environnement ou toutes les origines en dev
app.use(cors({
  origin: process.env.NODE_ENV === "production" ? ALLOWED_ORIGIN : true,
  credentials: true
}));

// Créer une instance de session middleware (réutilisée pour Express et Socket.IO)
const sessionMiddleware = session({
  name: "sid",
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // false en développement, true en production avec HTTPS
    maxAge: 3 * 60 * 60 * 1000
  }
});

app.use(sessionMiddleware);

// expose limiter to routes if you want (option)
app.use((req, res, next) => { req.authLimiter = authLimiter; next(); });

app.use("/api/admin", authRoutes);
app.use("/api", authRoutes);
app.use("/api", playRoutes);

// Créer le serveur HTTP (nécessaire pour Socket.IO)
const server = http.createServer(app);
// Créer Socket.IO avec configuration CORS
// IMPORTANT : Créer Socket.IO AVANT express.static pour que /socket.io/ fonctionne
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === "production" ? ALLOWED_ORIGIN : true,
    credentials: true,
    methods: ["GET", "POST"]
  }
});

// Servir les fichiers statiques (APRÈS Socket.IO pour ne pas intercepter /socket.io/)
app.use(express.static("../www"));

// Middleware pour parser la session dans Socket.IO
// IMPORTANT : Réutiliser le même middleware session que Express
io.use((socket, next) => {
  // Utiliser directement le middleware session Express
  // Il parse automatiquement les cookies depuis les headers et met la session dans socket.request.session
  sessionMiddleware(socket.request, {}, next);
});

// Gérer les connexions WebSocket
io.on("connection", (socket) => {
  // La session est maintenant disponible dans socket.request.session grâce au middleware
  const session = socket.request.session;

  // Debug : vérifier les cookies reçus
  const cookies = socket.request.headers.cookie;
  const cookieName = sessionMiddleware.name || "sid";
  const hasSessionCookie = cookies && cookies.includes(`${cookieName}=`);

  console.log(`🔍 Tentative de connexion WebSocket:`);
  console.log(`   - Cookies présents: ${cookies ? 'Oui' : 'Non'}`);
  console.log(`   - Cookie de session (${cookieName}) présent: ${hasSessionCookie ? 'Oui' : 'Non'}`);

  // Vérifier que l'utilisateur est authentifié
  if (!session?.user) {
    console.log("❌ Session WebSocket non trouvée ou utilisateur non authentifié - déconnexion");
    console.log(`   - session existe: ${!!session}`);
    console.log(`   - session.user existe: ${!!(session && session.user)}`);
    socket.disconnect();
    return;
  }

  console.log(`✅ WebSocket connecté: ${session.user.email} (socket ID: ${socket.id})`);
  console.log(`📊 Total clients connectés: ${io.sockets.sockets.size}`);

  // Envoyer le score actuel immédiatement
  socket.emit("score", { score: scoring.getScore() });

  // Gérer les actions de jeu via WebSocket (optionnel, plus rapide que HTTP)
  socket.on("game_action", (data) => {
    const action = data?.action;
    if (!["left", "right", "launch", "left_down", "left_up", "right_down", "right_up"].includes(action)) {
      socket.emit("error", { message: "Action invalide" });
      return;
    }

    // Utiliser le module MQTT existant
    const { sendToFlipper } = require("./services/mqtt");
    sendToFlipper({
      action,
      by: session.user.email,
      ts: Date.now()
    });

    socket.emit("action_ack", { ok: true });
  });

  // Quand le client se déconnecte
  socket.on("disconnect", (reason) => {
    console.log(`🔌 WebSocket déconnecté: ${session.user.email} (raison: ${reason})`);
    console.log(`📊 Total clients connectés: ${io.sockets.sockets.size}`);
  });
});

// Passer l'instance io à scoring.js pour qu'il puisse émettre les scores
scoring.setIO(io);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server on http://0.0.0.0:${PORT}`);
  console.log(`WebSocket ready on ws://0.0.0.0:${PORT}`);
});
