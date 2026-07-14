#!/usr/bin/env bash
# archive-source.sh — Create source-only tarball from git HEAD
# Excludes .git/, build artifacts, and ignored files.
# Output: audesys-source-YYYYMMDD.tar.gz
set -euo pipefail

git archive --format=tar.gz -o "audesys-source-$(date +%Y%m%d).tar.gz" HEAD
echo "Created: audesys-source-$(date +%Y%m%d).tar.gz"
