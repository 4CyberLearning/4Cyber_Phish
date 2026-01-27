import nodemailer from 'nodemailer';

const {
  SMTP_HOST = 'localhost',
  SMTP_PORT = '1025',
  SMTP_SECURE = 'false',
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM = '4Cyber Phish <no-reply@dev.local>',
} = process.env;

  const port = Number(SMTP_PORT);
  const secure = SMTP_SECURE === "true";

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure, // 465=true, 587=false
    requireTLS: !secure && port === 587, // Office365: vynutit STARTTLS
    auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    tls: { minVersion: "TLSv1.2" },
  });

export async function sendMail({ to, subject, html, from, replyTo }) {
  const info = await transporter.sendMail({
    from: from || SMTP_FROM,
    to,
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
  });
  return info;
}

export async function verifySmtp() {
  return transporter.verify();
}
