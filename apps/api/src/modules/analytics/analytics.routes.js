import { createAnalyticsReports,csvReport } from './reports.js';
import { analyticsConfig, createAnalyticsAuth, requireAnalyticsOrigin } from './auth.js';
import { analyticsQuery, createAnalyticsService } from './service.js';

export default async function analyticsRoutes(fastify,options) {
  const query=options.query || analyticsQuery;
  const auth=createAnalyticsAuth(query), service=options.service || createAnalyticsService(query);
  const reports=createAnalyticsReports(query,options.runtime);
  fastify.decorateRequest('analyticsSession',null);
  fastify.addHook('onRequest',async(request,reply)=>{
    reply.header('Cache-Control','private, no-store');
    reply.header('X-Robots-Tag','noindex, nofollow');
    reply.header('X-Content-Type-Options','nosniff');
    const config=analyticsConfig();
    if(!['GET','HEAD'].includes(request.method)) requireAnalyticsOrigin(request,config);
    if(request.method==='POST' && request.routeOptions.url==='/api/analytics/session') return;
    await auth.require(request,config);
  });
  fastify.setErrorHandler((error,request,reply)=>{
    const status=error.statusCode && error.statusCode<500?error.statusCode:503;
    const message=status===503?'Analytics is unavailable. Check access configuration, migrations and database connectivity.':error.message;
    reply.code(status).send({error:message});
  });
  fastify.post('/analytics/session',{bodyLimit:2048},async(request,reply)=>auth.login(request,reply,analyticsConfig()));
  fastify.get('/analytics/session',async(request)=>({authenticated:true,expiresAt:request.analyticsSession.expires_at}));
  fastify.delete('/analytics/session',async(request,reply)=>auth.logout(request,reply,analyticsConfig()));
  fastify.get('/analytics/overview',async()=>service.overview());
  fastify.get('/analytics/submissions',async(request)=>service.submissions(request.query));
  fastify.get('/analytics/submissions/:id',async(request)=>{
    const detail=await service.submission(request.params.id);
    await auth.audit('VIEW_SUBMISSION',String(request.params.id));
    return detail;
  });
  fastify.get('/analytics/progress',async()=>service.progress());
  fastify.post('/analytics/collect',{bodyLimit:512},async()=>{await options.runtime?.tick();return options.runtime?.getState() || {collectionEnabled:false,usageEnabled:false};});
  fastify.get('/analytics/history',async(request)=>reports.history(request.query));
  fastify.get('/analytics/usage',async(request)=>reports.usage(request.query));
  fastify.get('/analytics/incidents',async(request)=>reports.incidents(request.query));
  fastify.get('/analytics/export',async(request,reply)=>{
    const type=request.query.type;
    if(!['history','usage','incidents','execution'].includes(type))return reply.code(400).send({error:'Choose history, usage, incidents or execution.'});
    const data=await reports[type](request.query);
    await auth.audit('EXPORT',type);
    reply.header('Content-Disposition',`attachment; filename="coderank-${type}.csv"`);
    return reply.type('text/csv; charset=utf-8').send(csvReport(data.points || data.daily || data.rows || data.recent));
  });
  fastify.get('/analytics/access',async()=>({rows:await query('SELECT action,detail,created_at FROM analytics_access ORDER BY id DESC LIMIT 100',[])}));
}
