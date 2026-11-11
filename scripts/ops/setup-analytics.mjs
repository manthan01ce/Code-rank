import { parseArgs } from 'node:util';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, chmod } from 'node:fs/promises';
import { resolve } from 'node:path';
import { analyticsConfig, hashAnalyticsPassword } from '../../apps/api/src/modules/analytics/auth.js';

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
  const {values}=parseArgs({options:{origin:{type:'string'},'env-file':{type:'string',default:'.env'}}});
  if(!values.origin)throw Error('Usage: npm run analytics:setup -- --origin https://your-coderank-host');
  const password=await hidden('New analytics password (hidden, at least 14 characters): ');
  const confirm=await hidden('Confirm analytics password (hidden): ');
  if(password!==confirm)throw Error('Passwords did not match; no file changed.');
  const hash=await hashAnalyticsPassword(password),secret=randomBytes(48).toString('hex');
  analyticsConfig({ANALYTICS_PASSWORD_HASH:hash,ANALYTICS_SESSION_SECRET:secret,ANALYTICS_ORIGIN:values.origin});
  const file=resolve(values['env-file']);let existing='';
  try{existing=await readFile(file,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
  const retained=existing.split('\n').filter(line=>!/^\s*(?:export\s+)?ANALYTICS_(?:PASSWORD_HASH|SESSION_SECRET|ORIGIN)\s*=/.test(line)).join('\n');
  await writeFile(file,`${retained.trimEnd()}\nANALYTICS_PASSWORD_HASH='${hash}'\nANALYTICS_SESSION_SECRET='${secret}'\nANALYTICS_ORIGIN='${values.origin}'\n`,{mode:0o600});
  await chmod(file,0o600);
  console.log('Analytics access configured. Restart the API to apply it. Existing analytics sessions will be invalidated.');
}catch(error){console.error(error.message);process.exitCode=1;}
