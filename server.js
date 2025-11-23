require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const notificationsRoute = require("./routes/notifications");

const reminderRoutes = require('./routes/reminderRoutes');
const userRoutes = require('./routes/userRoutes');
const verifyUser = require('./middleware/verifyUser');
const Reminder = require("./models/reminder");
const { createClient } = require('@supabase/supabase-js');
const { sendEmail } = require("./utils/emailService"); // ✅ email helper

// ✅ NEW: cron (we'll use Node's built-in fetch)
const cron = require("node-cron");

const emailRoutes = require("./routes/emailRoutes"); // ✅ make sure this file exists

const app = express();

// ✅ Initialize Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// ✅ Initialize Razorpay
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.error("❌ Missing Razorpay credentials in .env");
}
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ✅ Webhook route (must come before express.json())
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
    const signature = req.headers['x-razorpay-signature'];
    const expected = crypto.createHmac('sha256', secret).update(req.body).digest('hex');

    if (signature !== expected) {
      console.warn('⚠️ Invalid Razorpay webhook signature');
      return res.status(400).send('invalid signature');
    }

    const payload = JSON.parse(req.body.toString());
    console.log('✅ Razorpay webhook event:', payload.event);

    if (payload.event === 'payment.captured') {
      const payment = payload.payload.payment.entity;
      console.log('💰 Payment captured:', payment.id, 'order_id:', payment.order_id);
    }

    return res.json({ status: 'ok' });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).send('server error');
  }
});

// ✅ Middlewares
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:8080",

    // Your production domain
    "https://calm-bill-frontend-x1ah.vercel.app",

    // Your current Vercel preview deployment
    "https://calm-bill-frontend-x1ah-mq46lqogx-chitrabhanubs-projects.vercel.app"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
}));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// ✅ User Routes
app.use("/api/users", userRoutes);

// ✅ Reminder Routes
app.use('/api/reminders', reminderRoutes);

// ✅ Notifications Route (protected via Supabase verifyUser)
app.use("/api/notifications", verifyUser, notificationsRoute);

// ✅ Email routes (send-due-reminders)
app.use("/api/emails", emailRoutes);

// ✅ Test email route (for manual testing)
app.get('/test-email', async (req, res) => {
  try {
    const to = "1by23cb011@bmsit.in";
    await sendEmail(
      to,
      "Test from Payble",
      "If you see this email, Payble's email notifications are working ✅"
    );
    res.send(`Test email sent to ${to}. Check your inbox (and spam).`);
  } catch (e) {
    console.error("❌ Error in /test-email:", e);
    res.status(500).send("Failed to send test email.");
  }
});

// ✅ Razorpay: Create Order
app.post('/api/payments/create-order', async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt } = req.body;

    if (!amount || isNaN(amount)) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const options = {
      amount: Math.round(Number(amount) * 100), // paise
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
      payment_capture: 1,
    };

    const order = await razorpay.orders.create(options);
    return res.json({ success: true, order, key: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    console.error('❌ Razorpay create-order error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create order', error: err.message });
  }
});

// ✅ Razorpay: Verify Signature + update reminder + send email
app.post('/api/payments/verify', async (req, res) => {
  try {
    console.log("🔥 VERIFY API HIT");
    console.log("📩 BODY RECEIVED:", req.body);

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      reminderId,
      userEmail,  // from frontend
      billName,   // optional
      amount,     // optional
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !reminderId) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      console.warn('⚠️ Invalid payment signature');

      try {
        await Reminder.findByIdAndUpdate(
          reminderId,
          { payment_status: "failed" },
          { new: true }
        );
      } catch (e) {
        console.warn("⚠️ Could not update payment_status=failed:", e.message);
      }

      if (userEmail) {
        const subject = "Payment failed";
        const text = `Your payment for "${billName || "your bill"}"${
          amount ? ` of ₹${amount}` : ""
        } failed. Please try again.`;
        sendEmail(userEmail, subject, text);
      }

      return res.status(400).json({ success: false, validated: false, message: 'Invalid signature' });
    }

    console.log("🟢 SIGNATURE MATCHED!");

    const updated = await Reminder.findByIdAndUpdate(
      reminderId,
      {
        is_paid: true,
        paid_at: new Date(),
        payment_status: "success",
      },
      { new: true }
    );

    console.log("🔥 UPDATED REMINDER:", updated);

    if (userEmail) {
  const finalBillName = billName || updated?.bill_name || "your bill";
  const finalAmount = amount != null ? amount : updated?.amount;

  const subject = "Payment successful";

  const text = `Hi,

Your payment for "${finalBillName}"${
    finalAmount != null ? ` of ₹${finalAmount}` : ""
  } was successful.

Thank you!
- Payble Team`;

  try {
    await sendEmail(userEmail, subject, text);
    console.log("📧 Payment success email SENT to:", userEmail);
  } catch (e) {
    console.error("❌ Failed to send payment success email:", e);
  }
}


    return res.json({ success: true, validated: true, updated });

  } catch (err) {
    console.error('Payment verify error:', err);
    return res.status(500).json({ success: false, message: 'Verification failed', error: err.message });
  }
});

// ✅ DEMO: mark reminder as paid + send success email no razorpay required 
app.post("/api/payments/demo-success", async (req, res) => {
  try {
    const { reminderId, userEmail, billName, amount } = req.body;

    if (!reminderId || !userEmail) {
      return res
        .status(400)
        .json({ success: false, message: "reminderId and userEmail are required" });
    }

    const updated = await Reminder.findByIdAndUpdate(
      reminderId,
      {
        is_paid: true,
        paid_at: new Date(),
        payment_status: "success",
      },
      { new: true }
    );

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Reminder not found" });
    }

    const subject = "Payment successful";
    const text = `Your payment for "${billName || updated.bill_name || "your bill"}"${
      amount ?? updated.amount ? ` of ₹${amount ?? updated.amount}` : ""
    } was marked as successful. Thank you!`;

    await sendEmail(userEmail, subject, text);

    console.log("✅ Demo payment email sent for reminder:", updated._id.toString());

    return res.json({ success: true, updated });
  } catch (err) {
    console.error("❌ Error in /api/payments/demo-success:", err);
    return res
      .status(500)
      .json({ success: false, message: "Demo payment failed", error: err.message });
  }
});

// ✅ MongoDB Connection + start server + start CRON
const PORT = process.env.PORT || 5001;
console.log("🔍 DEBUG MONGO_URI =", process.env.MONGO_URI);

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log('✅ MongoDB connected successfully');
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

    // 🔔 Start CRON only AFTER Mongo is connected
    console.log("⏰ Starting cron job (every 30 seconds for demo)");

    cron.schedule("*/30 * * * * *", async () => {
      console.log("⏰ CRON TRIGGERED");

      const url = `${process.env.BASE_URL}/api/emails/send-due-reminders`;
      console.log("   Calling =>", url);

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ daysAhead: 7}), // 0 = due today (for demo)
        });

        const data = await res.json().catch(() => null);
        console.log("📨 Cron status:", res.status, data);
      } catch (err) {
        console.error("❌ Cron error calling send-due-reminders:", err);
      }
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
  });
