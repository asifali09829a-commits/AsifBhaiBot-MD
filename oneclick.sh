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
    echo "✅ AsifBhaiBot-MD already exists."
    cd "$DIR"
    git pull --ff-only
else
    git clone "$REPO" "$DIR"
    cd "$DIR"
fi

bash install.sh

echo ""
echo "🚀 Starting bot..."
npm start &
BOT_PID=$!

echo "⏳ Waiting for bot..."
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

read -r -p "WhatsApp number (+923xxxxxxxxx): " NUMBER

NUMBER=$(echo "$NUMBER" | tr -d ' +()-')

if [[ "$NUMBER" == 00* ]]; then
    NUMBER="${NUMBER#00}"
fi

echo ""
echo "⏳ Requesting pairing code..."

RESPONSE=$(curl -s --max-time 30 \
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
echo "📱 WhatsApp > Linked Devices > Link a device"
echo "🔗 Use phone number instead / Pairing Code"
echo ""

wait "$BOT_PID"
