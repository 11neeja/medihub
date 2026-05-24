# MediHub

MediHub is a full-stack medical learning and collaboration platform built with Next.js 14, Express, Prisma, PostgreSQL, and Socket.IO.

## What Changed

This version moves the backend from MongoDB/Mongoose to PostgreSQL with Prisma and Docker-based local database setup.

- PostgreSQL replaces MongoDB as the main database
- Prisma is used for schema management, queries, and migrations
- Docker Compose is provided for local PostgreSQL startup
- The frontend UI has been refreshed with a cleaner landing page, updated navigation, responsive cards, and a more polished visual system
- Real-time chat, notifications, AI assistant, notebook, events, groups, opportunities, and feed features are wired into the current app structure

## Product Overview

MediHub brings together the tools medical students, doctors, researchers, and educators need in one place:

- News feed and curated medical updates
- Events discovery and event participation
- Notebook workspace for notes, files, and tasks
- Community feed for posts and discussion
- Groups and conversations for collaboration
- Real-time chat and notifications
- AI assistant for document summaries and study help
- Opportunities and applications for career growth

## Tech Stack

### Frontend

- Next.js 14 with App Router
- React 18
- TypeScript
- Tailwind CSS
- Context-based state management
- Socket.IO client

### Backend

- Node.js
- Express.js
- PostgreSQL
- Prisma ORM
- Socket.IO
- JWT authentication
- File uploads and document extraction support

## Project Structure

- `frontend/` - Next.js application and UI
- `backend/` - Express API, Prisma schema, migrations, and server logic
- `docker-compose.yml` - Local PostgreSQL container

## Requirements

- Node.js 18+ recommended
- npm
- Docker Desktop or another Docker runtime

## Environment Setup

Create a `backend/.env` file with values similar to the following:

```env
DATABASE_URL="postgresql://medihub:medihub_secret@localhost:5433/medihub?schema=public"
JWT_SECRET="your_secret_key"
PORT=5000
```

## Run Locally

### 1. Start PostgreSQL with Docker

```bash
docker compose up -d
```

This starts the PostgreSQL container defined in `docker-compose.yml`.

### 2. Install dependencies

From the repository root:

```bash
npm run install:all
```

Or install each app separately:

```bash
cd frontend && npm install
cd ../backend && npm install
```

### 3. Prepare Prisma

From the `backend/` folder:

```bash
npx prisma generate
npx prisma migrate dev
```

If you only need to apply existing migrations in a deployment-style flow, use:

```bash
npx prisma migrate deploy
```

### 4. Start both apps

From the repository root:

```bash
npm run dev
```

This runs the backend on `http://localhost:5000` and the frontend on `http://localhost:3000`.

## Available Scripts

### Root

- `npm run install:all` - install frontend and backend dependencies
- `npm run dev:frontend` - start the frontend only
- `npm run dev:backend` - start the backend only
- `npm run dev` - run both apps together

### Frontend

- `npm run dev` - start Next.js in development mode
- `npm run build` - build the frontend
- `npm run start` - start the production build
- `npm run lint` - lint the frontend

### Backend

- `npm run dev` - start the Express server with nodemon
- `npm start` - start the Express server

## UI Updates

The current frontend includes a more polished interface across the app:

- Updated landing page with stronger branding, hero sections, and feature panels
- Refined navigation with app shortcuts and notification handling
- Improved color system, typography, spacing, and card styling
- Responsive layouts for desktop and mobile
- Dedicated pages for home, feed, events, groups, chat, notebook, assistant, opportunities, login, and signup
- Better visual treatment for the AI assistant and community tools

## Core Features

- Medical news browsing
- Event discovery and participation
- Notebook and task management
- Social feed and post interactions
- Groups and thread-based collaboration
- Direct chat and conversation rooms
- Notifications and join request handling
- AI assistant for document upload, summarization, and study help
- Opportunities and application tracking

## Backend API Surface

The backend exposes routes for:

- Users
- Posts
- Notes
- Tasks
- Events
- Documents
- AI assistant
- Chat
- Notifications
- News
- Opportunities
- Groups

## Database Notes

Prisma is the source of truth for the schema in `backend/prisma/schema.prisma`.

- PostgreSQL is the active database provider
- Relations are modeled through Prisma instead of Mongoose collections
- Migrations live under `backend/prisma/migrations/`
- The backend connects to PostgreSQL through Prisma on startup

## Next Improvements

Potential production follow-ups:

- Add deployment-specific environment files and secrets handling
- Harden authentication and session management
- Add file storage backed by cloud object storage
- Expand validation and error handling
- Add CI checks for Prisma migrations and frontend linting
- Deploy the frontend and backend with managed PostgreSQL
