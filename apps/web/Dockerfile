FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json turbo.json ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN npm ci --workspace=@coderank/web --workspace=@coderank/core --include-workspace-root --no-audit --no-fund
RUN npm run build --workspace=@coderank/web
RUN npm prune --omit=dev --workspace=@coderank/web --workspace=@coderank/core --include-workspace-root

FROM node:24-alpine
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/core ./packages/core
COPY --from=build /app/packages/database ./packages/database
COPY --from=build /app/packages/queue ./packages/queue
COPY --from=build /app/apps/web ./apps/web
USER node
EXPOSE 3000
WORKDIR /app/apps/web
CMD ["node", "cluster.js"]
