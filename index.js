/**
 * index.js
 *
 * - Periodically (every 1 minute) fetches from JSONPlaceholder /photos
 * - Stores in a simple in‑memory Map, keyed by photo.id (ensures no duplicates)
 * - Exposes a bare‑bones HTTP server on port 3000
 *   with `/photos` endpoint for pagination and sorting.
 *
 * Usage: `node index.js`
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const url = require('url');

// ─────────────────────────────────────────────────────────────────────────────
// In‑memory store: Map< Number, PhotoObject >
// We use a Map to easily check for duplicate IDs.
const photoStore = new Map();

// Fetch interval (in ms)
const FETCH_INTERVAL = 60 * 1000; // 1 minute

// JSONPlaceholder URL for photos
const PHOTOS_URL = 'https://jsonplaceholder.typicode.com/photos';

// PORT for HTTP API
const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────────────────────────────────────
// 1) Periodic fetch + merge into in‑memory store

/**
 * Fetches the full array of photos from JSONPlaceholder.
 * Returns a Promise that resolves to an array of photo objects.
 */
function fetchPhotos() {
  return new Promise((resolve, reject) => {
    https
      .get(PHOTOS_URL, (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(rawData);
            if (Array.isArray(parsed)) {
              resolve(parsed);
            } else {
              reject(new Error('Unexpected response format'));
            }
          } catch (err) {
            reject(err);
          }
        });
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}

/**
 * Merges the newly fetched photos into `photoStore`, skipping duplicates.
 */
async function updatePhotoStore() {
  try {
    const photos = await fetchPhotos();
    let addedCount = 0;

    for (const photo of photos) {
      // photo.id is assumed unique
      if (!photoStore.has(photo.id)) {
        photoStore.set(photo.id, photo);
        addedCount++;
      }
    }

    console.log(
      `[${new Date().toISOString()}] Fetched ${photos.length} photos, added ${addedCount} new. Total in store: ${photoStore.size}`
    );
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error fetching photos:`, err);
  }
}

// Immediately run once, then schedule every minute
updatePhotoStore();
setInterval(updatePhotoStore, FETCH_INTERVAL);
const fetchIntervalId = setInterval(updatePhotoStore, FETCH_INTERVAL);

// ─────────────────────────────────────────────────────────────────────────────
// 2) HTTP Server with /photos endpoint (pagination + sorting)

const server = http.createServer((req, res) => {
  // Only handle GET /photos
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
    // Serve ./public/index.html
    const filePath = path.join(__dirname, 'public', 'index.html');
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500);
        return res.end('Error loading index.html');
      }
      res.writeHead(200, {
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(data);
    });
    return;
  }

  if (req.method === 'GET' && pathname === '/photos') {
    handleGetPhotos(req, res, parsedUrl.query);
  } else {
    // 404 for anything else
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 404,
        message: 'Not Found',
        data: {}
      })
    );
  }
});

/**
 * Handles GET /photos?limit=&page=&orderBy=field:asc|desc
 */
function handleGetPhotos(req, res, query) {
  // 1) Extract query params
  // Default limit=10, page=1
  const limit = parseInt(query.limit, 10) >= 1 ? parseInt(query.limit, 10) : 10;
  const page = parseInt(query.page, 10) >= 1 ? parseInt(query.page, 10) : 1;
  const orderByRaw = query.orderBy || '';
  // Default: no sorting (i.e. insertion order or ID order)

  // 2) Convert Map values to array
  let allPhotos = Array.from(photoStore.values());

  // 3) Sorting if requested
  // orderBy=field:asc or field:desc
  if (orderByRaw) {
    const [field, direction] = orderByRaw.split(':');
    if (field && (direction === 'asc' || direction === 'desc')) {
      allPhotos.sort((a, b) => {
        // if field doesn’t exist, treat as equal
        if (!(field in a) || !(field in b)) return 0;
        if (a[field] < b[field]) return direction === 'asc' ? -1 : 1;
        if (a[field] > b[field]) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
  }

  // 4) Pagination
  const total = allPhotos.length;
  const startIdx = (page - 1) * limit;
  const endIdx = startIdx + limit;
  const pagedPhotos = allPhotos.slice(startIdx, endIdx);

  // 5) Build response object
  const responseObj = {
    status: 200,
    message: 'OK',
    data: {
      photos: pagedPhotos,
      page,
      limit,
      total
    }
  };

  // 6) Send JSON
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*' // <— allow all origins for simplicity
  });
  res.end(JSON.stringify(responseObj));
}

// Start listening
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
server.photoStore = photoStore;
server.fetchIntervalId = fetchIntervalId;
module.exports = server;
