module.exports = {
  tagall: async (sock, msg) => {
    const jid = msg.key.remoteJid;
    const meta = await sock.groupMetadata(jid);
    const mentions = meta.participants.map(p => p.id);
    const text = mentions.map((x,i) => `${i+1}. @${x.split("@")[0]}`).join("\n");
    await sock.sendMessage(jid, { text: `📢 TAG ALL\n\n${text}`, mentions });
  },
};
