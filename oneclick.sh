#!/data/data/com.termux/files/usr/bin/bash

set -e

REPO="https://github.com/asifali09829a-commits/AsifBhaiBot-MD.git"
DIR="$HOME/AsifBhaiBot-MD"

echo "========================================"
echo "       ⚡ ASIFBHAI BOT MD ⚡"
echo "========================================"

pkg update -y
pkg upgrade -y
pkg install -y git nodejs ffmpeg

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
echo "🚀 Starting AsifBhai Bot..."
exec npm start
