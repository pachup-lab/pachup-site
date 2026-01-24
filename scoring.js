const mqtt = require("mqtt");

// 🔧 paramètres MQTT
const MQTT_BROKER = "mqtt://localhost"; // adapte si besoin
const TOPIC_SCORE = "flipper/score";
const TOPIC_CONTROL = "flipper/control";

// 🧠 état en mémoire
let scoreActuel = 0;

// 🔌 connexion MQTT
const client = mqtt.connect(MQTT_BROKER);

// 📡 Instance Socket.IO (sera définie depuis server.js)
let io = null;

client.on("connect", () => {
  console.log("✅ Scoring connecté à MQTT");
  client.subscribe([TOPIC_SCORE, TOPIC_CONTROL]);
});

client.on("message", (topic, message) => {
  const payload = message.toString().trim();
  // 🎯 Réception de points
  if (topic === TOPIC_SCORE) {
    const points = Number(payload);

    if (Number.isNaN(points)) {
      console.warn("⚠️ Payload score invalide :", payload);
      return;
    }

    scoreActuel += points;
    console.log(`🎯 +${points} pts → Score actuel : ${scoreActuel}`);

    // 📡 Émettre le nouveau score via WebSocket à tous les clients connectés
    if (io) {
      const clientsCount = io.sockets.sockets.size;
      console.log(`📡 Émission du score ${scoreActuel} vers ${clientsCount} client(s) connecté(s)`);
      io.emit("score", { score: scoreActuel });
    } else {
      console.warn("⚠️ Socket.IO non initialisé, impossible d'émettre le score");
    }
  }

  // 🔄 Reset de partie
  if (topic === TOPIC_CONTROL && payload === "start") {
    scoreActuel = 0;
    console.log("🔄 Nouvelle partie → Score remis à 0");

    // 📡 Émettre le reset via WebSocket
    if (io) {
      const clientsCount = io.sockets.sockets.size;
      console.log(`📡 Émission du reset (score: 0) vers ${clientsCount} client(s) connecté(s)`);
      io.emit("score", { score: 0 });
    } else {
      console.warn("⚠️ Socket.IO non initialisé, impossible d'émettre le reset");
    }
  }
});

// Export des fonctions
module.exports = {
      getScore: () => scoreActuel,
  setIO: (socketIO) => {
    io = socketIO;
    if (io) {
      console.log("📡 Socket.IO configuré pour scoring");
    } else {
      console.error("❌ Erreur: Socket.IO instance est null");
    }
  }
};

