const fs = require("fs");
const path = require("path");

function loadCommands(root) {
  const out = new Map();

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (name.endsWith(".js")) {
        try {
          const mod = require(full);
          if (mod && mod.name) out.set(mod.name.toLowerCase(), mod);
        } catch (e) {
          console.log("Command load error:", full, e.message);
        }
      }
    }
  }

  walk(path.join(root, "commands"));
  return out;
}

module.exports = { loadCommands };
