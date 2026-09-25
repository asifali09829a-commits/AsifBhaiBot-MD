const express = require("express");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);
const fs = require("fs");
const crypto = require("crypto");
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


      if (cmd === ".pair" || cmd.startsWith(".pair ")) {
        await sock.sendMessage(msg.key.remoteJid,{
          text:"🔐 *ASIFBHAI PAIR*\n\n📱 Dost apne WhatsApp mein:\n1️⃣ Settings → Linked Devices\n2️⃣ Link a Device\n3️⃣ Apne authorized device ko link karein.\n\n⚠️ Sirf apne account ki permission se link karein."
        });
        return;
      }

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


    // ===== ASIFBHAI COMMAND PACK =====

    if (cmd.startsWith(".calc ")) {
      const exp = text.trim().slice(6);
      if (!exp || !/^[0-9+\-*/().%\s]+$/.test(exp)) {
        await sock.sendMessage(msg.key.remoteJid,{
          text:"❌ Example: .calc 25*4+10"
        });
        return;
      }
      try {
        const result = Function(`"use strict"; return (${exp})`)();
        await sock.sendMessage(msg.key.remoteJid,{
          text:`🧮 *Calculator*\n\n${exp} = *${result}*`
        });
      } catch {
        await sock.sendMessage(msg.key.remoteJid,{
          text:"❌ Invalid calculation."
        });
      }
      return;
    }

    if (cmd === ".time") {
      await sock.sendMessage(msg.key.remoteJid,{
        text:`🕐 *Current Time*\n${new Date().toLocaleTimeString("en-PK")}`
      });
      return;
    }

    if (cmd === ".date") {
      await sock.sendMessage(msg.key.remoteJid,{
        text:`📅 *Current Date*\n${new Date().toLocaleDateString("en-PK")}`
      });
      return;
    }

    if (cmd.startsWith(".reverse ")) {
      const value = text.trim().slice(9);
      if (!value) {
        await sock.sendMessage(msg.key.remoteJid,{
          text:"❌ Example: .reverse AsifBhai"
        });
        return;
      }
      await sock.sendMessage(msg.key.remoteJid,{
        text:`🔄 ${value.split("").reverse().join("")}`
      });
      return;
    }

    if (cmd.startsWith(".wordcount ")) {
      const value = text.trim().slice(11);
      const words = value.trim() ? value.trim().split(/\s+/).length : 0;
      const chars = value.length;

      await sock.sendMessage(msg.key.remoteJid,{
        text:`📊 *Word Counter*\n\n📝 Words: ${words}\n🔤 Characters: ${chars}`
      });
      return;
    }

    if (cmd.startsWith(".base64 ")) {
      const value = text.trim().slice(8);
      if (!value) {
        await sock.sendMessage(msg.key.remoteJid,{
          text:"❌ Example: .base64 Hello Asif"
        });
        return;
      }

      await sock.sendMessage(msg.key.remoteJid,{
        text:`🔐 *Base64 Encode*\n\n${Buffer.from(value,"utf8").toString("base64")}`
      });
      return;
    }

    if (cmd.startsWith(".unbase64 ")) {
      const value = text.trim().slice(10);

      try {
        const decoded = Buffer.from(value,"base64").toString("utf8");
        await sock.sendMessage(msg.key.remoteJid,{
          text:`🔓 *Base64 Decode*\n\n${decoded}`
        });
      } catch {
        await sock.sendMessage(msg.key.remoteJid,{
          text:"❌ Invalid Base64."
        });
      }
      return;
    }

    if (cmd === ".coin") {
      const result = Math.random() < 0.5 ? "HEADS 🪙" : "TAILS 🪙";
      await sock.sendMessage(msg.key.remoteJid,{
        text:`🪙 *Coin Flip*\n\n${result}`
      });
      return;
    }

    if (cmd === ".dice") {
      const n = Math.floor(Math.random()*6)+1;
      await sock.sendMessage(msg.key.remoteJid,{
        text:`🎲 *Dice Roll*\n\nResult: *${n}*`
      });
      return;
    }

    if (cmd.startsWith(".8ball ")) {
      const answers = [
        "🎱 Yes, definitely.",
        "🎱 Most likely.",
        "🎱 Ask again later.",
        "🎱 Cannot predict right now.",
        "🎱 Maybe.",
        "🎱 Don't count on it."
      ];

      await sock.sendMessage(msg.key.remoteJid,{
        text:`🎱 *Magic 8 Ball*\n\n${answers[Math.floor(Math.random()*answers.length)]}`
      });
      return;
    }

    if (cmd.startsWith(".choose ")) {
      const raw = text.trim().slice(8);
      const options = raw.split("|").map(x=>x.trim()).filter(Boolean);

      if (options.length < 2) {
        await sock.sendMessage(msg.key.remoteJid,{
          text:"❌ Example: .choose Tea | Coffee | Juice"
        });
        return;
      }

      const choice = options[Math.floor(Math.random()*options.length)];

      await sock.sendMessage(msg.key.remoteJid,{
        text:`🎯 *Random Choice*\n\nSelected: *${choice}*`
      });
      return;
    }

    if (cmd.startsWith(".qr ")) {
      const value = text.trim().slice(4);

      if (!value) {
        await sock.sendMessage(msg.key.remoteJid,{
          text:"❌ Example: .qr Hello Asif"
        });
        return;
      }

      const file = `/data/data/com.termux/files/home/AsifBhaiBot/qr-${Date.now()}.png`;

      try {
        await qrcode.toFile(file,value,{
          width:600,
          margin:2
        });

        await sock.sendMessage(msg.key.remoteJid,{
          image:{stream:fs.createReadStream(file)},
          caption:"📱 *QR Code Ready*"
        });

        fs.unlink(file,()=>{});
      } catch(e) {
        console.error("QR error:",e);
        await sock.sendMessage(msg.key.remoteJid,{
          text:"❌ QR code generate nahi hua."
        });
      }
      return;
    }

    if (cmd === ".sticker" || cmd === ".s") {
      const ctx = msg.message?.extendedTextMessage?.contextInfo;
      const quoted = ctx?.quotedMessage;
      const jid = msg.key.remoteJid;

      if (!quoted?.imageMessage) {
        await sock.sendMessage(jid,{
          text:"❌ Kisi image ko reply karke `.sticker` bhejo."
        });
        return;
      }

      const fileBase = `/data/data/com.termux/files/home/AsifBhaiBot/sticker-${Date.now()}`;
      const input = `${fileBase}.jpg`;
      const output = `${fileBase}.webp`;

      try {
        const stream = await downloadContentFromMessage(
          quoted.imageMessage,
          "image"
        );

        const ws = fs.createWriteStream(input);
        for await (const chunk of stream) ws.write(chunk);
        ws.end();

        await new Promise((resolve,reject)=>{
          ws.on("finish",resolve);
          ws.on("error",reject);
        });

        await execFileAsync("ffmpeg",[
          "-y",
          "-i",input,
          "-vf","scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white@0",
          "-c:v","libwebp",
          "-lossless","0",
          "-q:v","70",
          output
        ],{timeout:120000});

        await sock.sendMessage(jid,{
          sticker:{stream:fs.createReadStream(output)}
        });

        fs.unlink(input,()=>{});
        fs.unlink(output,()=>{});
      } catch(e) {
        console.error("Sticker error:",e);
        await sock.sendMessage(jid,{
          text:"❌ Sticker nahi ban saka."
        });
        fs.unlink(input,()=>{});
        fs.unlink(output,()=>{});
      }
      return;
    }

    if (cmd === ".toimg") {
      const ctx = msg.message?.extendedTextMessage?.contextInfo;
      const quoted = ctx?.quotedMessage;
      const jid = msg.key.remoteJid;

      if (!quoted?.stickerMessage) {
        await sock.sendMessage(jid,{
          text:"❌ Kisi sticker ko reply karke `.toimg` bhejo."
        });
        return;
      }

      const input = `/data/data/com.termux/files/home/AsifBhaiBot/sticker-in-${Date.now()}.webp`;
      const output = input.replace(".webp",".png");

      try {
        const stream = await downloadContentFromMessage(
          quoted.stickerMessage,
          "sticker"
        );

        const ws = fs.createWriteStream(input);
        for await (const chunk of stream) ws.write(chunk);
        ws.end();

        await new Promise((resolve,reject)=>{
          ws.on("finish",resolve);
          ws.on("error",reject);
        });

        await execFileAsync("ffmpeg",[
          "-y",
          "-i",input,
          output
        ],{timeout:120000});

        await sock.sendMessage(jid,{
          image:{stream:fs.createReadStream(output)},
          caption:"🖼️ Sticker → Image"
        });

        fs.unlink(input,()=>{});
        fs.unlink(output,()=>{});
      } catch(e) {
        console.error("ToImg error:",e);
        await sock.sendMessage(jid,{
          text:"❌ Sticker ko image mein convert nahi kar saka."
        });
        fs.unlink(input,()=>{});
        fs.unlink(output,()=>{});
      }
      return;
    }

    if (cmd === ".ping")
        await sock.sendMessage(msg.key.remoteJid,{text:"🏓 Pong!\n⚡ AsifBhai Bot is online."});

      if (cmd === ".owner")
        await sock.sendMessage(msg.key.remoteJid,{text:"👑 Owner: Asif\n🤖 AsifBhai Bot\n🔰 Version: 3.0.0"});

      
      // ===== STYLISH NAME MAKER =====
      if (cmd.startsWith(".stylish ")) {
        const name = text.trim().slice(9).trim();

        if (!name) {
          await sock.sendMessage(msg.key.remoteJid,{
            text:"❌ Example: .stylish Asif"
          });
          return;
        }

        const styles = [
          "꧁༺ " + name + " ༻꧂",
          "★彡 " + name + " 彡★",
          "『 " + name + " 』",
          "亗 " + name + " 亗",
          "乂 " + name + " 乂",
          "♛ " + name + " ♛",
          "⚡ " + name + " ⚡",
          "『ＡＳＩＦ』 " + name,
          "✦ " + name + " ✦",
          "༒ " + name + " ༒"
        ];

        await sock.sendMessage(msg.key.remoteJid,{
          text:"✨ *STYLISH NAME MAKER* ✨\n\n" + styles.join("\n")
        });
        return;
      }


      // ===== ASIFBHAI TOOL PACK 2 =====

      if (cmd.startsWith(".upper ")) {
        const value=text.trim().slice(7);
        if (!value) {
          await sock.sendMessage(msg.key.remoteJid,{text:"❌ Example: .upper hello asif"});
          return;
        }
        await sock.sendMessage(msg.key.remoteJid,{text:`🔠 ${value.toUpperCase()}`});
        return;
      }

      if (cmd.startsWith(".lower ")) {
        const value=text.trim().slice(7);
        if (!value) {
          await sock.sendMessage(msg.key.remoteJid,{text:"❌ Example: .lower HELLO ASIF"});
          return;
        }
        await sock.sendMessage(msg.key.remoteJid,{text:`🔡 ${value.toLowerCase()}`});
        return;
      }

      if (cmd.startsWith(".random ")) {
        const parts=text.trim().split(/\s+/);
        const min=Number(parts[1]);
        const max=Number(parts[2]);

        if (!Number.isInteger(min) || !Number.isInteger(max) || min>max) {
          await sock.sendMessage(msg.key.remoteJid,{text:"❌ Example: .random 1 100"});
          return;
        }

        const result=Math.floor(Math.random()*(max-min+1))+min;
        await sock.sendMessage(msg.key.remoteJid,{
          text:`🎲 *Random Number*\n\nResult: *${result}*`
        });
        return;
      }

      if (cmd === ".uuid") {
        await sock.sendMessage(msg.key.remoteJid,{
          text:`🆔 *UUID*\n\n${crypto.randomUUID()}`
        });
        return;
      }

      if (cmd.startsWith(".hash ")) {
        const value=text.trim().slice(6);

        if (!value) {
          await sock.sendMessage(msg.key.remoteJid,{
            text:"❌ Example: .hash Hello Asif"
          });
          return;
        }

        const hash=crypto.createHash("sha256")
          .update(value,"utf8")
          .digest("hex");

        await sock.sendMessage(msg.key.remoteJid,{
          text:`🔐 *SHA-256*\n\n${hash}`
        });
        return;
      }

      if (cmd.startsWith(".bin ")) {
        const value=text.trim().slice(5);

        if (!value) {
          await sock.sendMessage(msg.key.remoteJid,{
            text:"❌ Example: .bin Hello"
          });
          return;
        }

        const binary=[...Buffer.from(value,"utf8")]
          .map(n=>n.toString(2).padStart(8,"0"))
          .join(" ");

        await sock.sendMessage(msg.key.remoteJid,{
          text:`💻 *Binary*\n\n${binary}`
        });
        return;
      }

      if (cmd.startsWith(".unbin ")) {
        const value=text.trim().slice(7).trim();

        try {
          const parts=value.split(/\s+/);

          if (!parts.length || parts.some(x=>!/^[01]{8}$/.test(x))) {
            throw new Error("invalid");
          }

          const decoded=Buffer.from(
            parts.map(x=>parseInt(x,2))
          ).toString("utf8");

          await sock.sendMessage(msg.key.remoteJid,{
            text:`🔓 *Binary → Text*\n\n${decoded}`
          });
        } catch {
          await sock.sendMessage(msg.key.remoteJid,{
            text:"❌ Example: .unbin 01001000 01101001"
          });
        }
        return;
      }

      if (cmd.startsWith(".count ")) {
        const value=text.trim().slice(7);
        if (!value) {
          await sock.sendMessage(msg.key.remoteJid,{
            text:"❌ Example: .count Hello Asif"
          });
          return;
        }

        const letters=(value.match(/[A-Za-z]/g)||[]).length;
        const numbers=(value.match(/[0-9]/g)||[]).length;
        const spaces=(value.match(/\s/g)||[]).length;

        await sock.sendMessage(msg.key.remoteJid,{
          text:
`📊 *TEXT COUNTER*

📝 Characters: ${value.length}
🔤 Letters: ${letters}
🔢 Numbers: ${numbers}
⬜ Spaces: ${spaces}`
        });
        return;
      }

      if (cmd.startsWith(".ytmp3 ")) {
        const query=text.trim().slice(7).trim();

        if (!query) {
          await sock.sendMessage(msg.key.remoteJid,{
            text:"❌ Example: .ytmp3 https://youtube.com/watch?v=..."
          });
          return;
        }

        const file=`/data/data/com.termux/files/home/AsifBhaiBot/ytmp3-${Date.now()}.mp3`;

        await sock.sendMessage(msg.key.remoteJid,{
          text:"🎵 YouTube MP3 download ho raha hai..."
        });

        try {
          await execFileAsync("yt-dlp",[
            query,
            "--no-playlist",
            "-x",
            "--audio-format","mp3",
            "--audio-quality","128K",
            "-o",file
          ],{timeout:300000});

          await sock.sendMessage(msg.key.remoteJid,{
            audio:{stream:fs.createReadStream(file)},
            mimetype:"audio/mpeg",
            fileName:"AsifBhai-MP3.mp3"
          });

          fs.unlink(file,()=>{});
        } catch(e) {
          console.error("YTMP3 error:",e);
          await sock.sendMessage(msg.key.remoteJid,{
            text:"❌ YouTube MP3 download failed."
          });
          fs.unlink(file,()=>{});
        }
        return;
      }

      if (cmd.startsWith(".ytmp4 ")) {
        const query=text.trim().slice(7).trim();

        if (!query) {
          await sock.sendMessage(msg.key.remoteJid,{
            text:"❌ Example: .ytmp4 https://youtube.com/watch?v=..."
          });
          return;
        }

        const file=`/data/data/com.termux/files/home/AsifBhaiBot/ytmp4-${Date.now()}.mp4`;

        await sock.sendMessage(msg.key.remoteJid,{
          text:"🎬 YouTube MP4 download ho raha hai..."
        });

        try {
          await execFileAsync("yt-dlp",[
            query,
            "--no-playlist",
            "-f","bv*[height<=360]+ba/b[height<=360]",
            "--merge-output-format","mp4",
            "-o",file
          ],{timeout:300000});

          await sock.sendMessage(msg.key.remoteJid,{
            video:{stream:fs.createReadStream(file)},
            mimetype:"video/mp4",
            fileName:"AsifBhai-Video.mp4"
          });

          fs.unlink(file,()=>{});
        } catch(e) {
          console.error("YTMP4 error:",e);
          await sock.sendMessage(msg.key.remoteJid,{
            text:"❌ YouTube MP4 download failed."
          });
          fs.unlink(file,()=>{});
        }
        return;
      }

