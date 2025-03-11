# OpenSeaMap Proxy Server

This is a simple proxy server for OpenSeaMap WMS and API requests. It helps to avoid CORS issues when making requests to OpenSeaMap services from a web browser.

## Features

- Proxies requests to OpenSeaMap depth WMS service (10m and 100m resolutions)
- Proxies requests to OpenSeaMap harbor API
- Adds proper headers to requests
- Handles caching
- Provides error handling

## API Endpoints

- `GET /api/health` - Health check endpoint
- `GET /api/depth/10m` - Proxy for 10m depth data
  - Query parameters: `width`, `height`, `bbox`
- `GET /api/depth/100m` - Proxy for 100m depth data
  - Query parameters: `width`, `height`, `bbox`
- `GET /api/harbors` - Proxy for harbor data
  - Query parameters: `b`, `t`, `l`, `r`, `ucid`, `maxSize`, `zoom`

## Installation

```bash
# Install dependencies
npm install

# Start the server
npm start

# Start the server with auto-reload (development)
npm run dev
```

## Usage

The server runs on port 3000 by default. You can change this by setting the `PORT` environment variable.

Example requests:

```
# Health check
curl http://localhost:3000/api/health

# Depth data (10m)
curl "http://localhost:3000/api/depth/10m?width=256&height=256&bbox=-20037508.34,-20037508.34,20037508.34,20037508.34"

# Depth data (100m)
curl "http://localhost:3000/api/depth/100m?width=256&height=256&bbox=-20037508.34,-20037508.34,20037508.34,20037508.34"

# Harbor data
curl "http://localhost:3000/api/harbors?b=53.65&t=54.36&l=5.66&r=10.09"
```
