#!/bin/sh

# Export all environment variables for supervisord child processes
export HOME="/app"
export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-8080}"
export DATA_DIR="${DATA_DIR:-/app/data}"
export PUBLIC_DIR="${PUBLIC_DIR:-/app/public}"
export API_KEY="${API_KEY:-change-this-in-production}"
export WEATHER_API_KEY="${WEATHER_API_KEY:-}"
export CORS_ORIGIN="${CORS_ORIGIN:-*}"

# Start supervisord
exec supervisord -c /etc/supervisord.conf
