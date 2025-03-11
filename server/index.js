const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());

// Basic middleware for logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Proxy endpoint for depth data (10m)
app.get('/api/depth/10m', async (req, res) => {
  try {
    // Get query parameters from the request
    const { width, height, bbox } = req.query;
    
    if (!width || !height || !bbox) {
      return res.status(400).json({ 
        error: 'Missing required parameters. Please provide width, height, and bbox.' 
      });
    }
    
    // Construct the WMS URL
    const wmsUrl = `https://depth.openseamap.org/geoserver/openseamap/wms?SERVICE=WMS&VERSION=1.1.0&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true&LAYERS=openseamap:tracks_10m&SRS=EPSG:3857&STYLES=&WIDTH=${width}&HEIGHT=${height}&BBOX=${bbox}`;
    
    // Make the request to the WMS server with the required headers
    const response = await axios.get(wmsUrl, {
      responseType: 'arraybuffer',
      headers: {
        'accept': 'image/png',
        'accept-language': 'en-US,en;q=0.9',
        'referer': 'https://map.openseamap.org/',
        'sec-fetch-dest': 'image',
        'sec-fetch-mode': 'no-cors',
        'sec-fetch-site': 'same-site',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
      }
    });
    
    // Set the appropriate headers for the response
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    
    // Send the image data
    res.send(response.data);
  } catch (error) {
    console.error('Error proxying depth 10m request:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch depth data',
      details: error.message
    });
  }
});

// Proxy endpoint for depth data (100m)
app.get('/api/depth/100m', async (req, res) => {
  try {
    // Get query parameters from the request
    const { width, height, bbox } = req.query;
    
    if (!width || !height || !bbox) {
      return res.status(400).json({ 
        error: 'Missing required parameters. Please provide width, height, and bbox.' 
      });
    }
    
    // Construct the WMS URL
    const wmsUrl = `https://depth.openseamap.org/geoserver/openseamap/wms?SERVICE=WMS&VERSION=1.1.0&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true&LAYERS=openseamap:tracks_100m&SRS=EPSG:3857&STYLES=&WIDTH=${width}&HEIGHT=${height}&BBOX=${bbox}`;
    
    // Make the request to the WMS server with the required headers
    const response = await axios.get(wmsUrl, {
      responseType: 'arraybuffer',
      headers: {
        'accept': 'image/png',
        'accept-language': 'en-US,en;q=0.9',
        'referer': 'https://map.openseamap.org/',
        'sec-fetch-dest': 'image',
        'sec-fetch-mode': 'no-cors',
        'sec-fetch-site': 'same-site',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
      }
    });
    
    // Set the appropriate headers for the response
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    
    // Send the image data
    res.send(response.data);
  } catch (error) {
    console.error('Error proxying depth 100m request:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch depth data',
      details: error.message
    });
  }
});

// Proxy for harbor data
app.get('/api/harbors', async (req, res) => {
  try {
    // Get query parameters from the request
    const { b, t, l, r, ucid = '2', maxSize = '4', zoom = '10' } = req.query;
    
    if (!b || !t || !l || !r) {
      return res.status(400).json({ 
        error: 'Missing required parameters. Please provide b, t, l, and r (bounds).' 
      });
    }
    
    // Construct the harbor API URL
    const harborUrl = `https://harbour.openseamap.org/getHarbours.php?b=${b}&t=${t}&l=${l}&r=${r}&ucid=${ucid}&maxSize=${maxSize}&zoom=${zoom}`;
    
    // Make the request to the harbor API
    const response = await axios.get(harborUrl, {
      headers: {
        'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'referer': 'https://map.openseamap.org/',
        'origin': 'https://map.openseamap.org',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
      }
    });
    
    // Set the appropriate headers for the response
    res.set('Content-Type', 'text/javascript');
    res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    
    // Send the harbor data
    res.send(response.data);
  } catch (error) {
    console.error('Error proxying harbor request:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch harbor data',
      details: error.message
    });
  }
});

// Fallback route
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`OpenSeaMap proxy server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Depth 10m: http://localhost:${PORT}/api/depth/10m?width=256&height=256&bbox=...`);
  console.log(`Depth 100m: http://localhost:${PORT}/api/depth/100m?width=256&height=256&bbox=...`);
  console.log(`Harbors: http://localhost:${PORT}/api/harbors?b=53.65&t=54.36&l=5.66&r=10.09`);
});