if (cmd.startsWith(".music ")) {
      cmd=".song "+cmd.slice(7).trim();
      text=cmd;
    }

    if (cmd.startsWith(".yt ")) {
      cmd=".ytmp4 "+cmd.slice(4).trim();
      text=cmd;
    }

    if (cmd === ".alive") {
      await sock.sendMessage(msg.key.remoteJid,{text:"🟢 ASIFBHAI BOT IS ALIVE!\n\n⚡ Online\n🤖 Baileys active\n👑 Owner: Asif"});
      return;
    }

    if (cmd === ".help") {
      await sock.sendMessage(msg.key.remoteJid,{text:"📚 ASIFBHAI HELP\n\n🎵 .music <name>\n🎬 .yt <url>\n😂 .joke\n🎮 .rps\n🖼️ .meme\n👥 .tagall\n🙈 .hidetag\n🏓 .ping\n📋 .menu"});
      return;
    }

    if (cmd === ".joke") {
      const jokes=["😂 Homework? WiFi nahi tha.","🤣 Book kholi thi, par parhai nahi hui.","😎 Phone 1%: Main abhi zinda hoon."];
      await sock.sendMessage(msg.key.remoteJid,{text:jokes[Math.floor(Math.random()*jokes.length)]});
      return;
    }

    if (cmd === ".rps") {
      const a=["🪨 Rock","📄 Paper","✂️ Scissors"];
      await sock.sendMessage(msg.key.remoteJid,{text:"🎮 Bot chose: "+a[Math.floor(Math.random()*a.length)]});
      return;
    }

    if (cmd === ".meme") {
      await sock.sendMessage(msg.key.remoteJid,{text:"😂 Jab bot ka command kaam kare aur user bole: ek aur bana do 🔥"});
      return;
    }

    if (cmd === ".tagall" || cmd === ".hidetag") {
      const jid=msg.key.remoteJid;
      const meta=await sock.groupMetadata(jid).catch(()=>null);
      if(!meta){
        await sock.sendMessage(jid,{text:"❌ Ye command sirf group mein chalega."});
        return;
      }
      const mentions=meta.participants.map(x=>x.id);
      const msgText=cmd===".hidetag" ? "👀 @everyone" : "📢 TAG ALL\n\n"+mentions.map((x,i)=>(i+1)+". @"+x.split("@")[0]).join("\n");
      await sock.sendMessage(jid,{text:msgText,mentions});
      return;
    }

    if (cmd.startsWith(".shout ")) {
  const x=cmd.slice(7).trim();
  await sock.sendMessage(msg.key.remoteJid,{text:"📢 "+x.toUpperCase()});
  return;
}

