FROM node:22-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
# NEXT_PUBLIC_* vars are inlined into the client bundle at build time, not
# read at runtime — this must be the URL the user's BROWSER can reach, which
# in Docker Compose is the backend's published host port (e.g.
# http://localhost:4000), never the internal service name ("backend"): the
# browser runs outside the compose network entirely.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
