pachup-site
Backend d'une plateforme web connectée à un flipper physique via ESP32.
Projet personnel en cours de développement — l'objectif est de piloter un flipper physique depuis une interface web et d'afficher les scores en temps réel.

🌐 Déployé sur pachup.com — accès non ouvert au public pour l'instant
⚙️ Serveur Linux (Debian) — Nginx reverse proxy, HTTPS, protection Cloudflare


Ce que fait ce projet

Contrôle physique du flipper depuis le navigateur : les touches du clavier envoient des commandes via WebSocket → MQTT → ESP32 → solénoïdes (batteur gauche, batteur droit, lanceur de balle)
Scores en temps réel : l'ESP32 publie les points sur MQTT, le serveur les reçoit et les broadcast instantanément à tous les clients connectés via Socket.IO
Authentification par magic link : système sans mot de passe — demande d'accès → validation manuelle → envoi d'un lien personnel tokenisé par email
Accès sur invitation : les utilisateurs sont approuvés manuellement via une API admin protégée


Architecture
Navigateur
   │  WebSocket (Socket.IO)        HTTP (REST API)
   ▼                                     ▼
server.js  ──────────────────────────────────────
   │                    │                │
scoring.js          routes/auth      routes/play
   │                    │                │
services/mqtt       services/db     services/mail
   │                    │
   ▼                    ▼
 ESP32              SQLite (better-sqlite3)
(MQTT)
Flux de jeu :

Le joueur appuie sur une touche → action envoyée via WebSocket ou HTTP POST
Le serveur publie la commande sur le topic MQTT flipper/control
L'ESP32 reçoit la commande et active le solénoïde correspondant
L'ESP32 publie le score sur flipper/score
Le serveur reçoit le score et l'émet en temps réel à tous les clients via Socket.IO


Stack technique
CoucheTechnologieRuntimeNode.js / ExpressWebSocketSocket.IOProtocole IoTMQTT (mosquitto broker local)Base de donnéesSQLite via better-sqlite3EmailNodemailer (SMTP configurable)SécuritéHelmet, CORS, express-rate-limit, express-sessionInfraLinux Debian, Nginx, Certbot (SSL), CloudflareMatérielESP32 — 3 pins GPIO → solénoïdes

Sécurité

Tokens de connexion hashés en SHA-256 avant stockage en base
Comparaison timing-safe (crypto.timingSafeEqual) pour la clé admin
Cookies de session httpOnly, sameSite: lax, secure en production
Rate limiting sur les endpoints d'authentification
Variables d'environnement pour tous les secrets (aucune credential dans le code)
CORS restreint à l'origine configurée en production


Structure
├── middleware/
│   ├── requireAuth.js      # Vérifie la session Express
├── routes/
│   ├── auth.routes.js      # Magic link, login, admin
│   └── play.routes.js      # Actions de jeu, score, état
├── services/
│   ├── db.js               # Connexion SQLite + schéma
│   ├── mail.js             # Envoi des magic links (Nodemailer)
│   ├── mqtt.js             # Publication vers l'ESP32
│   └── pseudoGenerator.js  # Génération de pseudo unique à la connexion
├── scoring.js              # Réception MQTT + broadcast Socket.IO
└── server.js               # Point d'entrée — Express + Socket.IO + MQTT

Variables d'environnement
envPORT=3000
NODE_ENV=production
SESSION_SECRET=...
ALLOWED_ORIGIN=https://pachup.com
BASE_URL=https://pachup.com
ADMIN_KEY=...
TOKEN_TTL_SECONDS=3600
DB_PATH=./data/auth.sqlite
MQTT_URL=mqtt://127.0.0.1:1883
MQTT_TOPIC=flipper/control
SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASS=...
MAIL_FROM="Pachup" <contact@pachup.com>

Le code embarqué de l'ESP32 n'est pas inclus dans ce repository.


Statut
🚧 En développement actif.
La communication ESP32 ↔ serveur est fonctionnelle. L'ouverture au public est prévue prochainement.
