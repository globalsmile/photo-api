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
- [Postman Collection](#postman-collection)  
- [Optional Frontend Demo](#optional-frontend-demo)  
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
## In‑Memory Store & Deduplication
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
This ensures no duplicate IDs are stored.

