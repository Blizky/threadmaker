#!/bin/zsh
set -euo pipefail

cd "$(dirname "$0")"

./deploy-cloudflare.sh
read -r "?Press Enter to close..."
