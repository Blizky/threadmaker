#!/bin/zsh
set -euo pipefail

cd "$(dirname "$0")"

./publish.sh
read -r "?Press Enter to close..."
