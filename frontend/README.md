# InterviewAI Frontend

This is the Next.js frontend application for the InterviewAI platform.

## Setup Instructions

Please see the **[Main Project README](../README.md)** in the root directory of this repository for comprehensive, step-by-step instructions on how to set up the entire project, including the frontend, backend API, AI service, databases, and Docker configuration.

## Quick Start (Frontend Only)

If you have already set up the backend and database, you can start the frontend development server:

1. Create a `.env.local` file:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5000/api
   NEXT_PUBLIC_WS_URL=http://localhost:5000
   ```

2. Install dependencies and start:
   ```bash
   npm install
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

