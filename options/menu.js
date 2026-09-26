module.exports = (s) => `
╭━━━〔 ⚡ ${s.botName} 〕━━━╮
┃ Version: ${s.version}
┃ Prefix : ${s.prefix}
╰━━━━━━━━━━━━━━━━━━━━━━╯

┌─〔 📋 MAIN 〕
│ ${s.prefix}menu
│ ${s.prefix}ping
│ ${s.prefix}owner
│ ${s.prefix}help
└────────────────────

┌─〔 👥 GROUP 〕
│ ${s.prefix}tagall
│ ${s.prefix}kick
│ ${s.prefix}promote
│ ${s.prefix}demote
└────────────────────

┌─〔 🖼️ MEDIA 〕
│ ${s.prefix}sticker
│ ${s.prefix}toimg
│ ${s.prefix}ytmp3
│ ${s.prefix}ytmp4
└────────────────────

┌─〔 👑 OWNER 〕
│ ${s.prefix}setprefix
│ ${s.prefix}mode
│ ${s.prefix}restart
└────────────────────

${s.menuFooter}`;