if (cmd.startsWith(".whisper ")) {
  const x=cmd.slice(9).trim();
  await sock.sendMessage(msg.key.remoteJid,{text:"🤫 "+x.toLowerCase()});
  return;
}

if (cmd.startsWith(".length ")) {
  const x=cmd.slice(8);
  await sock.sendMessage(msg.key.remoteJid,{text:"📏 Length: "+x.length});
  return;
}

if (cmd === ".timestamp") {
  await sock.sendMessage(msg.key.remoteJid,{text:"🕐 "+Date.now()});
  return;
}

if (cmd === ".flip") {
  await sock.sendMessage(msg.key.remoteJid,{text:Math.random()<0.5?"🪙 Heads":"🪙 Tails"});
  return;
}

if (cmd === ".roll") {
  await sock.sendMessage(msg.key.remoteJid,{text:"🎲 "+(Math.floor(Math.random()*6)+1)});
  return;
}

if (cmd.startsWith(".pick ")) {
  const a=cmd.slice(6).split("|").map(x=>x.trim()).filter(Boolean);
  if(a.length<2){
    await sock.sendMessage(msg.key.remoteJid,{text:"❌ Example: .pick Tea | Coffee"});
    return;
  }
  await sock.sendMessage(msg.key.remoteJid,{text:"🎯 I pick: "+a[Math.floor(Math.random()*a.length)]});
  return;
}

