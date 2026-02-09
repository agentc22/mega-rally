FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG CACHE_BUST=1
ENV NEXT_PUBLIC_OPERATOR_URL=wss://operator-production-4127.up.railway.app
ENV NEXT_PUBLIC_CONTRACT_ADDRESS=0x6E3b0923c176cfAa3A534b7610534Aca12084f3B
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
