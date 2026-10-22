FROM node:24-alpine
RUN apk add --no-cache docker-cli
WORKDIR /app
COPY package.json package-lock.json turbo.json ./
COPY packages ./packages
COPY apps/worker ./apps/worker
RUN npm ci --workspace=@coderank/core --workspace=@coderank/worker --include-workspace-root --omit=dev --no-audit --no-fund
WORKDIR /app/apps/worker
CMD ["node", "src/index.js"]
