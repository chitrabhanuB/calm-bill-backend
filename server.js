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
const { sendEmail } = require("./utils/emailService");

// ✅ NEW: cron
const cron = require("node-cron");

const emailRoutes = require("./routes/emailRoutes");

const app = express();

// ✅ Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ✅ Initialize Razorpay
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.error("❌ Missing Razorpay credentials in .env");
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ✅ Webhook route
app.post(
  '/api/payments/webhook',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    try {
      const secret =
        process.env.RAZORPAY_WEBHOOK_SECRET ||
        process.env.RAZORPAY_KEY_SECRET;

      const signature = req.headers['x-razorpay-signature'];

      const expected = crypto
        .createHmac('sha256', secret)
        .update(req.body)
        .digest('hex');

      if (signature !== expected) {
        console.warn('⚠️ Invalid Razorpay webhook signature');
        return res.status(400).send('invalid signature');
      }

      const payload = JSON.parse(req.body.toString());

      console.log('✅ Razorpay webhook event:', payload.event);

      if (payload.event === 'payment.captured') {
        const payment = payload.payload.payment.entity;
        console.log(
          '💰 Payment captured:',
          payment.id,
          'order_id:',
          payment.order_id
        );
      }

      return res.json({ status: 'ok' });
    } catch (err) {
      console.error('Webhook error:', err);
      return res.status(500).send('server error');
    }
  }
);

// ✅ Middlewares
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (
        origin.includes("vercel.app") ||
        origin.includes("localhost")
      ) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Logger
app.use((req, res, next) => {
  console.log(
    `[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`
  );
  next();
});

// ✅ Routes
app.use("/api/users", userRoutes);
app.use('/api/reminders', reminderRoutes);
app.use("/api/notifications", verifyUser, notificationsRoute);
app.use("/api/emails", emailRoutes);

// ✅ Test email route
app.get('/test-email', async (req, res) => {
  try {
    const to = "1by23cb011@bmsit.in";

    await sendEmail(
      to,
      "Test from Payble",
      "If you see this email, Payble's email notifications are working ✅"
    );

    res.send(`Test email sent to ${to}.`);
  } catch (e) {
    console.error("❌ Error in /test-email:", e);
    res.status(500).send("Failed to send test email.");
  }
});


// ======================================================
// ✅ FIXED Razorpay Create Order Route (ONLY CHANGED PART)
// ======================================================

app.post('/api/payments/create-order', async (req, res) => {
  try {
    console.log("🔥 CREATE ORDER HIT");
    console.log("📩 BODY:", req.body);

    const { amount } = req.body;

    const finalAmount = Number(amount || 100);

    if (isNaN(finalAmount) || finalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount"
      });
    }

    const options = {
      amount: Math.round(finalAmount * 100),
      currency: "INR",
      receipt: `rcpt_${Date.now()}`
    };

    console.log("📦 Razorpay options:", options);

    const order = await razorpay.orders.create(options);

    console.log("✅ Order created:", order);

    return res.json({
      success: true,
      order,
      key: process.env.RAZORPAY_KEY_ID
    });

  } catch (err) {
    console.error("❌ FULL CREATE ORDER ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});


// ======================================================
// Rest code SAME
// ======================================================

// ✅ Razorpay verify
app.post('/api/payments/verify', async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      reminderId,
      userEmail,
      billName,
      amount,
    } = req.body;

    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid signature"
      });
    }

    const updated = await Reminder.findByIdAndUpdate(
      reminderId,
      {
        is_paid: true,
        paid_at: new Date(),
        payment_status: "success"
      },
      { new: true }
    );

    if (userEmail) {
      await sendEmail(
        userEmail,
        "Payment successful",
        `Your payment for "${billName}" was successful.`
      );
    }

    return res.json({
      success: true,
      updated
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false
    });
  }
});

// ✅ Mongo connect
const PORT = process.env.PORT || 5001;

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(async () => {
    console.log("✅ MongoDB connected successfully");

    const cols = await mongoose.connection.db
      .listCollections()
      .toArray();

    console.log("Collections:", cols);

    const count = await Reminder.countDocuments();
    console.log("Reminder count:", count);

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

    cron.schedule("0 9 * * *", async () => {
      console.log("⏰ CRON TRIGGERED");

      const url = `${process.env.BASE_URL}/api/emails/send-due-reminders`;

      try {
        await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ daysAhead: 7 }),
        });
      } catch (err) {
        console.error(err);
      }
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
  });