if (cmd.startsWith(".ai ")) {
  const q=cmd.slice(4).trim().toLowerCase();
  let answer="🤖 Main AsifBhai Bot hoon. Apna sawal thora clear likho 😎";
  if(q.includes("hello")||q.includes("hi")) answer="👋 Hello Asif! 🔥";
  else if(q.includes("name")) answer="🤖 Mera naam AsifBhai Bot hai.";
  else if(q.includes("time")) answer="⏰ Time check karne ke liye .time use karo.";
  else if(q.includes("help")) answer="📚 Commands ke liye .help ya .menu use karo.";
  await sock.sendMessage(msg.key.remoteJid,{text:answer});
  return;
}

if (cmd.startsWith(".8ball ")) {
  const a=["🎯 Yes.","🤔 Maybe.","❌ No.","🔥 Definitely.","😎 Ask again later."];
  await sock.sendMessage(msg.key.remoteJid,{text:"🎱 "+a[Math.floor(Math.random()*a.length)]});
  return;
}

if (cmd.startsWith(".rate ")) {
  const x=cmd.slice(6).trim();
  await sock.sendMessage(msg.key.remoteJid,{text:"⭐ "+x+" = "+(Math.floor(Math.random()*101))+"%"});
  return;
}

if (cmd.startsWith(".charcount ")) {
  const x=cmd.slice(11);
  await sock.sendMessage(msg.key.remoteJid,{text:"🔢 Characters: "+x.length});
  return;
}

if (cmd.startsWith(".words ")) {
  const x=cmd.slice(7).trim();
  const n=x?x.split(/\s+/).length:0;
  await sock.sendMessage(msg.key.remoteJid,{text:"📝 Words: "+n});
  return;
}

if (cmd.startsWith(".evenodd ")) {
  const n=Number(cmd.slice(9).trim());
  if(!Number.isFinite(n)){
    await sock.sendMessage(msg.key.remoteJid,{text:"❌ Example: .evenodd 24"});
    return;
  }
  await sock.sendMessage(msg.key.remoteJid,{text:n%2===0?"🟢 Even":"🔵 Odd"});
  return;
}

if (cmd.startsWith(".prime ")) {
  const n=Number(cmd.slice(7).trim());
  if(!Number.isInteger(n)||n<2){
    await sock.sendMessage(msg.key.remoteJid,{text:"❌ Enter an integer ≥ 2"});
    return;
  }
  let prime=true;
  for(let i=2;i*i<=n;i++) if(n%i===0){prime=false;break;}
  await sock.sendMessage(msg.key.remoteJid,{text:prime?"🔢 Prime number":"🔢 Not a prime number"});
  return;
}

