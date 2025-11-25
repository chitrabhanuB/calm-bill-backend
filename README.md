Calm Bill – Smart Bill Reminder & Payment Tracker

A Progressive Web App (PWA) that helps users track bills, receive automated reminders, and manage payments efficiently.
This project is inspired by the functionalities shown in this YouTube reference:
🔗 https://youtu.be/mlGWXSjcXFc

🚀 Features
✅ Core Features

Add, edit, delete bills

Set due dates, frequency & priority

Auto reminders via email (Brevo SMTP)

Mark bills as paid

Secure authentication

Dashboard to track upcoming & overdue bills

Progressive Web App – installable on mobile & desktop

🔔 Notifications

Email reminders powered by Brevo SMTP

Cron job triggers reminders daily at 8 AM

☁️ Backend

Node.js + Express

MongoDB (Atlas)

Supabase (auth & user management)

Brevo (email service)

Render (deployment)

🛠️ Tech Stack
Layer	Technology
Frontend	React + Vite + Tailwind + ShadCN
Backend	Node.js, Express
Database	MongoDB Atlas
Auth	Supabase Auth
Emails	Brevo Transactional API
Deployment	Render
Storage	Supabase
🧩 Folder Structure
backend/
 ├── models/
 ├── routes/
 ├── utils/
 │    ├── emailService.js
 ├── server.js
 ├── package.json
 └── .env

⚙️ Environment Variables

Create a .env file in the backend:

MONGO_URI=your_mongo_uri
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
JWT_SECRET=your_secret_key
PORT=5001

# Brevo
BREVO_API_KEY=your_key_here

# Server URL
BASE_URL=https://your-render-url.onrender.com

📩 Email Reminders (Brevo)
Setup

Add your sender email in Brevo → verify

Add API key to .env

Cron triggers reminders daily:

cron.schedule("0 8 * * *", async () => {
  console.log("Daily reminder job running at 8 AM");
});

▶️ How to Run Locally
Clone the project
git clone https://github.com/yourusername/calm-bill-backend.git
cd calm-bill-backend

Install dependencies
npm install

Run server
node server.js

🌍 Deployment (Render)

Create a Web Service

Connect GitHub repo

Add all .env variables

Deploy

Create Cron Job (optional)

👨‍💻 API Endpoints
Add Reminder
POST /api/reminders/add

Get All Reminders
GET /api/reminders/

Send Due Reminders (Manual)
POST /api/emails/send-due-reminders


Body:

{
  "daysAhead": 30
}

👥 Team Members
Name	Role
Palak Kumari
Amisha Verma
Bindushree Bade	
Chitrabhanu B	
📸 Screenshots (Add yours)
📌 Add screenshots here later:
- Dashboard
- Add Bill
- Email reminder sample

🏁 Conclusion

Calm Bill is a full-stack PWA designed to simplify bill management with automated reminders and a beautiful UI.
Built with modern tools, deployed on cloud, and ready for real-world use.
