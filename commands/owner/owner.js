module.exports = {
  name: "owner",
  category: "owner",
  description: "Show owner information",
  async run() {
    const s = require("../../setting");
    return `👑 Owner: ${s.ownerName}\n⚡ Bot: ${s.botName}`;
  }
};
