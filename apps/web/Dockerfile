FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json turbo.json ./
COPY packages/contracts ./packages/contracts
COPY apps/web ./apps/web
RUN npm ci --workspace=@coderank/web --include-workspace-root --no-audit --no-fund
RUN npm run build --workspace=@coderank/web

FROM node:24-alpine
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
WORKDIR /app/apps/web
# Framework-generated server from Next.js standalone output, not a source custom server.
CMD ["node", "server.js"]
