# Photo API: In‑Memory Data Fetching & Pagination Service

A minimal, framework‑free Node.js service that:

1. **Periodically fetches** photo data from [JSONPlaceholder `/photos`](https://jsonplaceholder.typicode.com/photos) every 60 seconds.  
2. **Deduplicates** incoming data by `id` in an in‑memory store (`Map`).  
3. Exposes a simple HTTP endpoint (`GET /photos`) supporting:  
   - **Pagination** with `limit` and `page` query parameters  
   - **Sorting** with `orderBy=field:asc|desc`  
4. Includes a **Jest + Supertest** test suite to verify functionality.  
5. Provides a **Postman collection** with example requests and responses.  
6. Demonstrates an optional **HTML+JS frontend** to visualize results in a browser.

---

## Table of Contents

- [Prerequisites](#prerequisites)  
- [Installation & Setup](#installation--setup)  
- [How It Works](#how-it-works)  
  - [In‑Memory Store & Deduplication](#in‑memory-store--deduplication)  
  - [Periodic Fetch](#periodic-fetch)  
  - [HTTP Server & Endpoint](#http-server--endpoint)  
    - [Query Parameters](#query-parameters)  
    - [Sorting Logic](#sorting-logic)  
    - [Pagination Logic](#pagination-logic)  
- [Running the Server](#running-the-server)  
- [Testing with Jest & Supertest](#testing-with-jest--supertest)  
  - [Test Setup](#test-setup)  
  - [Example Test Cases](#example-test-cases)  
- [Postman Documentation](#postman-documentation)  
- [Frontend Demo](#frontend-demo)  
- [Future Enhancements](#future-enhancements)  
- [Results & Observations](#results--observations)  
- [License & Author](#license--author)  

---

## Prerequisites

- **Node.js >= 14.x** (v18.x recommended)  
- **npm** (bundled with Node.js)  
- **Internet** (to fetch remote JSON)

> Because the optional frontend uses modern JS features, Node.js 18+ is recommended.

---

## Installation & Setup

1. **Clone the repository**  
   ```bash
   git clone https://github.com/globalsmile/photo-api-assessment.git
   cd photo-api-assessment

2. **Install dependencies**
   ```bash
   npm install

3. Verify Node version
   ```bash
   node --version
   # Example: v18.16.0

If needed, use a version manager (nvm, asdf) to switch to Node 18:

   ```bash
   nvm install 18
   nvm use 18
```

## How It Works
### In‑Memory Store & Deduplication
- We maintain a global Map<number, Photo> called photoStore.

- Each photo object has shape:

    ```js
    {
      albumId: Number,
      id:       Number,       // unique key
      title:    String,
      url:      String,
      thumbnailUrl: String
    }
- On each fetch, we do:

```js
if (!photoStore.has(photo.id)) {
  photoStore.set(photo.id, photo);
}
```

This ensures no duplicate IDs are stored.

### Periodic Fetch
- On startup, we call updatePhotoStore() immediately:

```js
async function updatePhotoStore() {
  const photos = await fetchPhotos();
  photos.forEach(photo => {
    if (!photoStore.has(photo.id)) {
      photoStore.set(photo.id, photo);
    }
  });
  console.log(`[${new Date().toISOString()}] Total in store: ${photoStore.size}`);
}
```

- Then schedule it every 60 seconds:

```js
const refetchIntervalId = setInterval(updatePhotoStore, 60_000);
```
- fetchPhotos() uses Node’s https.get(...) to retrieve https://jsonplaceholder.typicode.com/photos and JSON.parse the response.

## HTTP Server & Endpoint
We use Node’s built‑in http.createServer(...) to listen on a chosen port (default 3000). The code looks like:

```js
const http = require('http');
const url = require('url');
const { fetchPhotos, photoStore, refetchIntervalId } = require('./fetcher');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  const { pathname, query } = url.parse(req.url, true);

  if (req.method === 'GET' && pathname === '/photos') {
    return handleGetPhotos(req, res, query);
  }

  // Any other route → 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 404, message: 'Not Found', data: {} }));
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Export both server and refetchIntervalId for testing cleanup
module.exports = { server, refetchIntervalId, photoStore };
```
### Query Parameters
- limit (≥1, default 10)

- page (≥1, default 1)

- orderBy in the format field:asc or field:desc

> Example: orderBy=title:asc or orderBy=id:desc

### Sorting Logic
Inside handleGetPhotos(req, res, query), we:

- Convert photoStore.values() → array allPhotos.

- If orderBy is provided (e.g. "title:asc"), we split on ":" to extract:

  - field (e.g. "title")

  - direction ("asc" or "desc")

- Sort with:

```js
allPhotos.sort((a, b) => {
  if (!(field in a) || !(field in b)) return 0;
  if (a[field] < b[field]) return direction === 'asc' ? -1 : 1;
  if (a[field] > b[field]) return direction === 'asc' ? 1 : -1;
  return 0;
});
```
### Pagination Logic
After sorting (if any), we compute:

- total = allPhotos.length

- startIdx = (page – 1) * limit

- endIdx = startIdx + limit

- pagedPhotos = allPhotos.slice(startIdx, endIdx)

- We then return JSON:

```json
{
  "status": 200,
  "message": "OK",
  "data": {
    "photos": [ /* up to `limit` items */ ],
    "page": 1,
    "limit": 10,
    "total": 5000
  }
}
```
> If startIdx ≥ total, then photos will be an empty array.

## Running the Server
- Start the service

```bash
npm start
You should see:
```
```yaml
Server running on port 3000
[2025-06-04T12:00:00.000Z] Total in store: 5000
```
> The timestamped log will repeat every 60 seconds as new fetch cycles complete.

- Manually verify by opening in your browser or using curl:

```bash
curl "http://localhost:3000/photos"
You should receive JSON similar to:
```
```json
{
  "status": 200,
  "message": "OK",
  "data": {
    "photos": [
      { "albumId": 1, "id": 1, "title": "...", "url": "https://via.placeholder.com/600/92c952", "thumbnailUrl": "https://via.placeholder.com/150/92c952" },
      /* …9 more items … */
    ],
    "page": 1,
    "limit": 10,
    "total": 5000
  }
}
```
## Testing with Jest & Supertest
We wrote an automated test suite to confirm correct behavior.

### Test Setup
- Install dev dependencies:

```bash
npm install --save-dev jest supertest
Ensure index.js exports the server, interval ID, and store:
```
```js
module.exports = { server, refetchIntervalId, photoStore };
```
- Add a test script in package.json:

```json
"scripts": {
  "start": "node index.js",
  "test": "jest"
}
```
- Create __tests__/photos.test.js:

```js
// __tests__/photos.test.js

const supertest = require('supertest');
const { server, refetchIntervalId, photoStore } = require('../index');

let request;

beforeAll(async () => {
  request = supertest(server);

  // Wait (up to 15s) for initial fetch cycle to populate photoStore
  const maxRetries = 30;
  let retries = 0;
  while (retries < maxRetries) {
    if (photoStore.size > 0) break;
    await new Promise((r) => setTimeout(r, 500));
    retries++;
  }
}, 20000);

afterAll((done) => {
  // Stop periodic fetch
  clearInterval(refetchIntervalId);
  // Close HTTP server
  server.close(done);
});

describe('GET /photos', () => {
  test('Default pagination (limit=10, page=1)', async () => {
    const res = await request.get('/photos').expect(200);
    expect(res.body.status).toBe(200);
    expect(res.body.data.photos.length).toBeLessThanOrEqual(10);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.limit).toBe(10);
    expect(typeof res.body.data.total).toBe('number');
  });

  test('Paginated: limit=5, page=2', async () => {
    const allRes = await request.get('/photos?limit=10000').expect(200);
    const allPhotos = allRes.body.data.photos;

    const res = await request.get('/photos?limit=5&page=2').expect(200);
    const { photos, page, limit, total } = res.body.data;

    expect(page).toBe(2);
    expect(limit).toBe(5);
    expect(total).toBe(allPhotos.length);
    expect(photos.length).toBe(5);
    const expectedIds = allPhotos.slice(5, 10).map((p) => p.id);
    const resultIds = photos.map((p) => p.id);
    expect(resultIds).toEqual(expectedIds);
  });

  test('Sorting: orderBy=title:asc', async () => {
    const res = await request
      .get('/photos?orderBy=title:asc&limit=15')
      .expect(200);
    const photos = res.body.data.photos;
    for (let i = 1; i < photos.length; i++) {
      expect(photos[i - 1].title <= photos[i].title).toBe(true);
    }
  });

  test('Sorting: orderBy=id:desc', async () => {
    const res = await request
      .get('/photos?orderBy=id:desc&limit=10')
      .expect(200);
    const photos = res.body.data.photos;
    for (let i = 1; i < photos.length; i++) {
      expect(photos[i - 1].id >= photos[i].id).toBe(true);
    }
  });

  test('Out-of-range page returns empty array', async () => {
    const res = await request.get('/photos?limit=10&page=9999').expect(200);
    expect(Array.isArray(res.body.data.photos)).toBe(true);
    expect(res.body.data.photos.length).toBe(0);
  });

  test('Invalid path → 404 response', async () => {
    const res = await request.get('/invalid').expect(404);
    expect(res.body).toEqual({
      status: 404,
      message: 'Not Found',
      data: {},
    });
  });
});
```
### Running Tests
```bash
npm test
```
- Expected output:

```text
 PASS  __tests__/photos.test.js
  Photo API Integration Tests
    ✓ GET /photos → default pagination (limit=10, page=1) (18 ms)
    ✓ GET /photos?limit=5&page=2 → correct slicing (23 ms)
    ✓ GET /photos?orderBy=title:asc → sorted ascending by title (23 ms)
    ✓ GET /photos?orderBy=id:desc → sorted descending by id (11 ms)
    ✓ GET /photos?page=9999 → out‐of‐range returns empty array (6 ms)
    ✓ GET /nonexistent → 404 JSON response (2 ms)

Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
Snapshots:   0 total
Time:        1.06 s, estimated 2 s
Ran all test suites.
```
## Postman Documentation
- The api was tested with Postman and documented at https://documenter.getpostman.com/view/33057863/2sB2qi8xxR

## Frontend Demo
- Check out the live demo here: https://photo-api-adjp.onrender.com/

## Future Enhancements
- Persistent Database: Replace in‑memory Map with MongoDB, PostgreSQL, etc., using upserts to avoid duplicates.

- Advanced Filtering: Support additional query parameters (e.g., albumId, title_like).

- Rate‑Limiting & Caching: Add caching layers or rate‑limit incoming requests.

- Authentication: Add a simple API key or JWT-based auth.

## Results & Observations
- Initial Fetch: Store populated with ~5000 unique photos.

- Deduplication: Subsequent fetches do not increase size (all IDs already present).

- Pagination:

  - Default request returns 10 items (IDs 1–10).

  - limit=5&page=2 returns IDs 6–10.

- Sorting:

  - orderBy=title:asc returns correct alphabetical order.

  - orderBy=id:desc returns descending ID order.

- 404 Handling: Invalid paths return proper JSON with status 404.

- Tests: Jest + Supertest suite passes without hanging (interval is cleared and server closed).

- Manual QA: Verified via Postman and optional frontend demo.

## License & Author
- Author: 0xglobalsmile

- License: MIT (feel free to reuse or adapt)

Thank you for reviewing!







