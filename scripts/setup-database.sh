#!/bin/bash
set -e

echo "🚀 Setting up PayControl Database on Neon..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL environment variable not set!"
  echo "   Please set it to your Neon connection string."
  exit 1
fi

# Run schema
psql $DATABASE_URL -f database/schema.sql

# Seed demo data (optional)
read -p "Seed demo data? (y/n): " -n 1 -r
if [[ $REPLY =~ ^[Yy]$ ]]; then
  psql $DATABASE_URL -f database/seeders/demoData.sql
  echo "✅ Demo data seeded!"
fi

echo "✅ Database setup complete!"