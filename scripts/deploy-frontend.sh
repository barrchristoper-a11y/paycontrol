#!/bin/bash
set -e

echo "🚀 Deploying PayControl Frontend to Vercel..."

# Navigate to frontend directory
cd frontend

# Install dependencies (if any)
npm install

# Deploy to Vercel
vercel --prod --confirm

echo "✅ Frontend deployed successfully!"