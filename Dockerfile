# ---- deps + build ----
FROM oven/bun:1 AS deps

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY prisma ./prisma
RUN bunx prisma generate

COPY . .

# ---- runtime ----
FROM oven/bun:1 AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app /app

EXPOSE 4000

CMD ["bun", "run", "src/server.ts"]