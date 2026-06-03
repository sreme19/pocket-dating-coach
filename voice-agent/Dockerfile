# Verified Vibe AI Bestie voice agent worker.
FROM node:22-slim

# Some LiveKit native deps + audio resampling need these at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev || npm install

COPY . .

# LiveKit Agents worker connects out to LiveKit Cloud; no inbound port needed.
ENV NODE_ENV=production
CMD ["node", "--import", "tsx", "src/agent.ts", "start"]
