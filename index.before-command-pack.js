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
  DisconnectReason,
  downloadContentFromMessage
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


      // ===== MEDIA COMMANDS =====
    if (cmd.startsWith(".song ") || cmd.startsWith(".play ")) {
      const query = text.trim().split(/\s+/).slice(1).join(" ");
      if (!query) {
        await sock.sendMessage(msg.key.remoteJid,{text:"❌ Example: .song love u oye"});
        return;
      }

      const file = `/data/data/com.termux/files/home/AsifBhaiBot/song-${Date.now()}.mp3`;
      await sock.sendMessage(msg.key.remoteJid,{text:"🔎 Song search ho raha hai..."});

      try {
        await execFileAsync("yt-dlp",[
          `ytsearch1:${query}`,
          "--no-playlist",
          "-x",
          "--audio-format","mp3",
          "--audio-quality","128K",
          "-o",file
        ],{timeout:240000});

        await sock.sendMessage(msg.key.remoteJid,{
          audio:{stream:fs.createReadStream(file)},
          mimetype:"audio/mpeg",
          fileName:`${query.slice(0,50)}.mp3`
        });

        fs.unlink(file,()=>{});
      } catch(e) {
        console.error("Song error:",e);
        await sock.sendMessage(msg.key.remoteJid,{
          text:"❌ Song download failed. Thori dair baad dobara try karo."
        });
        fs.unlink(file,()=>{});
      }
      return;
    }

    if (cmd.startsWith(".video ")) {
      const query = text.trim().split(/\s+/).slice(1).join(" ");
      if (!query) {
        await sock.sendMessage(msg.key.remoteJid,{text:"❌ Example: .video love u oye"});
        return;
      }

      const file = `/data/data/com.termux/files/home/AsifBhaiBot/video-${Date.now()}.mp4`;
      await sock.sendMessage(msg.key.remoteJid,{text:"🔎 Video search/download ho raha hai..."});

      try {
        await execFileAsync("yt-dlp",[
          `ytsearch1:${query}`,
          "--no-playlist",
          "-f","bv*[height<=360]+ba/b[height<=360]",
          "--merge-output-format","mp4",
          "-o",file
        ],{timeout:300000});

        await sock.sendMessage(msg.key.remoteJid,{
          video:{stream:fs.createReadStream(file)},
          mimetype:"video/mp4",
          fileName:`${query.slice(0,50)}.mp4`
        });

        fs.unlink(file,()=>{});
      } catch(e) {
        console.error("Video error:",e);
        await sock.sendMessage(msg.key.remoteJid,{
          text:"❌ Video download failed. Thori dair baad dobara try karo."
        });
        fs.unlink(file,()=>{});
      }
      return;
    }

    if (cmd === ".toaudio") {
      const ctx = msg.message?.extendedTextMessage?.contextInfo;
      const quoted = ctx?.quotedMessage;
      const jid = msg.key.remoteJid;

      if (!quoted?.videoMessage) {
        await sock.sendMessage(jid,{
          text:"❌ Kisi video ko reply karke `.toaudio` bhejo."
        });
        return;
      }

      const input = `/data/data/com.termux/files/home/AsifBhaiBot/convert-${Date.now()}.mp4`;
      const output = `/data/data/com.termux/files/home/AsifBhaiBot/convert-${Date.now()}.mp3`;

      await sock.sendMessage(jid,{text:"🎵 Video ko MP3 mein convert kar raha hoon..."});

      try {
        const videoMsg = quoted?.videoMessage;
        if (!videoMsg) throw new Error("Quoted video message not found");

        const stream = await downloadContentFromMessage(
          videoMsg,
          "video"
        );

        const ws = fs.createWriteStream(input);
        for await (const chunk of stream) ws.write(chunk);
        ws.end();

        await new Promise((resolve,reject)=>{
          ws.on("finish",resolve);
          ws.on("error",reject);
        });

        const probe = await execFileAsync("ffmpeg",[
          "-i",input,
          "-map","0:a:0",
          "-f","null",
          "-"
        ],{timeout:60000}).catch(() => null);

        if (!probe) {
          throw new Error("Is video mein audio track nahi hai.");
        }

        await execFileAsync("ffmpeg",[
          "-y",
          "-i",input,
          "-map","0:a:0",
          "-vn",
          "-c:a","libmp3lame",
          "-b:a","128k",
          output
        ],{timeout:300000});

        await sock.sendMessage(jid,{
          audio:{stream:fs.createReadStream(output)},
          mimetype:"audio/mpeg",
          fileName:"AsifBhai-Audio.mp3"
        });

        fs.unlink(input,()=>{});
        fs.unlink(output,()=>{});
      } catch(e) {
        console.error("ToAudio error:",e);
        await sock.sendMessage(jid,{
          text:"❌ Video ko audio mein convert nahi kar saka."
        });
        fs.unlink(input,()=>{});
        fs.unlink(output,()=>{});
      }
      return;
    }


    // ===== EXTRA WORKING COMMANDS =====

    if (cmd.startsWith(".yts ")) {
      const query = text.trim().split(/\s+/).slice(1).join(" ");

      if (!query) {
        await sock.sendMessage(msg.key.remoteJid,{
          text:"❌ Example: .yts Atif Aslam songs"
        });
        return;
      }

      try {
        await sock.sendMessage(msg.key.remoteJid,{
          text:"🔎 YouTube search ho raha hai..."
        });

        const { stdout } = await execFileAsync("yt-dlp",[
          `ytsearch5:${query}`,
          "--flat-playlist",
          "--print","%(title)s|||%(webpage_url)s",
          "--skip-download"
        ],{timeout:120000});

        const lines = stdout.trim().split("\n").filter(Boolean);

        if (!lines.length) {
          await sock.sendMessage(msg.key.remoteJid,{
            text:"❌ Koi result nahi mila."
          });
          return;
        }

        let out = `🔎 *YouTube Search: ${query}*\n\n`;

        lines.slice(0,5).forEach((line,i)=>{
          const parts = line.split("|||");
          out += `${i+1}. *${parts[0] || "Unknown"}*\n${parts[1] || ""}\n\n`;
        });

        await sock.sendMessage(msg.key.remoteJid,{text:out});
      } catch(e) {
        console.error("YTS error:",e);
        await sock.sendMessage(msg.key.remoteJid,{
          text:"❌ YouTube search failed."
        });
      }
      return;
    }

    if (cmd === ".device") {
      const mem = Math.round(os.totalmem()/1024/1024);
      const free = Math.round(os.freemem()/1024/1024);

      await sock.sendMessage(msg.key.remoteJid,{
        text:
`📱 *DEVICE INFO*

🖥️ OS: ${os.platform()}
⚙️ Arch: ${os.arch()}
🧠 RAM: ${free}MB free / ${mem}MB
🟢 Node: ${process.version}
🤖 Bot: AsifBhai Bot
⚡ Port: ${PORT}`
      });
      return;
    }

    if (cmd === ".truth") {
      const list = [
        "😶 Tumhari sab se badi secret habit kya hai?",
        "❤️ Kya tumne kabhi kisi ko secretly pasand kiya?",
        "😂 Tumhari sab se embarrassing memory kya hai?",
        "🤔 Kya tumne kabhi jhoot bol kar bachne ki koshish ki?"
      ];
      await sock.sendMessage(msg.key.remoteJid,{
        text:list[Math.floor(Math.random()*list.length)]
      });
      return;
    }

    if (cmd === ".dare") {
      const list = [
        "😂 Kisi friend ko funny voice note bhejo.",
        "😎 Apna status 10 minutes ke liye funny rakho.",
        "🤣 Group mein sirf 3 emojis se reply karo.",
        "🔥 Kisi friend ko 'Boss' keh kar message karo."
      ];
      await sock.sendMessage(msg.key.remoteJid,{
        text:list[Math.floor(Math.random()*list.length)]
      });
      return;
    }

    if (cmd === ".quote") {
      const list = [
        "✨ Har mushkil ke baad aasani hoti hai.",
        "🌙 Khamoshi bhi kabhi kabhi bohat kuch keh deti hai.",
        "💫 Chhoti chhoti koshishen bade results deti hain.",
        "❤️ Dil saaf ho to raaste khud aasaan lagte hain."
      ];
      await sock.sendMessage(msg.key.remoteJid,{
        text:list[Math.floor(Math.random()*list.length)]
      });
      return;
    }

    if (cmd === ".riddle") {
      const list = [
        "🧩 Paheli: Aisi kya cheez hai jo tootne par awaaz nahi karti?\n\n👉 Jawab: *Khamoshi*",
        "🧩 Paheli: Jitna zyada nikalte jao, utna hi bada hota jata hai?\n\n👉 Jawab: *Gaddha*",
        "🧩 Paheli: Paani mein paida hoti hai, paani mein marti hai?\n\n👉 Jawab: *Baraf*"
      ];
      await sock.sendMessage(msg.key.remoteJid,{
        text:list[Math.floor(Math.random()*list.length)]
      });
      return;
    }

    if (cmd === ".catfact") {
      const facts = [
        "🐱 Cats spend a large part of their day sleeping.",
        "🐱 Cats use their whiskers to sense nearby objects.",
        "🐱 A cat can jump several times its own body length.",
        "🐱 Cats have very sensitive hearing."
      ];
      await sock.sendMessage(msg.key.remoteJid,{
        text:facts[Math.floor(Math.random()*facts.length)]
      });
      return;
    }

    if (cmd.startsWith(".say ")) {
      const say = text.trim().slice(5);

      if (!say) {
        await sock.sendMessage(msg.key.remoteJid,{
          text:"❌ Example: .say Hello Asif"
        });
        return;
      }

      await sock.sendMessage(msg.key.remoteJid,{
        text:`🗣️ ${say}`
      });
      return;
    }

    if (cmd.startsWith(".echo ")) {
      const echo = text.trim().slice(6);

      if (!echo) {
        await sock.sendMessage(msg.key.remoteJid,{
          text:"❌ Example: .echo Hello"
        });
        return;
      }

      await sock.sendMessage(msg.key.remoteJid,{
        text:`🔊 ${echo}`
      });
      return;
    }

    if (cmd === ".ping")
        await sock.sendMessage(msg.key.remoteJid,{text:"🏓 Pong!\n⚡ AsifBhai Bot is online."});

      if (cmd === ".owner")
        await sock.sendMessage(msg.key.remoteJid,{text:"👑 Owner: Asif\n🤖 AsifBhai Bot\n🔰 Version: 3.0.0"});

      if (cmd === ".menu")
        await sock.sendMessage(msg.key.remoteJid,{text:`📋 *ASIFBHAI BOT — WORKING COMMANDS*

╔══════─── • ───════╗
║┃
║┃ ✧ *ASIFBHAI BOT* ✧
║┃
║┃ 👑 Owner: Asif
║┃ 🔰 Version: 3.0.0
║┃ 🌍 Mode: Public
║┃
║┃ 🎵 *MUSIC & VIDEO*
║┃ ➳ *.song <name>* → Audio
║┃ ➳ *.play <name>* → Audio
║┃ ➳ *.video <name>* → Video
║┃ ➳ *.toaudio* → Video → MP3
║┃ ➳ *.yts <name>* → YouTube Search
║┃
║┃ 🎮 *FUN*
║┃ ➳ *.truth*
║┃ ➳ *.dare*
║┃ ➳ *.quote*
║┃ ➳ *.riddle*
║┃ ➳ *.catfact*
║┃
║┃ 🔧 *TOOLS*
║┃ ➳ *.device* → Device Info
║┃ ➳ *.say <text>*
║┃ ➳ *.echo <text>*
║┃ ➳ *.ping*
║┃ ➳ *.owner*
║┃ ➳ *.checkidd*
║┃ ➳ *.botinfo*
║┃ ➳ *.uptime*
║┃ ➳ *.baileys*
║┃ ➳ *.menu*
║┃
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
