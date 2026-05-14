FROM node:22-slim AS builder
WORKDIR /app

ARG VITE_API_URL=http://localhost:5000/api
ARG VITE_WS_URL=http://localhost:5000
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
# Fix for Vite preview expecting server.js while Cloudflare plugin outputs index.js
RUN cp dist/server/index.js dist/server/server.js

FROM node:22-slim
WORKDIR /app
COPY --from=builder /app /app
EXPOSE 3000
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "3000"]
