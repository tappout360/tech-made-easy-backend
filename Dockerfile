FROM node:22-alpine

WORKDIR /app

# Install dependencies first (caching layer)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application code
COPY . .

# Non-root user for security
RUN addgroup -g 1001 tme && adduser -u 1001 -G tme -s /bin/sh -D tme
USER tme

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD node -e "fetch('http://localhost:5000/api/v1/health').then(r => process.exit(r.ok ? 0 : 1))"

CMD ["node", "server.js"]
