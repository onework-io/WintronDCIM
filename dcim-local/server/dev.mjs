import {spawn} from 'node:child_process';
const api=spawn(process.execPath,['server/index.mjs'],{stdio:'inherit'});
const web=spawn(process.execPath,['node_modules/vite/bin/vite.js'],{stdio:'inherit'});
let stopping=false;function stop(code=0){if(stopping)return;stopping=true;api.kill('SIGTERM');web.kill('SIGTERM');setTimeout(()=>process.exit(code),300);}
api.on('exit',code=>stop(code||0));web.on('exit',code=>stop(code||0));process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
