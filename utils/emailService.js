// backend/utils/emailService.js
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendEmail(to, subject, text) {
  try {
    const html = text.replace(/\n/g, "<br>");

    const response = await resend.emails.send({
      from: "Payble Notifications <onboarding@resend.dev>",
      to,
      subject,
      html,
    });

    console.log("📧 Resend API Response:", JSON.stringify(response, null, 2));

    if (response.error) {
      console.error("❌ Resend API Error:", response.error);
    } else {
      console.log(`✅ Email accepted by Resend for: ${to}`);
    }

    return response;
  } catch (error) {
    console.error("❌ Resend EXCEPTION:", error?.response?.data || error);
    throw error;
  }
}

module.exports = { sendEmail };
