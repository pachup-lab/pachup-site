
const router = require("express").Router();
const { sendToFlipper } = require("../services/mqtt");
const scoring = require("../scoring");

/**
 * Middleware : vérifier que l'utilisateur est connecté
 */
function requireSession(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: "Non connecté" });
  }
  next();
}

router.get("/game/state", requireSession, (req, res) => {
  res.json({
    ok: true,
    isPlayer: true,
  });
});

router.post("/game/action", requireSession, (req, res) => {
  const action = req.body?.action;

  if (!["left", "right", "launch", "left_down", "left_up", "right_down", "right_up"].includes(action)) {
    return res.status(400).json({ error: "Action invalide" });
  }

  const payload = {
    action,
    by: req.session.user.email,
    ts: Date.now(),
  };

  sendToFlipper(payload);

  res.json({ ok: true });
});

router.get("/score", requireSession, (req, res) => {
  res.json({ score: scoring.getScore() });
});

module.exports = router;
