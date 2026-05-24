# MediHub - Full Stack Medical Platform Prototype

A full-stack medical hub application built with Next.js 14 (App Router), TypeScript, and MongoDB.

## Features

- **News Feed**: Browse and filter medical news by specialty
- **Events**: View, register, and host medical events
- **Notebook**: Organize study notes, files, and tasks by subject
- **Global Feed**: Share posts and connect with medical professionals
- **Groups**: Join specialty groups, create threads, and participate in discussions
- **Chat**: Real-time messaging with individuals and groups
- **AI Assistant**: Get study help and PDF summaries, save responses to notebook

## Project Structure

- **frontend/** - Next.js 14 frontend application with App Router
- **backend/** - Express.js REST API with MongoDB

## Tech Stack

### Frontend
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Context API for state management

### Backend
- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT Authentication

## How to Run

### Frontend Setup

1. Navigate to frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Initialize Tailwind CSS (if needed):
   ```bash
   npx tailwindcss init -p
   ```

4. Run development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

### Backend Setup

1. Navigate to backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file with:
   ```
   MONGODB_URI=mongodb://localhost:27017/medihub
   JWT_SECRET=your_secret_key
   PORT=5000
   ```

4. Start MongoDB server

5. Run development server:
   ```bash
   npm run dev
   ```

## Features Implementation

All features use local state and mock data - no database required for the prototype.

- **Authentication**: Simple login/logout toggle (no real auth)
- **Data Storage**: React Context API and component state
- **Mock Data**: Hardcoded arrays of sample medical data
- **Navigation**: Next.js App Router with client-side navigation
- **Responsive**: Tailwind CSS for mobile-friendly design

## API Endpoints (Backend)

- `POST /api/users/register` - Register new user
- `POST /api/users/login` - Login user
- `GET /api/users` - Get all users (protected)

## Next Steps

To make this production-ready:
1. Connect to real MongoDB database
2. Implement proper authentication with NextAuth.js
3. Add real-time features with Socket.io
4. Integrate actual AI API (OpenAI, etc.)
5. Add file upload to cloud storage
6. Implement proper form validation
7. Add loading states and error handling
8. Deploy to Vercel/Railway
