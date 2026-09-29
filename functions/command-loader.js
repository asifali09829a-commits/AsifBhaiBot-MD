const fs = require("fs");
const path = require("path");

function loadCommands(root) {
  const out = new Map();

  function register(name, mod) {
    if (!name || !mod) return;

    const key = String(name).toLowerCase().replace(/^\./, "");

    if (!out.has(key)) {
      out.set(key, mod);
    }
  }

  function walk(dir) {
    if (!fs.existsSync(dir)) return;

    for (const name of fs.readdirSync(dir)) {
      const full = path.resolve(dir, name);

      if (fs.statSync(full).isDirectory()) {
        walk(full);
        continue;
      }

      if (!name.endsWith(".js")) continue;

      try {
        const mod = require(full);

        if (!mod || !mod.name) continue;

        register(mod.name, mod);

        if (Array.isArray(mod.aliases)) {
          for (const alias of mod.aliases) {
            register(alias, mod);
          }
        }
      } catch (e) {
        console.log("Command load error:", full, e.message);
      }
    }
  }

  walk(path.resolve(root, "commands"));

  return out;
}

module.exports = { loadCommands };
