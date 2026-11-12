import { parseArgs } from 'node:util';
import { configureAnalytics } from '../lib/analytics-setup.mjs';

function hidden(prompt) {
  if(!process.stdin.isTTY) throw Error('Run this command in an interactive terminal; do not pass passwords as command arguments.');
  process.stdout.write(prompt);
  process.stdin.setRawMode(true);process.stdin.resume();process.stdin.setEncoding('utf8');
  return new Promise((done,reject)=>{
    let value='';
    const cleanup=()=>{process.stdin.off('data',input);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');};
    function input(chunk){
      for(const char of chunk){
        if(char==='\u0003'){cleanup();reject(Error('Setup cancelled.'));return;}
        if(char==='\r'||char==='\n'){cleanup();done(value);return;}
        if(char==='\u007f'||char==='\b')value=value.slice(0,-1);
        else if(char>=' '&&value.length<512)value+=char;
      }
    }
    process.stdin.on('data',input);
  });
}
try{
  const {values}=parseArgs({options:{origin:{type:'string'},'env-file':{type:'string'},'enable-recording':{type:'boolean',default:false}}});
  if(!values.origin)throw Error('Usage: npm run analytics:setup -- --origin https://your-coderank-host');
  const password=await hidden('New analytics password (hidden, at least 8 characters): ');
  const confirm=await hidden('Confirm analytics password (hidden): ');
  if(password!==confirm)throw Error('Passwords did not match; no file changed.');
  const file=await configureAnalytics({password,origin:values.origin,file:values['env-file'],recording:values['enable-recording']});
  console.log(`Analytics access configured in ${file}. Restart API and workers to apply it. Existing analytics sessions will be invalidated. Run npm run analytics:check to verify configuration and migrations.`);
}catch(error){console.error(error.message);process.exitCode=1;}
