import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // EMAIL NOTIFICATION ENDPOINT
  // This is where you would configure your real SMTP settings
  app.post("/api/notify-email", async (req, res) => {
    const { ticketId, description, userEmail, userRole } = req.body;

    console.log(`[Email Service] Attempting to send notification for Ticket #${ticketId}`);

    // Setup the transporter if SMTP details are provided in .env
    const transporter = process.env.SMTP_HOST ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    }) : null;

    try {
      const adminEmail = process.env.VITE_ADMIN_EMAIL || "dennisbottari@gmail.com";
      
      const mailOptions = {
        from: process.env.SMTP_USER || '"Sistema Notifiche" <noreply@system.local>',
        to: adminEmail,
        subject: `Nuovo Ticket Creato (#${ticketId})`,
        text: `È stato creato un nuovo ticket da ${userEmail} (${userRole}).\n\nDescrizione:\n${description}\n\nControlla il pannello admin per i dettagli.`,
      };

      if (transporter) {
        await transporter.sendMail(mailOptions);
        console.log(`[Email Service] Notifica inviata con successo via Email a ${adminEmail}`);
      } else {
        // Fallback or Simulation
        console.log(`[Email Service - SIMULATED] Assente configurazione SMTP. Registrata notifica a ${adminEmail}:\n${mailOptions.text}`);
      }

      res.status(200).json({ success: true, message: transporter ? "Email sent successfully" : "Email notification simulated (check server logs)" });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ success: false, error: "Failed to send email notification" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
