const fs=require("fs");
const pino=require("pino");
const {default:makeWASocket,useMultiFileAuthState,DisconnectReason}=require("@whiskeysockets/baileys");

const number=process.argv[2];
if(!number) process.exit(1);

const dir=`./accounts/${number}`;
fs.mkdirSync(dir,{recursive:true});

(async()=>{
  const {state,saveCreds}=await useMultiFileAuthState(dir);

  const sock=makeWASocket({
    auth:state,
    logger:pino({level:"silent"}),
    printQRInTerminal:false
  });

  sock.ev.on("creds.update",saveCreds);

  if(state.creds.registered){
    console.log("ALREADY");
    return;
  }

  try{
    const code=await sock.requestPairingCode(number);
    console.log("PAIRCODE:"+code);
  }catch(e){
    console.log("ERROR:"+e.message);
    process.exit(1);
  }

  sock.ev.on("connection.update",({connection,lastDisconnect})=>{
    if(connection==="open"){
      console.log("CONNECTED:"+number);
    }

    if(connection==="close"){
      const code=lastDisconnect?.error?.output?.statusCode;
      if(code!==DisconnectReason.loggedOut){
        console.log("RECONNECT:"+number);
      }
    }
  });
})();
