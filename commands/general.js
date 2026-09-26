const menu = require("../options/menu");
module.exports = {
  menu: async (sock, msg, s) => sock.sendMessage(msg.key.remoteJid, { text: menu(s) }),
  help: async (sock, msg, s) => sock.sendMessage(msg.key.remoteJid, { text: `Use ${s.prefix}menu to view commands.` }),
  ping: async (sock, msg, s) => sock.sendMessage(msg.key.remoteJid, { text: "🏓 Pong! AsifBhai MD is online." }),
  owner: async (sock, msg, s) => sock.sendMessage(msg.key.remoteJid, { text: `👑 Owner: ${s.ownerName}\n📱 ${s.ownerNumber}` }),
};
