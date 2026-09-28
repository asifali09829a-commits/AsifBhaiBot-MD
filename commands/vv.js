const {
  downloadContentFromMessage
} = require("@whiskeysockets/baileys");

module.exports = {
  name: "vv",
  aliases: ["viewonce"],

  category: "media",
  description: "View Once media ko normal media ke taur par resend karta hai.",

  async run({ sock, message }) {
    const jid = message.key.remoteJid;
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (!quoted) {
      return "❌ View Once photo/video ko reply karke .vv use karo.";
    }

    const viewOnce =
      quoted.viewOnceMessage?.message ||
      quoted.viewOnceMessageV2?.message ||
      quoted.viewOnceMessageV2Extension?.message;

    if (!viewOnce) {
      return "❌ Ye View Once message nahi hai.";
    }

    const media =
      viewOnce.imageMessage ||
      viewOnce.videoMessage;

    if (!media) {
      return "❌ Sirf View Once photo/video supported hai.";
    }

    const type = media === viewOnce.imageMessage ? "image" : "video";

    const stream = await downloadContentFromMessage(media, type);

    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);

    if (type === "image") {
      await sock.sendMessage(jid, {
        image: buffer,
        caption: media.caption || ""
      });
    } else {
      await sock.sendMessage(jid, {
        video: buffer,
        caption: media.caption || ""
      });
    }

    return "✅ View Once media sent.";
  }
};
