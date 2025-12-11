#!/bin/bash

# School Announcements - Stop Script

echo "🛑 Stopping School Announcements Display..."

# Use docker compose (newer) or docker-compose (older)
if docker compose version &> /dev/null; then
    docker compose down
else
    docker-compose down
fi

if [ $? -eq 0 ]; then
    echo "✅ Successfully stopped."
else
    echo "❌ Error stopping the container."
    exit 1
fi
