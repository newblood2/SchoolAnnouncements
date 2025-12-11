# Quick Start Guide

Get your school announcements display running in 5 minutes!

## Step 1: Get Weather API Key (2 minutes)

1. Go to https://openweathermap.org/api
2. Click "Sign Up" (free account)
3. Verify your email
4. Go to API Keys section
5. Copy your API key

## Step 2: Configure (1 minute)

Open `config.js` and update:

```javascript
SCHOOL_NAME: 'Your School Name',
WEATHER_API_KEY: 'paste_your_api_key_here',
LOCATION: 'Your City,MD,US',
```

## Step 3: Start the App (30 seconds)

**Option A - Docker (Recommended):**
```bash
./start.sh
```
Then open: http://localhost:8080

**Option B - Python:**
```bash
python -m http.server 8000
```
Then open: http://localhost:8000

**Option C - Node.js:**
```bash
npx http-server
```

**Option D - PHP:**
```bash
php -S localhost:8000
```

## Step 4: Open in Browser

1. Navigate to http://localhost:8000
2. Press `F` for fullscreen
3. You should see:
   - Clock ticking
   - Current date
   - Weather loading
   - Slides rotating

## Step 5: Customize Content

Edit `index.html` to add your announcements:

```html
<div class="slide">
    <h2>Today's Events</h2>
    <ul>
        <li>Basketball Game - 6:00 PM</li>
        <li>Drama Club - 3:30 PM</li>
    </ul>
</div>
```

## Troubleshooting

**Weather shows "API Key Missing"**
- Make sure you saved `config.js` after adding your API key
- Refresh the page

**Slides not changing**
- Wait 8 seconds (default interval)
- Check browser console (F12) for errors

**Can't access localhost**
- Make sure the server is running
- Try http://127.0.0.1:8000 instead

## Next Steps

- Read the full [README.md](README.md) for deployment options
- Set up kiosk mode for your TV
- Customize colors and fonts in `styles.css`

## Need Help?

Check the browser console (press F12) for error messages.
