import '../../packages/core/src/config/env.js';
import cluster from 'node:cluster';
import { availableParallelism } from 'node:os';
process.env.NODE_ENV ||= 'production';
const enabled=process.env.CLUSTER_ENABLED==='true';
if(enabled&&process.env.REALTIME_REDIS_ENABLED!=='true')throw new Error('Cluster mode requires REALTIME_REDIS_ENABLED=true');
const concurrency=Number(process.env.WEB_CONCURRENCY||Math.min(availableParallelism(),4));
if(!Number.isSafeInteger(concurrency)||concurrency<1||concurrency>16)throw new Error('WEB_CONCURRENCY must be between 1 and 16');
if(enabled&&cluster.isPrimary){
 let stopping=false;
 for(let i=0;i<concurrency;i++)cluster.fork();
 cluster.on('listening', worker => console.log(`Cluster worker listening pid=${worker.process.pid}`));
 let lastRestart=0,backoff=250;
 cluster.on('exit',()=>{if(stopping)return;const now=Date.now();backoff=now-lastRestart<10000?Math.min(backoff*2,5000):250;lastRestart=now;setTimeout(()=>{if(!stopping)cluster.fork();},backoff);});
 const stop=()=>{if(stopping)return;stopping=true;for(const worker of Object.values(cluster.workers))worker?.process.kill('SIGTERM');const timer=setTimeout(()=>{for(const worker of Object.values(cluster.workers))worker?.process.kill('SIGKILL');process.exit(1);},15000);timer.unref();};
 process.on('SIGTERM',stop);process.on('SIGINT',stop);
}else await import('./server.js');
