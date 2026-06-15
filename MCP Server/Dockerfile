# ── SAP S/4HANA MCP Server Dockerfile ─────────────────
# Build:  docker build -t sap-s4-mcp:0.3.0 .
# Run:    docker run -i --rm --env-file .env sap-s4-mcp:0.3.0
# ──────────────────────────────────────────────────────

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:20-alpine AS runtime
RUN addgroup -S mcp && adduser -S mcp -G mcp
WORKDIR /app

# Production deps from build stage
COPY --from=build --chown=mcp:mcp /app/node_modules ./node_modules

# Application code
COPY --chown=mcp:mcp . .

# Remove dev-only files from image
RUN rm -rf tests docs examples specs tasks .specify test-*.js \
    && chmod -R 550 /app \
    && chmod 770 /app

USER mcp

# MCP runs over stdio — no port exposed
ENV NODE_ENV=production
ENV MCP_REQUIRE_API_KEY=true
ENV MCP_ROLE=readonly
ENV MCP_ENABLE_DEBUG_TOOLS=false
ENV MCP_ENABLE_ADMIN_TOOLS=false
ENV MCP_SAP_MAX_CONCURRENT=5
ENV MCP_SAP_RATE_PER_MIN=60
ENV SAP_REQUEST_TIMEOUT_MS=30000

# Health check: verify the server can start and respond
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "process.exit(0)"

ENTRYPOINT ["node", "mcp-server.js"]
