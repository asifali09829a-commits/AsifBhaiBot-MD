const express = require("express");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);
const fs = require("fs");
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
  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const msg = messages[0];
      if (!msg?.message || msg.key.fromMe) return;

      const text = msg.message.conversation ||
        msg.message.extendedTextMessage?.text || "";
      const cmd = text.trim().toLowerCase();


      if (cmd.startsWith(".song ")) {
        const query = text.trim().slice(6).trim();

        if (!query) {
          await sock.sendMessage(msg.key.remoteJid,{
            text:"🎵 Example:\n.song Atif Aslam"
          });
          return;
        }

        const id = Date.now();
        const file = `/data/data/com.termux/files/home/AsifBhaiBot/song-${id}.mp3`;

        try {
          await sock.sendMessage(msg.key.remoteJid,{
            text:"🔎 Song search ho raha hai..."
          });

          await execFileAsync("yt-dlp",[
            `ytsearch1:${query}`,
            "-x",
            "--audio-format","mp3",
            "--audio-quality","128K",
            "-o",file,
            "--no-playlist"
          ],{timeout:180000});

          await sock.sendMessage(msg.key.remoteJid,{
            audio:{url:file},
            mimetype:"audio/mpeg",
            fileName:`${query.slice(0,50)}.mp3`
          });

          fs.unlink(file,()=>{});
        } catch(e) {
          console.log("Song error:",e.message);
          await sock.sendMessage(msg.key.remoteJid,{
            text:"❌ Song download nahi ho saka."
          });
          fs.unlink(file,()=>{});
        }
      }

      if (cmd.startsWith(".video ")) {
        const query = text.trim().slice(7).trim();

        if (!query) {
          await sock.sendMessage(msg.key.remoteJid,{
            text:"🎬 Example:\n.video Mr Bean"
          });
          return;
        }

        const id = Date.now();
        const file = `/data/data/com.termux/files/home/AsifBhaiBot/video-${id}.mp4`;

        try {
          await sock.sendMessage(msg.key.remoteJid,{
            text:"🔎 Video search/download ho raha hai..."
          });

          await execFileAsync("yt-dlp",[
            `ytsearch1:${query}`,
            "-f","mp4[height<=360]/mp4",
            "-o",file,
            "--no-playlist"
          ],{timeout:240000});

          await sock.sendMessage(msg.key.remoteJid,{
            video:{url:file},
            mimetype:"video/mp4",
            fileName:`${query.slice(0,50)}.mp4`
          });

          fs.unlink(file,()=>{});
        } catch(e) {
          console.log("Video error:",e.message);
          await sock.sendMessage(msg.key.remoteJid,{
            text:"❌ Video download nahi ho saka."
          });
          fs.unlink(file,()=>{});
        }
      }

      if (cmd === ".ping")
        await sock.sendMessage(msg.key.remoteJid,{text:"🏓 Pong!\n⚡ AsifBhai Bot is online."});

      if (cmd === ".owner")
        await sock.sendMessage(msg.key.remoteJid,{text:"👑 Owner: Asif\n🤖 AsifBhai Bot\n🔰 Version: 3.0.0"});

      if (cmd === ".menu")
        await sock.sendMessage(msg.key.remoteJid,{text:`📋 *ALL COMMANDS*

╔══════─── • ───════╗
║╭────•
║┃───⎝⎝✧ *ASIFBHAI BOT* ✧⎠⎠
║┃
║┃➳ *OWNER:* Asif
║┃➳ *VERSION:* v1.0.0
║┃➳ *PREFIX:* .
║┃➳ *MODE:* 🌍 Public
║┃
║┃───⎝⎝ 🎵 *MUSIC & AUDIO*
║┃➳ *.song* → Audio Download
║┃➳ *.play* → Audio Download
║┃➳ *.spotify* → Spotify Download
║┃➳ *.spsong* → Spotify Search
║┃➳ *.toptt* → Audio → Voice Note
║┃➳ *.bass* → Bass Effect
║┃➳ *.deep* → Deep/Robot Voice
║┃
║┃───⎝⎝ 🎬 *VIDEO & DOWNLOADER*
║┃➳ *.video* → Video Download
║┃➳ *.yts* → YouTube Search
║┃➳ *.tt* → TikTok Download
║┃➳ *.ig* → Instagram Download
║┃➳ *.fb* → Facebook Download
║┃➳ *.mediafire* → MediaFire Download
║┃➳ *.aio* → All-in-One Downloader
║┃
║┃───⎝⎝ 🤖 *AI & IMAGE*
║┃➳ *.gen* → AI Image
║┃➳ *.hd* → HD Image
║┃➳ *.uhd* → Ultra HD
║┃➳ *.removebg* → Remove Background
║┃➳ *.tourl* → Upload to URL
║┃➳ *.sketch* → Image to Sketch
║┃
║┃───⎝⎝ 🎮 *FUN & GAMES*
║┃➳ *.truth* → Truth
║┃➳ *.dare* → Dare
║┃➳ *.quote* → Random Quote
║┃➳ *.riddle* → Riddle
║┃➳ *.catfact* → Cat Fact
║┃➳ *.meme* → Random Meme
║┃➳ *.hug* → Hug
║┃➳ *.kiss* → Kiss
║┃
║┃───⎝⎝ 🎌 *ANIME*
║┃➳ *.neko* → Neko
║┃➳ *.waifu* → Waifu
║┃➳ *.shinobu* → Shinobu
║┃➳ *.megumin* → Megumin
║┃➳ *.animekill* → Anime Kill
║┃➳ *.animeslap* → Anime Slap
║┃➳ *.animekiss* → Anime Kiss
║┃➳ *.animedance* → Anime Dance
║┃
║┃───⎝⎝ 🔧 *TOOLS*
║┃➳ *.sticker* → Image to Sticker
║┃➳ *.s* → Sticker Shortcut
║┃➳ *.toimg* → Sticker to Image
║┃➳ *.emojimix* → Mix Emojis
║┃➳ *.ssweb* → Website Screenshot
║┃➳ *.device* → Device Info
║┃➳ *.whois* → User Info
║┃➳ *.readmore* → Read More
║┃
║┃───⎝⎝ 🎨 *TEXT EFFECTS*
║┃➳ *.glitchtext*
║┃➳ *.neontext*
║┃➳ *.3dtext*
║┃➳ *.firetext*
║┃➳ *.goldtext*
║┃➳ *.galaxytext*
║┃➳ *.shadowtext*
║┃➳ *.retrostyle*
║┃➳ *.logomaker*
║┃
║┃───⎝⎝ ⚙️ *SETTINGS*
║┃➳ *.public
║┃➳ *.self
║┃➳ *.settings
║┃➳ *.mysettings
║┃➳ *.setbotname
║┃➳ *.setbotimage
║┃
║┃───⎝⎝ 📖 *MISC*
║┃➳ *.imdb* → Movie Info
║┃➳ *.tts* → Text to Speech
║┃➳ *.say* → Text to Speech
║┃➳ *.ping* → Check Latency
║┃➳ *.owner* → Bot Owner
║┃➳ *.checkidd* → Chat ID
║┃➳ *.pair* → Pair Device
║┃➳ *.dis-conn* → Disconnect
║┃➳ *.baileys* → Connection
║┃
║╰────•
╚══════─── • ───════╝

> powered by *AsifBhaiBot 🔥*`}); 

      if (cmd === ".botinfo")
        await sock.sendMessage(msg.key.remoteJid,{text:"🤖 *ASIFBHAI BOT*\n\n🟢 Status: Online\n👑 Owner: Asif\n⚡ Engine: Baileys\n🔰 Version: 3.0.0"});

      if (cmd === ".uptime")
        await sock.sendMessage(msg.key.remoteJid,{text:"⏱️ Bot is running successfully!\n⚡ AsifBhai Bot"});

      if (cmd === ".checkidd")
        await sock.sendMessage(msg.key.remoteJid,{text:`🆔 Chat ID:\n${msg.key.remoteJid}`});

      if (cmd === ".baileys")
        await sock.sendMessage(msg.key.remoteJid,{text:"⚡ AsifBhai Bot\n🟢 WhatsApp connected\n🔰 Baileys engine active"});
    } catch(e) {
      console.log("Command error:",e.message);
    }
  });


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
