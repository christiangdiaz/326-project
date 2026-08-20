# syntax=docker/dockerfile:1

# Two stages so the image that ships does not contain Jest, ESLint, Tailwind
# or the sources they operate on.

FROM node:22-alpine AS build

WORKDIR /app

# Copied before the sources so a change to application code does not
# invalidate the cached dependency install.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# The stylesheet and the vendored htmx bundle are committed, but building them
# here means the image is correct even if someone forgot to run the build
# before committing.
RUN npm run build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/public ./public
COPY --from=build /app/views ./views
COPY --from=build /app/app.js /app/server.js /app/seed.js /app/sessions.js ./
COPY --from=build /app/config ./config
COPY --from=build /app/constants ./constants
COPY --from=build /app/controllers ./controllers
COPY --from=build /app/lib ./lib
COPY --from=build /app/middleware ./middleware
COPY --from=build /app/models ./models
COPY --from=build /app/repositories ./repositories
COPY --from=build /app/routes ./routes
COPY --from=build /app/services ./services

# The node image ships an unprivileged `node` user. Running as root means a
# remote code execution bug is a root shell rather than a contained one.
USER node

EXPOSE 3000

# Uses the app's own /health route, so an unhealthy container is one that
# cannot answer for its database rather than one whose process merely exists.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# No npm in front of node: npm does not forward SIGTERM, so the graceful
# shutdown in server.js would never run.
CMD ["node", "server.js"]
