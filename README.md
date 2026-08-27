<img src="public/images/logo_solid.png" alt="File Host" width="100%">

# File Host

A lightweight, self-hosted file hosting system built with Node.js, Express, and SQLite. Upload, organize, preview, and manage your files and folders through a clean, responsive web interface — no external accounts or cloud services required.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Reference](#api-reference)
  - [Files](#files)
  - [Folders](#folders)
- [Building for Production](#building-for-production)
- [Deployment](#deployment)
- [Database Schema](#database-schema)
- [Contributing](#contributing)
- [License](#license)

## Overview

File Host is a minimal file management application that lets you store files on your own server and browse them from any device. It supports drag-and-drop uploads, nested folders, file renaming, and bulk operations (move, download, delete). Files are stored on disk, and metadata is kept in a local SQLite database.

The application is designed to be easy to deploy on any Node.js hosting platform (Heroku, Render, Railway, Netlify, or a VPS) with zero configuration beyond installing dependencies.

## Features

- **File uploads** — Drag-and-drop or click-to-select, single or multiple files at once (up to 10 per request).
- **File size limit** — Configurable 50 MB per file by default.
- **Accepted file types** — Images (jpeg, jpg, png, gif, webp, svg), PDFs, video (mp4), audio (mp3), archives (zip), and documents (txt, doc, docx).
- **Folders** — Create, rename, and delete nested folders to organize files.
- **Move files** — Move individual or multiple files between folders.
- **Rename files** — Set a custom display name while keeping the original file association.
- **Grid & list views** — Toggle between a visual grid and a compact list layout.
- **Search** — Live filtering of files by name.
- **Bulk selection** — Select multiple files to move, download, or delete in a batch.
- **File preview / details** — View file metadata, open/download, and manage from a detail modal.
- **Responsive UI** — Works on desktop and mobile, with a mobile-friendly PWA setup (manifest + service worker).
- **Lightweight** — No external database server; everything runs on SQLite via `better-sqlite3`.

## Tech Stack

| Layer        | Technology |
|--------------|------------|
| Backend      | Node.js, Express 5 |
| Database     | SQLite (better-sqlite3) |
| File uploads | Multer |
| IDs          | UUID |
| Frontend     | Vanilla HTML/CSS/JS, Bootstrap Icons |
| PWA assets   | Service Worker, Web App Manifest |
| Build tool   | esbuild (CSS/JS minification) |

## Project Structure

```
File-Host/
├── server.js             # Express server, API routes, upload handling
├── database.js           # SQLite connection and schema initialization
├── build.js              # esbuild-based production build (minify CSS/JS)
├── package.json          # Dependencies and scripts
├── netlify.toml          # Netlify static rewrite config
├── render.yaml           # Render.com deployment config
├── railway.json          # Railway deployment config
├── Procfile              # Heroku-style start command
├── public/               # Static frontend
│   ├── index.html        # Main SPA markup
│   ├── css/style.css     # Styles
│   ├── js/app.js         # Frontend logic (API client, UI)
│   ├── images/           # Logo assets (logo.png, logo_solid.png, logo_app.png)
│   ├── favicon.svg
│   ├── manifest.json
│   └── sw.js             # Service worker
├── uploads/              # Uploaded files (git-ignored, created at runtime)
└── filehost.db           # SQLite database (git-ignored, created at runtime)
```

## Requirements

- **Node.js** 18 or newer (uses `node --watch` for development).
- **npm** (bundled with Node.js).

No external services or API keys are required.

## Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd File-Host
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the server:

   ```bash
   npm start
   ```

4. Open your browser and visit:

   ```
   http://localhost:3000
   ```

The `uploads/` directory and `filehost.db` SQLite database are created automatically on first run.

## Configuration

| Environment Variable | Default | Description |
|----------------------|---------|-------------|
| `PORT`               | `3000`  | Port the server listens on. |
| `NODE_ENV`           | `development` | Set to `production` for production mode. |

The maximum upload size is defined in `server.js` (`50 * 1024 * 1024` bytes = 50 MB). To change it, edit the `limits.fileSize` value in the `multer` configuration.

The allowed file types are defined by the `allowed` regular expression and MIME-type checks in `server.js`. Extend them there to support additional formats.

## Usage

### Uploading files
- Click the **Subir** (Upload) button and drop files into the upload zone, or click to select them.
- Optionally set a custom name and choose a destination folder.
- Click **Subir Archivo(s)** to confirm.

### Managing folders
- Click **Carpeta** (Folder) to create a new folder.
- Navigate into folders by clicking them; use the breadcrumb bar to go back.

### Organizing and acting on files
- Switch between **grid** and **list** views using the toggle in the toolbar.
- Use the search box to filter files by name.
- Select files (checkbox / batch mode) to move, download, or delete them in bulk.
- Open a file's detail modal to preview, rename, move, download, or delete it individually.

## API Reference

All responses are JSON. Errors return an object of the form `{ "error": "message" }`.

### Files

| Method   | Endpoint                  | Description |
|----------|---------------------------|-------------|
| `GET`    | `/api/files`              | List all files. Optional query `?folder_id=<id>` to filter by folder (`folder_id=null` for root). |
| `GET`    | `/api/files/:id`          | Get a single file by ID. |
| `POST`   | `/api/files`              | Upload one or more files (`multipart/form-data`, field name `files`, max 10). Optional `folder_id` and `custom_name` in body. |
| `DELETE` | `/api/files/:id`          | Delete a file (removes the record and the file from disk). |
| `PUT`    | `/api/files/:id/rename`   | Rename a file. Body: `{ "custom_name": "New Name" }`. |
| `PUT`    | `/api/files/:id/move`     | Move a file to a folder. Body: `{ "folder_id": "<id>" }` (or `null` for root). |

**Example upload:**

```bash
curl -F "files=@/path/to/image.png" \
     -F "folder_id=" \
     http://localhost:3000/api/files
```

### Folders

| Method   | Endpoint                      | Description |
|----------|-------------------------------|-------------|
| `GET`    | `/api/folders`                | List all folders. Optional query `?parent_id=<id>` to filter by parent (`parent_id=null` for root). |
| `POST`   | `/api/folders`                | Create a folder. Body: `{ "name": "Folder", "parent_id": "<id>" }`. |
| `PUT`    | `/api/folders/:id/rename`     | Rename a folder. Body: `{ "name": "New Name" }`. |
| `DELETE` | `/api/folders/:id`            | Delete a folder. Files inside are moved to the root (not deleted). |

## Building for Production

A production build minifies the CSS and JS using esbuild and outputs to `dist/`:

```bash
npm run build
```

Note that `build.js` is configured to bundle `public/css/style.css` and `public/js/app.js`. The server itself (`server.js`) serves the `public/` directory directly; adjust the static path if you intend to serve from `dist/`.

Run in production mode with:

```bash
npm run start:prod
```

## Deployment

The repository includes ready-made configuration for several platforms:

- **Render** — `render.yaml` runs `npm install` and `node server.js`.
- **Railway** — `railway.json` uses Nixpacks and health-checks `/api/files`.
- **Heroku** — `Procfile` with `web: node server.js`.
- **Netlify** — `netlify.toml` publishes `public/` and rewrites all routes to `index.html` (useful for the static front end; the API requires a Node server backend).

Make sure the platform sets `NODE_ENV=production` and exposes the `PORT` environment variable.

> Note: Because uploaded files and the SQLite database are stored on the local filesystem, use a platform with persistent storage, or mount a volume, to avoid losing data between deploys.

## Database Schema

The SQLite database (`filehost.db`) contains two tables:

**folders**
| Column     | Type    | Notes |
|------------|---------|-------|
| `id`       | TEXT    | Primary key (UUID). |
| `name`     | TEXT    | Folder name (required). |
| `parent_id`| TEXT    | Parent folder ID (nullable, self-referencing FK). |
| `created_at` | TEXT  | Timestamp (defaults to current UTC time). |

**files**
| Column         | Type    | Notes |
|----------------|---------|-------|
| `id`           | INTEGER | Auto-increment primary key. |
| `filename`     | TEXT    | Stored filename on disk (UUID + extension). |
| `original_name`| TEXT    | Original uploaded filename. |
| `mimetype`     | TEXT    | File MIME type. |
| `size`         | INTEGER | File size in bytes. |
| `folder_id`    | TEXT    | Folder the file belongs to (nullable). |
| `custom_name`  | TEXT    | Optional display name. |
| `created_at`   | TEXT    | Timestamp (added automatically by better-sqlite3 defaults). |

The schema is created/updated automatically on startup in `database.js`.

## Contributing

1. Fork the repository and create a feature branch.
2. Install dependencies with `npm install`.
3. Run the dev server with `npm run dev` (auto-restarts on changes).
4. Submit a pull request describing your changes.

## License

This project is licensed under the [ISC License](LICENSE).
<!-- achv: pr 1 -->
