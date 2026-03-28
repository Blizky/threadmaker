#!/bin/zsh
set -euo pipefail

cd "$(dirname "$0")"

branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"

if [[ "$branch" == "HEAD" || -z "$branch" ]]; then
  branch="main"
fi

message="${1:-Update ThreadMK $(date '+%Y-%m-%d %H:%M')}"

git pull --rebase --autostash origin "$branch"
git add -A -- . ':(exclude).DS_Store' ':(exclude)assets/.DS_Store'

if ! git diff --cached --quiet; then
  git commit -m "$message"
  echo
  echo "Committed with message: $message"
else
  echo
  echo "No new file changes to commit."
fi

git push -u origin "$branch"

echo
echo "Push complete."
