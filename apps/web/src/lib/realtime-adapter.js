import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
export async function configureRealtimeAdapter(io,env=process.env){
 if(env.REALTIME_REDIS_ENABLED!=='true')return async()=>{};
 const pub=createClient({socket:{host:env.REDIS_HOST||'127.0.0.1',port:Number(env.REDIS_PORT||6379),connectTimeout:2000,reconnectStrategy:retries=>retries>3?false:Math.min(250*(retries+1),1000)}});
 const sub=pub.duplicate();
 for(const client of [pub,sub])client.on('error',error=>console.error('Realtime Redis unavailable:',error.message));
 const close=async()=>{await Promise.all([pub,sub].map(async c=>{if(c.isOpen)try{await c.quit();}catch{c.destroy();}}));};
 try{await Promise.all([pub.connect(),sub.connect()]);io.adapter(createAdapter(pub,sub,{requestsTimeout:3000}));return close;}
 catch(error){await close();throw error;}
}
