FROM node:20-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=production
COPY package*.json package-lock.json ./
RUN npm install --omit=dev
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/drizzle ./drizzle
COPY ./.env.example ./.env.example
EXPOSE 3000
CMD ["node", "dist/bot/index.js"]
