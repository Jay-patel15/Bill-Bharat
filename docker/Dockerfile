# ============================================================
# BillBharat — Production Dockerfile
# Node 20 LTS, multi-stage build, non-root user
# ============================================================

# -----------------------------------------------------------
# Stage 1: Install dependencies
# -----------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

# Install libc6-compat for Alpine compatibility with some npm packages
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# -----------------------------------------------------------
# Stage 2: Build the Next.js application
# -----------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate a dummy .env so Next.js build doesn't fail on missing NEXT_PUBLIC_* vars.
# Real env vars are injected at runtime via docker-compose.
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# -----------------------------------------------------------
# Stage 3: Production runtime image
# -----------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy built output
COPY --from=builder /app/public           ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static     ./.next/static

# Copy scripts and database files
COPY --from=builder /app/scripts          ./scripts
COPY --from=builder /app/database         ./database

# Create uploads directory (fallback local storage)
RUN mkdir -p public/uploads && chown -R nextjs:nodejs public/uploads

# Use non-root user
USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Health check — calls the /api/health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
