FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN npm ci --workspace=@coderank/core --workspace=@coderank/api --include-workspace-root --omit=dev --no-audit --no-fund
USER node
EXPOSE 3001
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3001
WORKDIR /app/apps/api
CMD ["node", "src/server.js"]
