# Slides Folder

This folder contains announcement images that will be displayed in the slideshow.

## How to Add Your Announcement Images

1. **Place your images in this folder**
   - Supported formats: JPG, PNG, GIF, WebP
   - Images will display in the order specified in `slides.json`

2. **Update `slides.json`**
   ```json
   {
     "images": [
       "monday-announcements.png",
       "upcoming-events.jpg",
       "lunch-menu.png"
     ]
   }
   ```

3. **Refresh the page** - New images will load automatically!

## Recommended Image Specifications

### Resolution
- **1920x1080 (1080p)** - Standard HD displays
- **3840x2160 (4K)** - 4K displays
- Aspect ratio: **16:9** (matches most TVs/monitors)

### Design Guidelines

1. **Text Size**
   - Minimum font size: **48pt** for body text
   - Minimum font size: **72pt** for headers
   - Text should be readable from 25+ feet away

2. **Safe Area**
   - Keep important content **100px** from edges
   - Some TVs have overscan that may crop edges

3. **Colors**
   - Use high contrast (dark text on light background or vice versa)
   - Avoid pure white backgrounds (can be harsh on displays)
   - Consider color blindness (avoid red/green combinations)

4. **File Size**
   - Recommended: **< 2MB per image**
   - Optimized images load faster
   - Use compressed PNG or JPG

### Example Layout Template

```
┌─────────────────────────────────────────┐
│  100px safe margin                      │
│    ┌─────────────────────────────┐     │
│    │                             │     │
│    │   YOUR ANNOUNCEMENT         │     │
│    │   CONTENT HERE              │     │
│    │                             │     │
│    │   • Large, readable text    │     │
│    │   • High contrast           │     │
│    │   • Simple layout           │     │
│    │                             │     │
│    └─────────────────────────────┘     │
│                                         │
└─────────────────────────────────────────┘
```

## Creating Announcement Images

### Using Canva (Recommended for beginners)
1. Create new design: **1920 x 1080 px**
2. Use large, bold fonts
3. Keep it simple - less is more
4. Export as PNG or JPG

### Using PowerPoint/Google Slides
1. Set slide size to **16:9 widescreen**
2. Use large fonts (48pt minimum)
3. Export as PNG: File → Export → PNG

### Using Photoshop/GIMP
1. New document: **1920 x 1080 px**
2. Resolution: **72 DPI** (screen display)
3. Color mode: **RGB**
4. Save as PNG or JPG

## Tips for Effective Announcements

1. **One Topic Per Slide** - Don't overcrowd
2. **Use Bullet Points** - Easy to scan quickly
3. **Include Dates** - When is the event?
4. **Use Icons/Images** - Visual interest
5. **Brand Consistency** - Use school colors/logo

## Example Announcements

This folder includes example placeholders:
- `example-announcement-1.png`
- `example-announcement-2.png`
- `example-announcement-3.png`

Replace these with your own images!

## Docker Volume Note

If using Docker, this folder is mounted as a persistent volume. Changes to images will appear immediately without restarting the container!

Just refresh the browser after updating `slides.json`.
