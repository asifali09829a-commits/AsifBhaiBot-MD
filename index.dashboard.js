const express = require("express");
const os = require("os");
const app = express();
const PORT = process.env.PORT || 3000;

const started = Date.now();
let commands = 0;
let users = 0;

app.use(express.json());
app.use(express.static("public"));

app.get("/api/stats", (req,res) => {
  const uptime = Math.floor((Date.now()-started)/1000);
  res.json({
    name: "AsifBhai Bot",
    version: "1.0.0",
    users, online: 1, commands,
    uptime,
    memory: process.memoryUsage().rss,
    cpu: os.loadavg()[0],
    platform: process.platform
  });
});

app.post("/api/command", (req,res) => {
  commands++;
  if (req.body?.newUser) users++;
  res.json({ok:true, message:"Command received"});
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`⚡ AsifBhai Bot dashboard running on port ${PORT}`);
});