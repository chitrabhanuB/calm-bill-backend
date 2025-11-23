// backend/utils/emailService.js
const nodemailer = require("nodemailer");

// 🔐 Create a reusable transporter using SMTP settings from .env
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,                      // e.g. smtp.gmail.com
  port: Number(process.env.SMTP_PORT) || 587,       // 587 for TLS
  secure: false,                                    // false for 587, true for 465
  auth: {
    user: process.env.SMTP_USER,                    // your sender email
    pass: process.env.SMTP_PASS,                    // your app password
  },
});

/**
 * Simple helper to send an email
 * @param {string} to - recipient email
 * @param {string} subject
 * @param {string} text - plain text body
 */
async function sendEmail(to, subject, text) {
  if (!to) {
    console.warn("sendEmail called without 'to' address");
    return;
  }

  const mailOptions = {
    from: process.env.SMTP_USER,
    to,
    subject,
    text,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("📧 Email sent:", info.messageId);
  } catch (err) {
    console.error("❌ Error sending email:", err);
  }
}

module.exports = { sendEmail };