if (cmd === ".randomword") {
  const a=["Dream","Moon","Hope","Smile","Freedom","Legend","Victory","Peace"];
  await sock.sendMessage(msg.key.remoteJid,{text:"🎲 "+a[Math.floor(Math.random()*a.length)]});
  return;
}

if (cmd === ".fact") {
  const a=["🐙 Octopuses have three hearts.","🌍 Earth is not a perfect sphere.","🍯 Honey can last a very long time when properly stored."];
  await sock.sendMessage(msg.key.remoteJid,{text:"💡 "+a[Math.floor(Math.random()*a.length)]});
  return;
}

if (cmd.startsWith(".compliment ")) {
  const x=cmd.slice(12).trim();
  await sock.sendMessage(msg.key.remoteJid,{text:"✨ "+x+", you're awesome! 🔥"});
  return;
}

if (cmd.startsWith(".roast ")) {
  const x=cmd.slice(7).trim();
  await sock.sendMessage(msg.key.remoteJid,{text:"😂 "+x+" ko bot bhi serious nahi leta!"});
  return;
}

if (cmd.startsWith(".ship ")) {
  const a=cmd.slice(6).split("|").map(x=>x.trim()).filter(Boolean);
  if(a.length!==2){
    await sock.sendMessage(msg.key.remoteJid,{text:"❌ Example: .ship Asif | Ali"});
    return;
  }
  await sock.sendMessage(msg.key.remoteJid,{text:"❤️ "+a[0]+" × "+a[1]+" = "+Math.floor(Math.random()*101)+"%"});
  return;
}

if (cmd.startsWith(".compat ")) {
  const a=cmd.slice(8).split("|").map(x=>x.trim()).filter(Boolean);
  if(a.length!==2){
    await sock.sendMessage(msg.key.remoteJid,{text:"❌ Example: .compat Asif | Ali"});
    return;
  }
  await sock.sendMessage(msg.key.remoteJid,{text:"💞 Compatibility: "+Math.floor(Math.random()*101)+"%"});
  return;
}

if (cmd.startsWith(".trim ")) {
  await sock.sendMessage(msg.key.remoteJid,{text:"✂️ "+cmd.slice(6).trim()});
  return;
}

if (cmd.startsWith(".repeat ")) {
  const a=cmd.slice(8).trim().split("|");
  const n=Math.min(Math.max(parseInt(a[0]),1),20);
  const x=(a.slice(1).join("|")).trim();
  if(!x||!Number.isInteger(n)){
    await sock.sendMessage(msg.key.remoteJid,{text:"❌ Example: .repeat 3 | Hello"});
    return;
  }
  await sock.sendMessage(msg.key.remoteJid,{text:Array(n).fill(x).join("\n")});
  return;
}

if (cmd.startsWith(".sort ")) {
  const a=cmd.slice(6).split(",").map(x=>x.trim()).filter(Boolean).sort();
  await sock.sendMessage(msg.key.remoteJid,{text:"🔤 "+a.join(", ")});
  return;
}

if (cmd.startsWith(".unique ")) {
  const a=cmd.slice(8).split(",").map(x=>x.trim()).filter(Boolean);
  await sock.sendMessage(msg.key.remoteJid,{text:"✨ "+[...new Set(a)].join(", ")});
  return;
}

if (cmd.startsWith(".palindrome ")) {
  const x=cmd.slice(11).trim().toLowerCase().replace(/\s/g,"");
  await sock.sendMessage(msg.key.remoteJid,{text:x===x.split("").reverse().join("")?"🔁 Palindrome":"❌ Not a palindrome"});
  return;
}

if (cmd.startsWith(".math ")) {
  const x=cmd.slice(6).trim();
  if(!/^[0-9+\-*/().%\s]+$/.test(x)){
    await sock.sendMessage(msg.key.remoteJid,{text:"❌ Only basic math allowed."});
    return;
  }
  try{ await sock.sendMessage(msg.key.remoteJid,{text:"🧮 "+String(Function('"use strict";return ('+x+')')())}); }
  catch(e){ await sock.sendMessage(msg.key.remoteJid,{text:"❌ Invalid expression."}); }
  return;
}

if (cmd === ".randomcolor") {
  const hex="#"+Math.floor(Math.random()*16777215).toString(16).padStart(6,"0").toUpperCase();
  await sock.sendMessage(msg.key.remoteJid,{text:"🎨 Random Color: "+hex});
  return;
}

if (cmd === ".yesno") {
  await sock.sendMessage(msg.key.remoteJid,{text:Math.random()<0.5?"✅ YES":"❌ NO"});
  return;
}

if (cmd === ".fortune") {
  const a=["🌟 A good opportunity is coming.","💫 Stay patient; things take time.","🔥 Keep working—progress is near.","🌙 Today is a good day to learn something new."];
  await sock.sendMessage(msg.key.remoteJid,{text:"🔮 "+a[Math.floor(Math.random()*a.length)]});
  return;
}

if (cmd === ".motivate") {
  const a=["💪 Keep going. Small steps become big results.","🔥 Don't quit. Your next attempt could be the one.","🚀 Focus on progress, not perfection."];
  await sock.sendMessage(msg.key.remoteJid,{text:a[Math.floor(Math.random()*a.length)]});
  return;
}

if (cmd === ".groupid") {
  if(!msg.key.remoteJid.endsWith("@g.us")){
    await sock.sendMessage(msg.key.remoteJid,{text:"❌ Group only."}); return;
  }
  await sock.sendMessage(msg.key.remoteJid,{text:"🆔 Group ID:\n"+msg.key.remoteJid});
  return;
}

