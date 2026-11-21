FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src ./src

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD bun -e "const r=await fetch('http://127.0.0.1:'+(process.env.PORT||'3000')+'/'); if(!r.ok) process.exit(1)"

CMD ["bun", "run", "src/index.ts"]
