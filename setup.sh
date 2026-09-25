#!/data/data/com.termux/files/usr/bin/bash

set -e

echo "========================================"
echo "        ⚡ ASIFBHAI BOT MD ⚡"
echo "========================================"
echo ""

echo "[1/5] Updating Termux..."
pkg update -y
pkg upgrade -y

echo "[2/5] Installing required packages..."
pkg install -y git nodejs ffmpeg

echo "[3/5] Preparing bot..."
cd "$(dirname "$0")"

echo "[4/5] Installing Node dependencies..."
npm install

echo "[5/5] Starting AsifBhai Bot..."
echo ""
echo "========================================"
echo "       ✅ ASIFBHAI BOT IS STARTING"
echo "========================================"
echo ""
echo "Dashboard: http://127.0.0.1:3001"
echo ""

exec npm start
