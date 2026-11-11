import Fastify from 'fastify';
import { createAnalyticsRuntime } from './modules/analytics/history.js';
import { analyticsQuery,createAnalyticsService } from './modules/analytics/service.js';
import usageRoutes from './modules/usage/usage.routes.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import { OperationsService } from './modules/operations/operations.service.js';
import operationsRoutes from './modules/operations/operations.routes.js';
import { SubmissionService } from '@coderank/core/submissions';
import { closeDatabase } from '@coderank/database';
import { closeRateLimiter } from './middleware/rate-limiter.js';
import authRoutes from './modules/auth/auth.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import realtimePlugin from './realtime/server.js';
import coursesRoutes from './modules/courses/courses.routes.js';
import mappingRoutes from './modules/mapping/mapping.routes.js';
import practicalsRoutes from './modules/practicals/practicals.routes.js';
import executionRoutes from './modules/execution/execution.routes.js';
import submissionsRoutes from './modules/submissions/submissions.routes.js';
import profileRoutes from './modules/profile/profile.routes.js';

export function buildApp(options = {}) {
  const app = Fastify({
    logger: false,
    ...options,
  });

  const analyticsService=createAnalyticsService();
  const analyticsRuntime=createAnalyticsRuntime({query:analyticsQuery,collect:()=>analyticsService.overview()});
  app.decorateRequest('analyticsAction',null);
  app.decorateRequest('analyticsActor',null);
  app.addHook('onReady',async()=>analyticsRuntime.start());

  app.addHook('onResponse', async (request, reply) => {
    OperationsService.recordHttpRequest({ url: request.routeOptions.url || '/unmatched', statusCode: reply.statusCode, durationMs: reply.elapsedTime });
    analyticsRuntime.recordHttp(request,reply);
  });

  app.addHook('onClose', async () => {
    await analyticsRuntime.stop();
    const outcomes = await Promise.allSettled([closeRateLimiter(), closeDatabase(), SubmissionService.close?.()]);
    const failed = outcomes.find(result => result.status === 'rejected');
    if (failed) throw failed.reason;
  });

  app.register(realtimePlugin, options.realtime || {});
  app.register(operationsRoutes, { prefix: '/api' });
  app.register(analyticsRoutes, { prefix: '/api',runtime:analyticsRuntime,service:analyticsService });
  app.register(usageRoutes, { prefix: '/api',runtime:analyticsRuntime });
  app.register(authRoutes, { prefix: '/api' });
  app.register(usersRoutes, { prefix: '/api' });
  app.register(coursesRoutes, { prefix: '/api' });
  app.register(mappingRoutes, { prefix: '/api' });
  app.register(practicalsRoutes, { prefix: '/api' });
  app.register(executionRoutes, { prefix: '/api' });
  app.register(submissionsRoutes, { prefix: '/api' });
  app.register(profileRoutes, { prefix: '/api' });

  return app;
}
