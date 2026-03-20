# pachup-site

Backend d'une plateforme web connectée à un flipper physique via ESP32.  
Projet personnel en cours de développement — l'objectif est de piloter un flipper physique depuis une interface web et de gérer les parties en temps réel.

> 🌐 Site déployé sur [pachup.com](https://pachup.com) (accès non ouvert au public pour l'instant)  
> ⚙️ Serveur Linux sécurisé — Nginx + HTTPS + protection Cloudflare

## Ce que fait ce projet

- **Contrôle physique du flipper depuis le front** : les touches du clavier actionnent 3 solénoïdes via l'ESP32 (batteur gauche, batteur droit, lanceur de balle)
- **Communication ESP32 ↔ serveur** : établie et fonctionnelle via MQTT over HTTPS
- **Gestion des sessions et authentification** utilisateurs
- **Déploiement en production** : serveur Linux, Nginx reverse proxy, certificat SSL, protection Cloudflare

> Le code embarqué de l'ESP32 n'est pas inclus dans ce repository.

## Stack

- **Runtime** : Node.js / Express
- **Protocole IoT** : MQTT (communication temps réel avec l'ESP32)
- **Sécurité** : sessions, authentification, HTTPS, Cloudflare
- **Infra** : Linux, Nginx (reverse proxy), SSL
- **Matériel** : ESP32 — contrôle de solénoïdes (3 pins GPIO)

## Structure

```
├── middleware/     # Authentification, contrôle d'accès
├── routes/         # Points d'entrée API
├── services/       # Logique métier
├── server.js       # Point d'entrée principal
└── scoring.js      # Gestion des scores
```

## Statut

🚧 En développement actif — projet personnel d'apprentissage backend et IoT.  
La communication ESP32 ↔ serveur est fonctionnelle. L'ouverture au public est prévue prochainement.
