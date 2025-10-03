#!/bin/bash
# deploy-railway.sh - Deploy backend to Railway

echo "🚀 Deploying Chalocab Backend to Railway..."
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Install it first:"
    echo "   npm install -g @railway/cli"
    exit 1
fi

# Login check
echo "🔐 Checking Railway login..."
railway whoami || {
    echo "Please login to Railway first:"
    railway login
}

# Deploy
echo ""
echo "📦 Deploying to Railway..."
railway up

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Set environment variables in Railway dashboard:"
echo "   - SUPABASE_URL"
echo "   - SUPABASE_SERVICE_ROLE_KEY"
echo "   - JWT_SECRET"
echo "   - MSG91_AUTH_KEY"
echo "   - MSG91_WIDGET_ID"
echo ""
echo "2. Update Flutter config.dart forceRailway = true to test"
echo ""
echo "🌐 Check your deployment at: https://railway.app/dashboard"
