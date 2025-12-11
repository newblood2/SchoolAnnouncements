@echo off
REM Start MediaMTX Streaming Server
REM Ultra-low latency WebRTC streaming for OBS

echo =========================================
echo Starting MediaMTX Streaming Server
echo =========================================
echo.

REM Start the server
docker compose up -d

echo.
echo ✓ MediaMTX Server Started!
echo.
echo Server Information:
echo -------------------
echo WebRTC Port:  8889 (WHIP/WHEP)
echo RTMP Port:    1935 (fallback)
echo HLS Port:     8888 (fallback)
echo API Port:     9997
echo.
echo OBS Configuration (WHIP - Recommended):
echo ----------------------------------------
echo Service:     WHIP
echo Server:      http://YOUR_SERVER_IP:8889/announcements/whip
echo.
echo OBS Configuration (RTMP - Fallback):
echo --------------------------------------
echo Service:     Custom
echo Server:      rtmp://YOUR_SERVER_IP:1935/announcements
echo.
echo To find your server IP, run: ipconfig
echo Look for "IPv4 Address"
echo.
echo View Stream:
echo -------------
echo Stream Viewer: http://localhost:8080/stream-viewer.html
echo MediaMTX Player: http://localhost:8889/announcements/
echo.
echo Check Status:
echo --------------
echo API: http://localhost:9997/v3/paths/list
echo Logs: docker logs -f school-streaming-server
echo.
echo To stop the server, run:
echo   docker compose down
echo.
echo For detailed setup instructions, see OBS-MEDIAMTX-SETUP.md
echo =========================================
echo.
pause
