import nodemailer from 'nodemailer';

const {
  SMTP_HOST = 'localhost',
  SMTP_PORT = '1025',
  SMTP_SECURE = 'false',
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM = '4Cyber Phish <no-reply@dev.local>',
} = process.env;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: SMTP_SECURE === 'true', // dev=false (MailHog), prod=true (465) / false (587)
  auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
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
