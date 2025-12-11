#!/bin/bash

# School Announcements - Easy Docker Startup Script

echo "========================================"
echo "School Announcements Display System"
echo "========================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed."
    echo "Please install Docker from: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Error: Docker Compose is not installed."
    echo "Please install Docker Compose from: https://docs.docker.com/compose/install/"
    exit 1
fi

# Check if config.js exists and has API key configured
if [ -f "config.js" ]; then
    if grep -q "YOUR_API_KEY_HERE" config.js; then
        echo "⚠️  Warning: Weather API key not configured in config.js"
        echo "   The app will start, but weather won't work until you add your API key."
        echo "   Get a free key from: https://openweathermap.org/api"
        echo ""
    fi
else
    echo "⚠️  Warning: config.js not found. Using default configuration."
    echo ""
fi

echo "🚀 Starting School Announcements..."
echo ""

# Use docker compose (newer) or docker-compose (older)
if docker compose version &> /dev/null; then
    docker compose up -d --build
else
    docker-compose up -d --build
fi

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Success! The announcements display is running."
    echo ""
    echo "🌐 Access the display at:"
    echo "   http://localhost:8080"
    echo ""
    echo "💡 Tips:"
    echo "   - Press F for fullscreen"
    echo "   - Edit config.js and restart to update settings"
    echo "   - Edit index.html to customize announcements"
    echo ""
    echo "🛠️  Useful commands:"
    echo "   Stop:    docker compose down"
    echo "   Restart: docker compose restart"
    echo "   Logs:    docker compose logs -f"
    echo "   Update:  ./start.sh (runs this script again)"
    echo ""
else
    echo ""
    echo "❌ Error: Failed to start the container."
    echo "   Check the error messages above."
    exit 1
fi
