module.exports = {
  name: "love",
  aliases: [
    "angry",
    "sad",
    "happy",
    "cool",
    "sleep",
    "goodnight",
    "morning",
    "bye",
    "thanks"
  ],
  category: "replies",
  description: "Reply/social commands",

  async run({ command }) {
    const replies = {
      love:
        "❤️ Love & peace! AsifBhai MD ki taraf se mohabbat aur khushiyan.",

      angry:
        "😤 Gussa thora kam karo, sab theek ho jayega. ❤️",

      sad:
        "🥺 Udaas mat ho... mushkil waqt hamesha nahi rehta. ❤️",

      happy:
        "😊 Alhamdulillah! Khush raho aur muskurate raho. ✨",

      cool:
        "😎 Stay cool! AsifBhai MD is here. 🔥",

      sleep:
        "😴 Phone side par rakho aur araam se so jao. Good night! 🌙",

      goodnight:
        "🌙 Good Night!\nAllah aapko sukoon aur achi neend ata farmaye. 🤲",

      morning:
        "🌅 Good Morning!\nAllah aaj ka din aapke liye khair aur barkat wala banaye. 🤲",

      bye:
        "👋 Allah Hafiz!\nApna khayal rakhna. ❤️",

      thanks:
        "❤️ You're welcome!\nAsifBhai MD hamesha ready hai. ⚡"
    };

    return replies[command] || "❤️ AsifBhai MD";
  }
};
