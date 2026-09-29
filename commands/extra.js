module.exports = {
  name: "extra",
  category: "utility",
  description: "Extra utility and group commands",

  async run({ sock, message, args, command }) {
    const prefix = ".";
    const jid = message.key.remoteJid;
    const cmd = String(args?.[0] || "").toLowerCase();

    if (cmd === "groupinfo") {
      if (!jid.endsWith("@g.us"))
        return "❌ Ye command group mein use karo.";

      const meta = await sock.groupMetadata(jid);
      const admins = meta.participants.filter(p => p.admin).length;

      return `👥 *GROUP INFO*

📛 Name: ${meta.subject}
🆔 ID: ${jid}
👤 Members: ${meta.participants.length}
👑 Admins: ${admins}`;
    }

    if (cmd === "uptime") {
      const sec = Math.floor(process.uptime());
      const d = Math.floor(sec / 86400);
      const h = Math.floor((sec % 86400) / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;

      return `⏱️ *UPTIME*\n\n${d}d ${h}h ${m}m ${s}s`;
    }

    if (cmd === "status") {
      const mem = process.memoryUsage().rss / 1024 / 1024;

      return `📊 *BOT STATUS*

🟢 Status: Online
⚡ Node: ${process.version}
💾 RAM: ${mem.toFixed(1)} MB
🖥️ Platform: ${process.platform}`;
    }

    if (cmd === "version") {
      return `⚡ *ASIFBHAI MD*\n\nNode.js: ${process.version}\nPlatform: ${process.platform}`;
    }

    if (cmd === "prefix") {
      const setting = require("../setting");
      return `⚙️ Current prefix: *${setting.prefix || prefix || "."}*`;
    }

    if (cmd === "id") {
      return `🆔 Chat ID:\n${jid}`;
    }

    if (cmd === "time") {
      return `🕐 *TIME*\n\n${new Date().toLocaleTimeString("en-PK", {
        timeZone: "Asia/Karachi"
      })}`;
    }

    if (cmd === "date") {
      return `📅 *DATE*\n\n${new Date().toLocaleDateString("en-PK", {
        timeZone: "Asia/Karachi",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      })}`;
    }

    if (cmd === "calc") {
      const expression = args.slice(1).join(" ")
        .replace(/[^0-9+\-*/().% ]/g, "");

      if (!expression.trim()) {
        return `Usage: ${prefix}extra calc 25*4+10`;
      }

      try {
        const result = Function(`"use strict"; return (${expression})`)();

        if (!Number.isFinite(result)) throw new Error();

        return `🧮 *CALCULATOR*\n\n${expression} = *${result}*`;
      } catch {
        return "❌ Invalid calculation.";
      }
    }

    return `🧰 *EXTRA COMMANDS*

${prefix}extra groupinfo
${prefix}extra uptime
${prefix}extra status
${prefix}extra version
${prefix}extra prefix
${prefix}extra id
${prefix}extra time
${prefix}extra date
${prefix}extra calc 25*4`;
  }
};
