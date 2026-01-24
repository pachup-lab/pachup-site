const mqtt = require("mqtt");

const MQTT_URL = process.env.MQTT_URL || "mqtt://127.0.0.1:1883";
const MQTT_TOPIC = process.env.MQTT_TOPIC || "flipper/control";

const client = mqtt.connect(MQTT_URL, {
  reconnectPeriod: 2000,
  keepalive: 30,
});

client.on("connect", () => {
  console.log("🟢 MQTT connecté");
});

client.on("reconnect", () => {
  console.log("🟡 MQTT reconnexion...");
});

client.on("error", (err) => {
  console.error("🔴 MQTT erreur", err.message);
});

function sendToFlipper(payload) {
  client.publish(MQTT_TOPIC, JSON.stringify(payload), { qos: 0 });
}

module.exports = { sendToFlipper };

