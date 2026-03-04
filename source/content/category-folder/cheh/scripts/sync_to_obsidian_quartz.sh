#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_REPO="${WORKSPACE_ROOT}/obsidian-quartz"
TARGET_CONTENT="${TARGET_REPO}/source/content/category-folder/cheh"

if [[ ! -d "${TARGET_REPO}/.git" ]]; then
  echo "Target repo not found at: ${TARGET_REPO}" >&2
  echo "Clone it first: git clone git@github.com:SakhnevichKirill/obsidian-quartz.git ${TARGET_REPO}" >&2
  exit 1
fi

mkdir -p "${TARGET_CONTENT}"

rsync -a --delete \
  --exclude=".git/" \
  --exclude=".obsidian/" \
  --exclude=".instruction-baseline/" \
  --exclude=".venv_sku/" \
  --exclude="external/" \
  --exclude="obsidian-quartz/" \
  --exclude=".DS_Store" \
  "${WORKSPACE_ROOT}/" \
  "${TARGET_CONTENT}/"

if [[ ! -f "${TARGET_CONTENT}/index.md" ]]; then
  cat > "${TARGET_CONTENT}/index.md" <<'INDEX_EOF'
---
title: Cheh Workspace Mirror
---

Синхронизированная рабочая область из `/Users/kirsr/workspace/cheh`.
INDEX_EOF
fi

echo "Sync complete:"
echo "  from: ${WORKSPACE_ROOT}"
echo "  to:   ${TARGET_CONTENT}"
