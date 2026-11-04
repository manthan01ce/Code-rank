FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json turbo.json ./
COPY packages/contracts ./packages/contracts
COPY packages/core ./packages/core
COPY packages/database ./packages/database
COPY packages/queue ./packages/queue
COPY apps/api ./apps/api
RUN npm ci --workspace=@coderank/core --workspace=@coderank/api --include-workspace-root --omit=dev --no-audit --no-fund
USER node
EXPOSE 3001
ENV NODE_ENV=production API_HOST=0.0.0.0 API_PORT=3001
WORKDIR /app/apps/api
CMD ["node", "src/server.js"]
