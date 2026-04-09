#!/bin/zsh
set -euo pipefail

cd "$(dirname "$0")"

project_name="threadmk"

echo "Deploying ThreadMK to Cloudflare Pages..."
echo "Project: $project_name"
echo

npx wrangler pages deploy . --project-name "$project_name"

echo
echo "Cloudflare deploy complete."
