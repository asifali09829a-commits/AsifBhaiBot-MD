#!/data/data/com.termux/files/usr/bin/bash
set -e

DIR="$HOME/AsifBhaiBot-MD"

echo "========================================"
echo "       ⚡ ASIFBHAI BASEBOT UPGRADE"
echo "========================================"

cd "$DIR"

echo "📦 Installing required packages..."
pkg update -y
pkg install -y git nodejs ffmpeg curl

echo "💾 Creating backup..."
mkdir -p backups
cp index.js "backups/index.js.$(date +%Y%m%d-%H%M%S).bak"

echo "📁 Creating BaseBot structure..."
mkdir -p commands/{owner,admin,group,media,general}
mkdir -p database functions options storage
mkdir -p web

touch database/.gitkeep
touch storage/.gitkeep

echo "⚙️ Creating configuration..."

cat > setting.js <<'JS'
module.exports = {
  botName: process.env.BOT_NAME || "AsifBhaiBot-MD",
  ownerName: process.env.OWNER_NAME || "Asif",
  prefix: process.env.PREFIX || ".",
  mode: process.env.BOT_MODE || "public",
  port: Number(process.env.PORT || 3001)
};
JS

cat > .env <<'ENV'
BOT_NAME=AsifBhaiBot-MD
OWNER_NAME=Asif
PREFIX=.
BOT_MODE=public
PORT=3001
ENV

echo "🧩 Creating command folders..."
for f in commands/owner/.gitkeep \
         commands/admin/.gitkeep \
         commands/group/.gitkeep \
         commands/media/.gitkeep \
         commands/general/.gitkeep \
         functions/.gitkeep \
         options/.gitkeep; do
  touch "$f"
done

echo "🛡️ Protecting private files..."
touch .gitignore

for item in auth_info/ backups/ storage/ .env node_modules/; do
  grep -qxF "$item" .gitignore 2>/dev/null || echo "$item" >> .gitignore
done

echo "📦 Installing Node dependencies..."
npm install

echo ""
echo "========================================"
echo "       ✅ ASIFBHAI BASEBOT READY"
echo "========================================"
echo ""
echo "📱 Start:"
echo "   npm start"
echo ""
echo "🌐 Dashboard:"
echo "   http://127.0.0.1:3001"
echo ""
echo "📂 Commands:"
echo "   commands/"
echo ""
echo "💾 Database:"
echo "   database/"
echo ""
echo "🔐 Session:"
echo "   auth_info/"
echo ""
echo "========================================"
