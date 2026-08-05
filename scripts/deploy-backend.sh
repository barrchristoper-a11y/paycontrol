#!/bin/bash
set -e

echo "🚀 Deploying PayControl Backend to Render..."

# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Deploy to Render
# Note: This assumes you have the Render CLI installed and configured
# For now, we'll just push to GitHub (Render auto-deploys)
git add .
git commit -m "Deploy to production"
git push origin main

echo "✅ Backend deployed successfully!"
echo "   (Render will auto-deploy from GitHub)"