if (cmd === ".groupinfo") {
  const jid=msg.key.remoteJid;
  if(!jid.endsWith("@g.us")){
    await sock.sendMessage(jid,{text:"❌ Group only."}); return;
  }
  const g=await sock.groupMetadata(jid);
  const admins=g.participants.filter(x=>x.admin).length;
  await sock.sendMessage(jid,{text:"👥 *GROUP INFO*\n\n📛 Name: "+g.subject+"\n👤 Members: "+g.participants.length+"\n👑 Admins: "+admins});
  return;
}

if (cmd === ".members") {
  const jid=msg.key.remoteJid;
  if(!jid.endsWith("@g.us")){
    await sock.sendMessage(jid,{text:"❌ Group only."}); return;
  }
  const g=await sock.groupMetadata(jid);
  const list=g.participants.map((x,i)=>(i+1)+". @"+x.id.split("@")[0]).join("\n");
  await sock.sendMessage(jid,{text:"👥 *MEMBERS*\n\n"+list,mentions:g.participants.map(x=>x.id)});
  return;
}

if (cmd === ".admins") {
  const jid=msg.key.remoteJid;
  if(!jid.endsWith("@g.us")){
    await sock.sendMessage(jid,{text:"❌ Group only."}); return;
  }
  const g=await sock.groupMetadata(jid);
  const a=g.participants.filter(x=>x.admin);
  const list=a.map((x,i)=>(i+1)+". @"+x.id.split("@")[0]).join("\n");
  await sock.sendMessage(jid,{text:"👑 *ADMINS*\n\n"+list,mentions:a.map(x=>x.id)});
  return;
}

if (cmd.startsWith(".mention ")) {
  const jid=msg.key.remoteJid;
  if(!jid.endsWith("@g.us")){
    await sock.sendMessage(jid,{text:"❌ Group only."}); return;
  }
  const number=cmd.slice(9).replace(/\D/g,"");
  if(!number){
    await sock.sendMessage(jid,{text:"❌ Example: .mention 923001234567"}); return;
  }
  const target=number+"@s.whatsapp.net";
  await sock.sendMessage(jid,{text:"📢 @"+number,mentions:[target]});
  return;
}

if (cmd === ".jid") {
  await sock.sendMessage(msg.key.remoteJid,{text:"🆔 JID:\n"+msg.key.remoteJid});
  return;
}

if (cmd === ".contact") {
  const sender=msg.key.participant || msg.key.remoteJid;
  await sock.sendMessage(msg.key.remoteJid,{text:"👤 Contact JID:\n"+sender});
  return;
}

if (cmd === ".status") {
  await sock.sendMessage(msg.key.remoteJid,{text:"🟢 *STATUS*\n\n🤖 AsifBhai Bot: Online\n⚡ Baileys: Active\n🌍 Mode: Public"});
  return;
}

if (cmd === ".runtime") {
  const sec=Math.floor(process.uptime());
  const h=Math.floor(sec/3600), m=Math.floor((sec%3600)/60), s2=sec%60;
  await sock.sendMessage(msg.key.remoteJid,{text:"⏱️ Runtime: "+h+"h "+m+"m "+s2+"s"});
  return;
}

if (cmd === ".info") {
  await sock.sendMessage(msg.key.remoteJid,{text:"🤖 *ASIFBHAI BOT*\n\n👑 Owner: Asif\n⚡ Engine: Baileys\n🔰 Version: 3.0.0\n🌍 Public Mode"});
  return;
}

if (cmd === ".ownerinfo") {
  await sock.sendMessage(msg.key.remoteJid,{text:"👑 *OWNER*\n\nAsif\n🤖 AsifBhai Bot"});
  return;
}

if (cmd === ".version") {
  await sock.sendMessage(msg.key.remoteJid,{text:"🔰 AsifBhai Bot v3.0.0"});
  return;
}

if (cmd === ".prefix") {
  await sock.sendMessage(msg.key.remoteJid,{text:"⚙️ Prefix: ."});
  return;
}

if (cmd === ".repo") {
  await sock.sendMessage(msg.key.remoteJid,{text:"📦 AsifBhai Bot\nGitHub repository can be added here later."});
  return;
}

if (cmd === ".support") {
  await sock.sendMessage(msg.key.remoteJid,{text:"🛠️ Support: Use .help or .menu to see available commands."});
  return;
}

if (cmd === ".id") {
  const sender=msg.key.participant || msg.key.remoteJid;
  await sock.sendMessage(msg.key.remoteJid,{text:"🆔 Your ID:\n"+sender});
  return;
}

if (cmd === ".source") {
  await sock.sendMessage(msg.key.remoteJid,{text:"💻 AsifBhai Bot\nBuilt with Node.js + Baileys."});
  return;
}

if (cmd.startsWith(".bold ")) {
  const x=cmd.slice(6).trim();
  await sock.sendMessage(msg.key.remoteJid,{text:"*"+x+"*"});
  return;
}

if (cmd.startsWith(".italic ")) {
  const x=cmd.slice(8).trim();
  await sock.sendMessage(msg.key.remoteJid,{text:"_"+x+"_"});
  return;
}

if (cmd.startsWith(".swapcase ")) {
  const x=cmd.slice(10);
  const out=[...x].map(c=>c===c.toUpperCase()?c.toLowerCase():c.toUpperCase()).join("");
  await sock.sendMessage(msg.key.remoteJid,{text:out});
  return;
}

if (cmd.startsWith(".removespace ")) {
  await sock.sendMessage(msg.key.remoteJid,{text:cmd.slice(12).replace(/\s+/g,"")});
  return;
}

if (cmd.startsWith(".sortwords ")) {
  const a=cmd.slice(10).trim().split(/\s+/).filter(Boolean).sort((a,b)=>a.localeCompare(b));
  await sock.sendMessage(msg.key.remoteJid,{text:a.join(" ")});
  return;
}

if (cmd.startsWith(".reversewords ")) {
  const a=cmd.slice(13).trim().split(/\s+/).filter(Boolean).reverse();
  await sock.sendMessage(msg.key.remoteJid,{text:a.join(" ")});
  return;
}

