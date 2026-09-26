module.exports = {
  sticker: async (sock, msg) => sock.sendMessage(msg.key.remoteJid, { text: "🖼️ Sticker handler ready. Add your preferred image/video-to-sticker converter here." }),
  toimg: async (sock, msg) => sock.sendMessage(msg.key.remoteJid, { text: "🖼️ Image conversion handler ready." }),
  ytmp3: async (sock, msg) => sock.sendMessage(msg.key.remoteJid, { text: "🎵 Download handler placeholder. Configure a lawful media provider before enabling downloads." }),
  ytmp4: async (sock, msg) => sock.sendMessage(msg.key.remoteJid, { text: "🎬 Download handler placeholder. Configure a lawful media provider before enabling downloads." }),
};
