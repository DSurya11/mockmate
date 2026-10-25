FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
RUN mkdir -p uploads
EXPOSE 5000
# Apply pending migrations, then start. A failed migration is logged but does not keep the API
# down: on an existing database that was set up another way, the old schema still works.
CMD ["sh", "-c", "npx prisma migrate deploy || echo 'prisma migrate deploy failed: see above'; exec node dist/index.js"]
