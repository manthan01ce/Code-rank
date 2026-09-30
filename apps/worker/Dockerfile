FROM node:20-alpine

WORKDIR /app

# Copy root workspace configurations
COPY package.json turbo.json ./
COPY packages/core ./packages/core
COPY packages/config ./packages/config
COPY apps/worker ./apps/worker

# Install dependencies
RUN npm install --workspace=@coderank/core --workspace=@coderank/worker

WORKDIR /app/apps/worker

CMD ["node", "src/index.js"]
