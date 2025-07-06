#!/usr/bin/env bash

set -euo pipefail
set -x

# GitHub CLI api
# https://cli.github.com/manual/gh_api

gh repo list confluentinc -L 100000 --json name,viewerSubscription \
 -q '.[] | select(.viewerSubscription == "UNSUBSCRIBED") | .name' \
 | xargs -P32 -I {} gh api \
      --method PUT \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      /repos/confluentinc/{}/subscription \
       -F "subscribed=true" -F "ignored=false"