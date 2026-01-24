const nodemailer = require("nodemailer");

let transporterPromise = null;

// Crée un transport SMTP réel si configuré, sinon Ethereal (test)
async function getTransporter() {
  if (!transporterPromise) {
    const {
      SMTP_HOST,
      SMTP_PORT,
      SMTP_SECURE,
      SMTP_USER,
      SMTP_PASS,
    } = process.env;

    if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
      transporterPromise = Promise.resolve(
        nodemailer.createTransport({
          host: SMTP_HOST,
          port: Number(SMTP_PORT),
          secure: SMTP_SECURE === "true",
          auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
          },
        })
      );
    } else {
      transporterPromise = nodemailer.createTestAccount().then((account) => {
        return nodemailer.createTransport({
          host: account.smtp.host,
          port: account.smtp.port,
          secure: account.smtp.secure,
          auth: {
            user: account.user,
            pass: account.pass,
          },
        });
      });
    }
  }
  return transporterPromise;
}

async function sendMagicLink(toEmail, magicLink) {
  const transporter = await getTransporter();

  const text = `
Bonjour,

Une demande de connexion a Pachup a ete effectuee avec cette adresse email.

Validez votre token avec ce lien :
${magicLink}

Puis accedez au jeu ici :
https://pachup.com/play

Ce lien est personnel et temporaire.

Si vous n'etes pas a l'origine de cette demande, ignorez simplement ce message.

-- Pachup
`.trim();

  const html = `
    <p>Bonjour,</p>

    <p>
      Une demande de connexion a <strong>Pachup</strong> a ete effectuee avec cette adresse email.
    </p>

    <p>Pour continuer, utilisez le lien ci-dessous :</p>

    <p style="margin: 16px 0;">
      <a href="${magicLink}" style="
        display:inline-block;
        padding:10px 16px;
        background:#1f2937;
        color:#ffffff;
        text-decoration:none;
        border-radius:6px;
        font-weight:500;
      ">
        Valider le token
      </a>
    </p>

    <p style="margin: 8px 0 16px;">
      <a href="https://pachup.com/play.html" style="
        display:inline-block;
        padding:10px 16px;
        background:#41bb7b;
        color:#ffffff;
        text-decoration:none;
        border-radius:6px;
        font-weight:500;
      ">
        Acceder au jeu
      </a>
    </p>

    <p>
      Ce lien est <strong>personnel</strong> et valable pendant une duree limitee.
    </p>

    <p style="color:#555;">
      Si vous n'etes pas a l'origine de cette demande, vous pouvez ignorer ce message.
    </p>

    <hr style="margin:24px 0;border:none;border-top:1px solid #ddd;"/>

    <p style="font-size:12px;color:#777;">
      -- Pachup<br/>
      Email automatique, merci de ne pas repondre.
    </p>
  `.trim();

  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || '"Pachup" <contact@pachup.com>',
    to: toEmail,
    subject: "Connexion a Pachup -- votre lien personnel",
    text,
    html,
  });

  if (nodemailer.getTestMessageUrl(info)) {
    console.log("📧 Email Ethereal envoye");
    console.log("🔗 Preview URL:", nodemailer.getTestMessageUrl(info));
  } else {
    console.log("📧 Email envoye");
  }
}

module.exports = {
  sendMagicLink,
};

