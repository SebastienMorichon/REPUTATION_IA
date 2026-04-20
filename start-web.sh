#!/bin/zsh
# Lance le frontend Next.js en mode dev
cd "$(dirname "$0")/apps/web"
exec npm run dev
