import { usageRoutes } from '@coderank/contracts/usage';
import { checkRateLimit } from '../../middleware/rate-limiter.js';
import { createHmac } from 'node:crypto';

export default async function usageRoutesPlugin(fastify,{runtime,rateLimit=checkRateLimit}){
 fastify.addHook('onRequest',async(request,reply)=>{
  reply.header('Cache-Control','no-store');reply.header('X-Robots-Tag','noindex, nofollow');
  if(request.method==='POST'){
   const state=runtime.getState();
   if(!state.usageEnabled)return reply.code(503).send({error:'Usage measurement is disabled.'});
   if(request.headers.origin!==state.origin||request.headers['x-coderank-usage']!=='1')return reply.code(403).send({error:'Usage origin is not allowed.'});
  }
 });
 fastify.get('/usage/config',async()=>({enabled:runtime.getState().usageEnabled,mode:'aggregate-pageviews',browserIdentifiers:false}));
 fastify.post('/usage/events',{bodyLimit:512},async(request,reply)=>{
  if(!request.body||Object.keys(request.body).length!==1||!usageRoutes.includes(request.body.route))return reply.code(400).send({error:'Provide a coarse route name only.'});
  const bucket=createHmac('sha256',process.env.ANALYTICS_USAGE_SECRET).update(request.ip).digest('hex');
  const rate=await rateLimit(`usage:${bucket}`,'default');
  if(!rate.allowed||rate.unavailable)return reply.code(rate.unavailable?503:429).send({error:'Usage measurement is temporarily limited.'});
  if(!runtime.recordPage(request.body.route))return reply.code(503).send({error:'Usage buffer is full.'});
  return reply.code(202).send({accepted:true});
 });
}
