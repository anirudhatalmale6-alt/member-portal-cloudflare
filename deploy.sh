#!/usr/bin/env bash
# One-shot deploy of the member portal to YOUR Cloudflare account.
# Prereqs: Node 18+ installed. Nothing else.
#
# Usage:
#   1) npx wrangler login          # opens your browser once to authorise
#   2) bash deploy.sh
#
# It creates the D1 database, the R2 bucket, loads the schema + demo data,
# sets a session secret, and deploys the Pages project. Safe to re-run.
set -euo pipefail

PROJECT="member-portal"
DB_NAME="member-portal"
BUCKET="member-portal-invoices"

echo "==> Installing dependencies"
npm install

echo "==> Creating D1 database (ignore error if it already exists)"
npx wrangler d1 create "$DB_NAME" || true

echo
echo "  If this is the FIRST run, copy the database_id printed above into wrangler.toml"
echo "  (the line: database_id = \"...\") then re-run this script."
echo
read -r -p "Press ENTER once wrangler.toml has a real database_id..."

echo "==> Creating R2 bucket (ignore error if it already exists)"
npx wrangler r2 bucket create "$BUCKET" || true

echo "==> Applying database schema (remote)"
npx wrangler d1 execute "$DB_NAME" --remote --file=schema.sql

echo "==> Seeding demo accounts (remote)"
node gen-seed.js
npx wrangler d1 execute "$DB_NAME" --remote --file=seed-ready.sql

echo "==> Setting SESSION_SECRET (a random value)"
RANDOM_SECRET="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
echo "$RANDOM_SECRET" | npx wrangler pages secret put SESSION_SECRET --project-name="$PROJECT" || \
  echo "  (If the project doesn't exist yet, this will succeed after the first deploy — re-run then.)"

echo "==> Deploying to Cloudflare Pages"
npx wrangler pages deploy public --project-name="$PROJECT"

echo
echo "✅ Done. Demo logins:"
echo "     Admin : admin@demo.com / Admin@123"
echo "     Member: demo@demo.com  / Demo@123"
echo "   Set your brand: edit BRAND_NAME / LOGO_URL in wrangler.toml (or the Pages dashboard) and redeploy."
