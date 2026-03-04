#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_REPO="${WORKSPACE_ROOT}/obsidian-quartz"
SYNC_SCRIPT="${WORKSPACE_ROOT}/scripts/sync_to_obsidian_quartz.sh"
TARGET_PATH="source/content/category-folder/cheh"
BRANCH="${BRANCH:-main}"

if [[ ! -x "${SYNC_SCRIPT}" ]]; then
  echo "Sync script is missing or not executable: ${SYNC_SCRIPT}" >&2
  exit 1
fi

"${SYNC_SCRIPT}"

cd "${TARGET_REPO}"

git pull --rebase origin "${BRANCH}"
git add "${TARGET_PATH}"

if git diff --cached --quiet; then
  echo "No changes to commit in ${TARGET_PATH}"
  exit 0
fi

COMMIT_MESSAGE="${1:-chore(sync): update cheh workspace mirror $(date '+%Y-%m-%d %H:%M:%S')}"
git commit -m "${COMMIT_MESSAGE}"
git push origin "${BRANCH}"

echo "Pushed to ${TARGET_REPO} (${BRANCH})"
