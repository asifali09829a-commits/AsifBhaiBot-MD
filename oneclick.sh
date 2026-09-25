#!/data/data/com.termux/files/usr/bin/bash

set -e

REPO="https://github.com/asifali09829a-commits/AsifBhaiBot-MD.git"
DIR="$HOME/AsifBhaiBot-MD"

echo "========================================"
echo "       ⚡ ASIFBHAI BOT MD ⚡"
echo "========================================"
echo ""

pkg update -y
pkg install -y git nodejs ffmpeg curl

if [ -d "$DIR/.git" ]; then
    cd "$DIR"
    git pull --ff-only
else
    git clone "$REPO" "$DIR"
    cd "$DIR"
fi

echo ""
echo "📦 Installing Node.js dependencies..."
npm install

mkdir -p auth_info

echo ""
echo "🚀 Starting bot..."
npm start &
BOT_PID=$!

echo "⏳ Waiting for dashboard..."

for i in $(seq 1 30); do
    if curl -s --max-time 2 http://127.0.0.1:3001/ >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

echo ""
echo "========================================"
echo "       📱 WHATSAPP PAIRING"
echo "========================================"
echo ""

read -r -p "WhatsApp number (+923xxxxxxxxx): " NUMBER < /dev/tty

NUMBER=$(echo "$NUMBER" | tr -d ' +()-')

if [[ "$NUMBER" == 00* ]]; then
    NUMBER="${NUMBER#00}"
fi

if [[ -z "$NUMBER" ]]; then
    echo "❌ Number required."
    kill "$BOT_PID" 2>/dev/null || true
    exit 1
fi

echo ""
echo "⏳ Requesting pairing code for $NUMBER..."

RESPONSE=$(curl -s --max-time 60 \
  -X POST http://127.0.0.1:3001/api/pair \
  -H "Content-Type: application/json" \
  -d "{\"number\":\"$NUMBER\"}")

echo ""
echo "========================================"
echo "        🔐 PAIRING RESPONSE"
echo "========================================"
echo "$RESPONSE"
echo "========================================"
echo ""
echo "📱 WhatsApp → Linked Devices"
echo "🔗 Link a device → Link with phone number"
echo "🔐 Enter the pairing code shown above."
echo ""
echo "✅ Bot process is running..."
echo ""

wait "$BOT_PID"
