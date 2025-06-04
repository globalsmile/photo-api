// __tests__/photos.test.js

/**
 * Tests for GET /photos endpoint in our plain‐Node API.
 * Uses Jest + Supertest to make HTTP requests directly against our server.
 */

const http = require('http');
//const fetch = require('node-fetch'); // only to verify in‐memory store population
const supertest = require('supertest');

// Import the server (assuming index.js exports the http.Server instance)
let server;
let request;

beforeAll(() => {
  // Require the index.js AFTER setting any environment vars (if needed).
  // Our index.js starts listening immediately, so capture that instance.
  server = require('../index'); // index.js should `module.exports = server;`
  request = supertest(server);
});

afterAll((done) => {
  // Close the server after tests complete
  if (server.fetchIntervalId) {
    clearInterval(server.fetchIntervalId);
  }
  server.close(done);
});

describe('Photo API Integration Tests', () => {
  // Wait up to 10s for the initial fetch to populate the in‐memory store
  beforeAll(async () => {
    // Poll until photoStore.size > 0 or timeout
    const maxRetries = 20;
    let retries = 0;
    while (retries < maxRetries) {
      // We assume index.js attaches photoStore to server.photoStore for testing
      const photoStore = server.photoStore;
      if (photoStore && photoStore.size > 0) break;
      await new Promise((r) => setTimeout(r, 500));
      retries++;
    }
  }, 15000);

  test('GET /photos → default pagination (limit=10, page=1)', async () => {
    const res = await request.get('/photos').expect(200).expect('Content-Type', /json/);
    expect(res.body).toHaveProperty('status', 200);
    expect(res.body).toHaveProperty('message', 'OK');
    expect(res.body.data).toHaveProperty('photos');
    expect(Array.isArray(res.body.data.photos)).toBe(true);
    expect(res.body.data.photos.length).toBeLessThanOrEqual(10);
    expect(res.body.data).toHaveProperty('page', 1);
    expect(res.body.data).toHaveProperty('limit', 10);
    expect(res.body.data).toHaveProperty('total');
    expect(typeof res.body.data.total).toBe('number');
  });

  test('GET /photos?limit=5&page=2 → correct slicing', async () => {
    // First, fetch all photos in‐memory to check ordering by ID
    const allRes = await request.get('/photos?limit=10000').expect(200);
    const allPhotos = allRes.body.data.photos;
    const total = allRes.body.data.total;

    // Now fetch page 2 with limit 5
    const res = await request.get('/photos?limit=5&page=2').expect(200);
    const { photos, page, limit } = res.body.data;

    expect(page).toBe(2);
    expect(limit).toBe(5);
    expect(photos.length).toBe(5);

    // Compare against slice from allPhotos
    const expectedSlice = allPhotos.slice(5, 10).map((p) => p.id);
    const resultSlice = photos.map((p) => p.id);
    expect(resultSlice).toEqual(expectedSlice);
    expect(res.body.data.total).toBe(total);
  });

  test('GET /photos?orderBy=title:asc → sorted ascending by title', async () => {
    const res = await request.get('/photos?orderBy=title:asc&limit=15').expect(200);
    const photos = res.body.data.photos;
    // Check that titles are in ascending alphabetical order
    for (let i = 1; i < photos.length; i++) {
      expect(photos[i - 1].title <= photos[i].title).toBe(true);
    }
  });

  test('GET /photos?orderBy=id:desc → sorted descending by id', async () => {
    const res = await request.get('/photos?orderBy=id:desc&limit=10').expect(200);
    const photos = res.body.data.photos;
    for (let i = 1; i < photos.length; i++) {
      expect(photos[i - 1].id >= photos[i].id).toBe(true);
    }
  });

  test('GET /photos?page=9999 → out‐of‐range returns empty array', async () => {
    // Use a very high page number
    const res = await request.get('/photos?limit=10&page=9999').expect(200);
    expect(Array.isArray(res.body.data.photos)).toBe(true);
    expect(res.body.data.photos.length).toBe(0);
  });

  test('GET /nonexistent → 404 JSON response', async () => {
    const res = await request.get('/nonexistent').expect(404);
    expect(res.body).toEqual({
      status: 404,
      message: 'Not Found',
      data: {}
    });
  });
});
