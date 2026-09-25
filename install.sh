#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "=================================="
echo "      ⚡ ASIFBHAI BOT MD ⚡"
echo "=================================="
echo ""

echo "[1/4] Updating Termux..."
pkg update -y

echo "[2/4] Installing required packages..."
pkg install -y nodejs ffmpeg

echo "[3/4] Installing Node.js dependencies..."
npm install

echo "[4/4] Creating WhatsApp session folder..."
mkdir -p auth_info

echo ""
echo "=================================="
echo "       ✅ INSTALLATION DONE"
echo "=================================="
echo ""
echo "Start bot with:"
echo "npm start"
echo ""
echo "WhatsApp pairing/dashboard:"
echo "http://127.0.0.1:3001"
echo ""
