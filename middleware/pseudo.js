const crypto = require("crypto");

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateCandidate() {
  // Player-1234
  const n = randomInt(1000, 9999);
  return `Player-${n}`;
}

/**
 * Génère un pseudo unique en vérifiant la DB via une requête préparée.
 * @param {object} q - objet contenant q.getByPseudo (better-sqlite3 statement)
 * @returns {string}
 */
function generatePseudoUnique(q) {
  for (let i = 0; i < 20; i++) {
    const p = generateCandidate();
    const exists = q.getByPseudo.get(p);
    if (!exists) return p;
  }

  // fallback très rare
  const hex = crypto.randomBytes(3).toString("hex");
  return `Player-${hex}`;
}

module.exports = { generatePseudoUnique };
