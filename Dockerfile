# Prometheus, self-hosted: one image, one process, one SQLite file.
#
#   docker build -t prometheus .
#   docker run -p 8080:8080 -v prometheus:/data prometheus
#
# The volume is the whole of the deployment's state. Nothing else in the image is worth
# keeping, and exporting the Household is the backup for anyone who would rather not
# think about volumes at all.

# SQLite is a C library, so somewhere it has to be compiled. Here, and only here — the
# image that ends up running carries the result and not the toolchain.
FROM node:22-bookworm-slim AS deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /prometheus
COPY package.json package-lock.json ./

FROM deps AS build
RUN npm ci
COPY . .
RUN npm run build:self-hosted

FROM deps AS runtime
RUN npm ci --omit=dev && npm cache clean --force

# Only what it takes to run: the built app, the bundled server, and the one dependency
# that is not bundled because it is not JavaScript.
FROM node:22-bookworm-slim AS prometheus
ENV NODE_ENV=production
WORKDIR /prometheus
COPY package.json ./
COPY --from=runtime /prometheus/node_modules ./node_modules
COPY --from=build /prometheus/dist ./dist
COPY --from=build /prometheus/dist-server ./dist-server

ENV PROMETHEUS_DATABASE=/data/prometheus.db
ENV PROMETHEUS_APP=/prometheus/dist
ENV PORT=8080

RUN mkdir -p /data && chown -R node:node /data
USER node
VOLUME /data
EXPOSE 8080
CMD ["node", "dist-server/main.js"]
