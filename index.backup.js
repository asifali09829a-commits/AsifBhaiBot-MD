const express = require("express");
const os = require("os");
const pino = require("pino");
const qrcode = require("qrcode");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static("public"));

let sock;
let pairingCode = null;
let commands = 0;
let users = 0;
const started = Date.now();

async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth_info");

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log("\n📱 QR available — pairing code ke liye number enter karo.");
    }

    if (connection === "open") {
      console.log("✅ WhatsApp connected!");
      pairingCode = null;
    }

    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log("❌ WhatsApp disconnected:", code);
      if (code !== DisconnectReason.loggedOut) {
        setTimeout(startWhatsApp, 5000);
      }
    }
  });
}

app.get("/api/stats", (req, res) => {
  res.json({
    name: "AsifBhai Bot",
    version: "3.0.0",
    users,
    online: 1,
    commands,
    uptime: Math.floor((Date.now() - started) / 1000),
    memory: process.memoryUsage().rss,
    cpu: os.loadavg()[0],
    platform: process.platform
  });
});

app.post("/api/pair", async (req, res) => {
  try {
    const number = String(req.body.number || "").replace(/\D/g, "");

    if (!number) {
      return res.status(400).json({
        ok: false,
        error: "Number required. Example: 923001234567"
      });
    }

    if (!sock) {
      return res.status(503).json({
        ok: false,
        error: "WhatsApp is starting, try again in a few seconds."
      });
    }

    if (sock.authState?.creds?.registered) {
      return res.json({
        ok: false,
        error: "Already paired."
      });
    }

    pairingCode = await sock.requestPairingCode(number);

    res.json({
      ok: true,
      pairingCode
    });

    console.log("\n🔐 PAIRING CODE:", pairingCode);
    console.log("📱 WhatsApp > Linked Devices > Link a device > Link with phone number");
  } catch (e) {
    console.error("Pairing error:", e.message);
    res.status(500).json({
      ok: false,
      error: e.message
    });
  }
});

app.post("/api/command", (req, res) => {
  commands++;
  if (req.body?.newUser) users++;
  res.json({ ok: true, message: "Command received" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`⚡ AsifBhai Bot running on port ${PORT}`);
  console.log(`🌐 Dashboard: http://127.0.0.1:${PORT}`);
  startWhatsApp();
});