if (cmd.startsWith(".first ")) {
  const a=cmd.slice(7).trim().split(/\s+/).filter(Boolean);
  await sock.sendMessage(msg.key.remoteJid,{text:a[0]||"❌ No text"});
  return;
}

if (cmd.startsWith(".last ")) {
  const a=cmd.slice(6).trim().split(/\s+/).filter(Boolean);
  await sock.sendMessage(msg.key.remoteJid,{text:a[a.length-1]||"❌ No text"});
  return;
}

if (cmd.startsWith(".middle ")) {
  const a=cmd.slice(8).trim().split(/\s+/).filter(Boolean);
  await sock.sendMessage(msg.key.remoteJid,{text:a.length?a[Math.floor((a.length-1)/2)]:"❌ No text"});
  return;
}

if (cmd.startsWith(".digits ")) {
  const x=cmd.slice(8);
  const d=x.replace(/\D/g,"");
  await sock.sendMessage(msg.key.remoteJid,{text:"🔢 "+(d||"No digits found")});
  return;
}

const quickReplies={
  ".love":"❤️ Love vibes activated!",
  ".angry":"😡 Gussa thora kam karo 😅",
  ".sad":"💙 Udaas mat ho, sab theek ho jayega.",
  ".happy":"😊 Keep smiling!",
  ".cool":"😎 Stay cool!",
  ".hack":"🛡️ Security learning mode — only authorized systems.",
  ".sleep":"😴 Good night, sweet dreams!",
  ".goodnight":"🌙 Good night! Allah Hafiz 🤍",
  ".morning":"🌅 Good morning! Have a great day.",
  ".welcome":"👋 Welcome to AsifBhai Bot!",
  ".bye":"👋 Bye! Take care.",
  ".thanks":"❤️ You're welcome!"
};

if(quickReplies[cmd]){
  await sock.sendMessage(msg.key.remoteJid,{text:quickReplies[cmd]});
  return;
}

if (cmd === ".groupname") {
  const jid=msg.key.remoteJid;
  if(!jid.endsWith("@g.us")){
    await sock.sendMessage(jid,{text:"❌ Group only."}); return;
  }
  const g=await sock.groupMetadata(jid);
  await sock.sendMessage(jid,{text:"📛 Group Name:\n"+g.subject});
  return;
}

if (cmd === ".gdesc") {
  const jid=msg.key.remoteJid;
  if(!jid.endsWith("@g.us")){
    await sock.sendMessage(jid,{text:"❌ Group only."}); return;
  }
  const g=await sock.groupMetadata(jid);
  await sock.sendMessage(jid,{text:"📝 Group Description:\n"+(g.desc||"No description")});
  return;
}

if (cmd === ".mentionall") {
  const jid=msg.key.remoteJid;
  if(!jid.endsWith("@g.us")){
    await sock.sendMessage(jid,{text:"❌ Group only."}); return;
  }
  const g=await sock.groupMetadata(jid);
  const mentions=g.participants.map(x=>x.id);
  await sock.sendMessage(jid,{
    text:"📢 @everyone",
    mentions
  });
  return;
}

if (cmd === ".memory") {
  const m=process.memoryUsage();
  await sock.sendMessage(msg.key.remoteJid,{text:"🧠 RAM Used: "+Math.round(m.rss/1024/1024)+" MB"});
  return;
}

if (cmd === ".cpu") {
  const c=os.cpus();
  await sock.sendMessage(msg.key.remoteJid,{text:"⚙️ CPU Cores: "+c.length+"\n🔧 Architecture: "+os.arch()});
  return;
}

if (cmd === ".ram") {
  const total=Math.round(os.totalmem()/1024/1024);
  const free=Math.round(os.freemem()/1024/1024);
  await sock.sendMessage(msg.key.remoteJid,{text:"💾 Total RAM: "+total+" MB\n🟢 Free RAM: "+free+" MB"});
  return;
}

if (cmd === ".platform") {
  await sock.sendMessage(msg.key.remoteJid,{text:"📱 Platform: "+process.platform});
  return;
}

if (cmd === ".node") {
  await sock.sendMessage(msg.key.remoteJid,{text:"🟢 Node.js: "+process.version});
  return;
}

if (cmd === ".hostname") {
  await sock.sendMessage(msg.key.remoteJid,{text:"🖥️ Host: "+os.hostname()});
  return;
}

if (cmd === ".env") {
  await sock.sendMessage(msg.key.remoteJid,{text:"🔒 Environment check\n\n🟢 Bot process active\n🛡️ Secrets are not displayed."});
  return;
}

if (cmd === ".speed") {
  const start=Date.now();
  await sock.sendMessage(msg.key.remoteJid,{text:"⚡ Speed: "+(Date.now()-start)+" ms"});
  return;
}

if (cmd.startsWith(".ytsearch ")) {
  cmd=".yts "+cmd.slice(10).trim();
  text=cmd;
}

if (cmd.startsWith(".audio ")) {
  cmd=".ytmp3 "+cmd.slice(7).trim();
  text=cmd;
}

if (cmd.startsWith(".mp4 ")) {
  cmd=".ytmp4 "+cmd.slice(5).trim();
  text=cmd;
}

if (cmd.startsWith(".vid ")) {
  cmd=".video "+cmd.slice(5).trim();
  text=cmd;
}

if (cmd.startsWith(".song2 ")) {
  cmd=".song "+cmd.slice(7).trim();
  text=cmd;
}

if (cmd === ".st" && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
  cmd=".sticker";
}

if (cmd === ".img" && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
  cmd=".toimg";
}

if (cmd === ".stickerinfo") {
  const q=msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  if(!q?.stickerMessage){
    await sock.sendMessage(msg.key.remoteJid,{text:"❌ Sticker ko reply karke .stickerinfo use karo."});
    return;
  }
  const st=q.stickerMessage;
  await sock.sendMessage(msg.key.remoteJid,{text:"🖼️ *STICKER INFO*\n\n📐 Size: "+(st.width||"?")+" × "+(st.height||"?")+"\n🎬 Animated: "+(st.isAnimated?"Yes":"No")});
  return;
}

