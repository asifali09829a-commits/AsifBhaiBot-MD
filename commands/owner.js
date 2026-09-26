module.exports = {
  setprefix: async (sock, msg, s, args, isOwner) => {
    if (!isOwner) return sock.sendMessage(msg.key.remoteJid, { text: "❌ Owner only." });
    if (!args[0]) return sock.sendMessage(msg.key.remoteJid, { text: `Usage: ${s.prefix}setprefix !` });
    s.prefix = args[0];
    require("fs").writeFileSync("setting.json", JSON.stringify(s, null, 2));
    await sock.sendMessage(msg.key.remoteJid, { text: `✅ Prefix changed to: ${s.prefix}` });
  },
  mode: async (sock, msg, s, args, isOwner) => {
    if (!isOwner) return sock.sendMessage(msg.key.remoteJid, { text: "❌ Owner only." });
    s.mode = args[0] || "private";
    await sock.sendMessage(msg.key.remoteJid, { text: `✅ Mode: ${s.mode}` });
  },
};
