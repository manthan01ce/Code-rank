FROM node:24-alpine
WORKDIR /app
COPY infrastructure/gateway/*.mjs ./
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 INTERNAL_WEB_URL=http://web:3000 INTERNAL_API_URL=http://api:3001
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]
