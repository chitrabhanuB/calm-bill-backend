const axios = require("axios");

async function sendEmail(to, subject, text) {
  try {
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: "Payble Notifications",
          email: "payble.notifications@gmail.com"
        },
        to: [
          { email: to }
        ],
        subject: subject,
        textContent: text
      },
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("📧 Brevo Email sent:", response.data);
    return response.data;

  } catch (error) {
    console.error("❌ Brevo Email Error:", error.response?.data || error);
    throw error;
  }
}

module.exports = { sendEmail };
