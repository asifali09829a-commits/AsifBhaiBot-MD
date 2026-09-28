const fs = require("fs");
const path = require("path");

const configFile = path.join(__dirname, "..", "aoutreact.json");

function getConfig() {
  try {
    if (fs.existsSync(configFile)) {
      return JSON.parse(fs.readFileSync(configFile, "utf8"));
    }
  } catch (e) {}
  return { enabled: false };
}

function saveConfig(config) {
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
}

module.exports = {
  name: "aoutreact",
  aliases: ["autoreact"],

  category: "general",
  description: "Auto reaction ON/OFF",

  async run({ sock, message, args }) {
    const config = getConfig();
    const option = String(args[0] || "").toLowerCase();

    if (option === "on") {
      config.enabled = true;
      saveConfig(config);
      return "✅ *AutoReact ON*\nAb incoming messages par auto reaction enabled hai. ❤️";
    }

    if (option === "off") {
      config.enabled = false;
      saveConfig(config);
      return "❌ *AutoReact OFF*\nAuto reaction disable kar diya gaya.";
    }

    return `⚙️ *AutoReact Status:* ${config.enabled ? "ON ✅" : "OFF ❌"}

Use:
• .aoutreact on
• .aoutreact off`;
  }
};
