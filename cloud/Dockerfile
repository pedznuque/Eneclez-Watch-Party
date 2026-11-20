FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci --omit=dev
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev
COPY client/torrent-service.cjs ./client/
COPY client/src ./client/src
COPY server/cloud-cache.cjs server/cloud-worker.cjs ./server/
RUN mkdir /cache && chown node:node /cache
USER node
ENV PORT=3100 CLOUD_CACHE_PATH=/cache
EXPOSE 3100
VOLUME ["/cache"]
CMD ["node", "server/cloud-worker.cjs"]