if (cmd === ".mimetype") {
  const q=msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  if(!q){
    await sock.sendMessage(msg.key.remoteJid,{text:"❌ Kisi message ko reply karo."});
    return;
  }
  const type=Object.keys(q)[0]||"unknown";
  await sock.sendMessage(msg.key.remoteJid,{text:"📦 Message type: "+type});
  return;
}

if (cmd === ".quoted") {
  const q=msg.message?.extendedTextMessage?.contextInfo;
  if(!q?.quotedMessage){
    await sock.sendMessage(msg.key.remoteJid,{text:"❌ Kisi message ko reply karo."});
    return;
  }
  await sock.sendMessage(msg.key.remoteJid,{text:"↩️ Quoted message found.\n🆔 ID: "+(q.stanzaId||"unknown")});
  return;
}

if (cmd === ".warn") {
  const q=msg.message?.extendedTextMessage?.contextInfo;
  const target=q?.mentionedJid?.[0] || q?.participant;
  if(!target){
    await sock.sendMessage(msg.key.remoteJid,{text:"⚠️ Kisi member ko mention ya reply karo."});
    return;
  }
  global.warns=global.warns||{};
  global.warns[target]=(global.warns[target]||0)+1;
  await sock.sendMessage(msg.key.remoteJid,{
    text:"⚠️ *WARNING*\n\n👤 Member: @"+target.split("@")[0]+"\n🔢 Warnings: "+global.warns[target],
    mentions:[target]
  });
  return;
}

if (cmd === ".warnings") {
  const q=msg.message?.extendedTextMessage?.contextInfo;
  const target=q?.mentionedJid?.[0] || q?.participant;
  if(!target){
    await sock.sendMessage(msg.key.remoteJid,{text:"⚠️ Member ko mention ya reply karo."});
    return;
  }
  global.warns=global.warns||{};
  await sock.sendMessage(msg.key.remoteJid,{
    text:"⚠️ Warnings: "+(global.warns[target]||0)+"\n👤 @"+target.split("@")[0],
    mentions:[target]
  });
  return;
}

if ([".kick",".promote",".demote"].includes(cmd)) {
  if(!msg.key.remoteJid.endsWith("@g.us")){
    await sock.sendMessage(msg.key.remoteJid,{text:"❌ Ye command sirf group mein use hota hai."});
    return;
  }

  const q=msg.message?.extendedTextMessage?.contextInfo;
  const target=q?.mentionedJid?.[0] || q?.participant;

  if(!target){
    await sock.sendMessage(msg.key.remoteJid,{text:"❌ Member ko mention ya reply karo."});
    return;
  }

  try {
    const action=cmd.slice(1);
    await sock.groupParticipantsUpdate(
      msg.key.remoteJid,
      [target],
      action
    );

    await sock.sendMessage(msg.key.remoteJid,{
      text:"✅ "+action.toUpperCase()+" successful.\n👤 @"+target.split("@")[0],
      mentions:[target]
    });
  } catch(e) {
    await sock.sendMessage(msg.key.remoteJid,{
      text:"❌ "+action+" failed. Bot ko group admin permission chahiye."
    });
  }
  return;
}

if (cmd === ".menu")
        await sock.sendMessage(msg.key.remoteJid,{text:`📋 *ASIFBHAI BOT — WORKING COMMANDS*

╔══════─── • ───════╗
║┃ ✧ *ASIFBHAI BOT* ✧
║┃ 👑 Owner: Asif
║┃ 🔰 Version: 3.0.0
║┃ 🌍 Mode: Public
║┃
║┃ 🎵 *MUSIC & VIDEO*
║┃ ➳ *.song <name>*
║┃ ➳ *.play <name>*
║┃ ➳ *.video <name>*
║┃ ➳ *.toaudio*
║┃ ➳ *.yts <name>*
║┃
║┃ 🎮 *FUN*
║┃ ➳ *.truth*
║┃ ➳ *.dare*
║┃ ➳ *.quote*
║┃ ➳ *.riddle*
║┃ ➳ *.catfact*
║┃ ➳ *.coin*
║┃ ➳ *.dice*
║┃ ➳ *.8ball <question>*
║┃ ➳ *.choose A | B | C*
║┃
║┃ 🔧 *TOOLS*
║┃ ➳ *.sticker* / *.s*
║┃ ➳ *.toimg*
║┃ ➳ *.qr <text>*
║┃ ➳ *.calc <expression>*
║┃ ➳ *.time*
║┃ ➳ *.date*
║┃ ➳ *.reverse <text>*
║┃ ➳ *.wordcount <text>*
║┃ ➳ *.base64 <text>*
║┃ ➳ *.unbase64 <text>*
║┃ ➳ *.device*
║┃ ➳ *.say <text>*
║┃ ➳ *.echo <text>*
║┃ ➳ *.stylish <name>*
║┃ ➳ *.upper <text>*
║┃ ➳ *.lower <text>*
║┃ ➳ *.random <min> <max>*
║┃ ➳ *.uuid*
║┃ ➳ *.hash <text>*
║┃ ➳ *.bin <text>*
║┃ ➳ *.unbin <binary>*
║┃ ➳ *.count <text>*
║┃ ➳ *.ytmp3 <YouTube URL>*
║┃ ➳ *.ytmp4 <YouTube URL>*
║┃
║┃ 🤖 *BOT*
║┃ ➳ *.ping*
║┃ ➳ *.owner*
║┃ ➳ *.botinfo*
║┃ ➳ *.uptime*
║┃ ➳ *.checkidd*
║┃ ➳ *.baileys*
║┃ ➳ *.menu*
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
