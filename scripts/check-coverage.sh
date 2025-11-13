#!/usr/bin/env bash
set -e
pnpm forge:cov > coverage_summary.txt
PCT=$(grep -Eo "Total coverage: [0-9]+\.[0-9]+%" coverage_summary.txt | awk '{print $3}' | tr -d '%')
PCT_INT=${PCT%.*}
echo "Coverage total: ${PCT}%"
if [ "$PCT_INT" -lt 96 ]; then
  echo "Coverage menor a 96%"; exit 1
fi
