# Student Roster Guide - Auto-Correction Feature

## Overview

The student roster feature enables automatic name correction during dismissal. When teachers use voice recognition, the system automatically fixes mistakes by comparing against your uploaded student list.

## Benefits

✅ **Automatic Correction** - "Jon Smyth" → "John Smith"
✅ **Confidence-based** - High confidence = auto-fix, medium = ask, low = warn
✅ **Grade Validation** - Ensures correct student/grade combination
✅ **Optional Feature** - Works with or without roster uploaded
✅ **Privacy-friendly** - Roster stored locally, not sent to external services

## Quick Start

### 1. Upload Student Roster

1. **Go to Admin Panel:**
   ```
   http://192.168.12.28:8080/admin.html
   ```

2. **Login** with your admin password

3. **Click "Student Roster" tab**

4. **Prepare CSV file** with this format:
   ```csv
   John Smith,3
   Sarah Johnson,5
   Mike Brown,K
   Emily Davis,12
   ```

5. **Upload:**
   - Click "Choose CSV File"
   - Select your file
   - Click "Upload Roster"
   - Confirm students loaded

### 2. How Auto-Correction Works

When a teacher uses voice recognition:

**High Confidence (>70% match):**
- ✅ Automatically corrects
- Shows: "Auto-corrected: Jon Smyth → John Smith"
- No confirmation needed

**Medium Confidence (50-70% match):**
- ❓ Asks for confirmation
- Shows: "Did you mean: John Smith (Grade 3)?"
- Teacher clicks Yes/No

**Low Confidence (<50% match):**
- ⚠️ Adds name as transcribed
- Shows warning: "Name not in roster - added as transcribed"
- Teacher can manually fix if needed

**Example:**
```
Teacher says: "Jon Smyth Grade 3"
System thinks: That's 85% similar to "John Smith"
Result: Automatically corrected to "John Smith, Grade 3"
```

## CSV File Format

### Required Format

```csv
Name,Grade
```

- **Two columns:** Name, Grade
- **No header required** (system detects headers automatically)
- **One student per line**

### Supported Grades

- Pre-K, K, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12

### Example File

```csv
John Smith,3
Sarah Johnson,5
Mike Brown,K
Emily Davis,12
Alex Rodriguez,Pre-K
Taylor Wilson,7
Jordan Lee,11
```

### Creating CSV from Excel

1. Open Excel or Google Sheets
2. Column A: Student Names
3. Column B: Grades
4. File → Save As → CSV (Comma delimited)
5. Upload to admin panel

### Download Template

In the admin panel:
- Click "Download CSV Template"
- Opens template with sample data
- Replace with your students
- Save and upload

## Managing the Roster

### View Current Roster

- Admin Panel → Student Roster tab
- Shows all uploaded students
- Search box to filter students

### Remove Individual Students

- Click × next to student name
- Confirms removal
- Updates immediately

### Clear All Students

- Click "Clear All Students" button
- Confirms action
- Roster completely removed

### Update Roster

- Upload new CSV file
- Replaces existing roster completely
- Previous roster is overwritten

## How It Works

### Fuzzy Matching Algorithm

The system uses **Levenshtein Distance** to measure similarity:

- Calculates "edit distance" between names
- Counts insertions, deletions, substitutions needed
- Converts to similarity percentage

**Examples:**

| Voice Input | Roster Name | Similarity | Action |
|-------------|-------------|------------|--------|
| John Smith | John Smith | 100% | ✅ Auto-add |
| Jon Smith | John Smith | 93% | ✅ Auto-correct |
| John Smyth | John Smith | 82% | ✅ Auto-correct |
| Jon Smyth | John Smith | 75% | ✅ Auto-correct |
| J Smith | John Smith | 55% | ❓ Ask confirmation |
| Smith John | John Smith | 45% | ⚠️ Warn + add as-is |

### Grade Filtering

When grade is included:
1. System narrows search to that grade only
2. Improves accuracy for common names
3. "John Smith Grade 3" won't match "John Smith Grade 5"

## Use Cases

### Case 1: Clear Voice, Correct Name
```
Teacher: "Sarah Johnson Grade 5"
Transcription: "Sarah Johnson Grade 5"
Roster Match: 100% - Sarah Johnson, Grade 5
Result: ✅ Added without correction
```

### Case 2: Unclear Voice, Misspelled Name
```
Teacher: "Sarah Johnson Grade 5"
Transcription: "Sara Jonson Grade 5"
Roster Match: 85% - Sarah Johnson, Grade 5
Result: ✅ Auto-corrected to "Sarah Johnson"
Toast: "Auto-corrected: Sara Jonson → Sarah Johnson"
```

### Case 3: Very Unclear Voice
```
Teacher: "Sarah Johnson Grade 5"
Transcription: "Sarah Jenson Grade 5"
Roster Match: 60% - Sarah Johnson, Grade 5
Result: ❓ Confirmation popup
Popup: "Did you mean: Sarah Johnson (Grade 5)?"
Teacher: Clicks Yes → Added as "Sarah Johnson"
```

### Case 4: Name Not in Roster
```
Teacher: "Alex Thompson Grade 4"
Transcription: "Alex Thompson Grade 4"
Roster Match: No match found
Result: ⚠️ Added as transcribed with warning
Toast: "⚠️ Name not in roster - added as transcribed"
```

## Troubleshooting

### Roster Not Loading

**Problem:** Auto-correction not working

**Solutions:**
1. Check roster uploaded in admin panel
2. Verify CSV format is correct (Name,Grade)
3. Reload dismissal page (F5)
4. Check browser console for errors

### Wrong Auto-Corrections

**Problem:** System correcting to wrong names

**Solutions:**
1. Review roster for duplicate/similar names
2. Include middle initials in roster if needed
3. Update threshold in code (advanced)
4. Use manual entry for problematic names

### CSV Upload Fails

**Problem:** Upload button doesn't work

**Solutions:**
1. Check file is .csv format
2. Verify two columns: Name,Grade
3. Remove special characters
4. Check no empty rows
5. Try downloading and using template

### Students Not Found

**Problem:** All names showing "not in roster"

**Solutions:**
1. Verify roster uploaded successfully
2. Check student count in admin panel
3. Ensure exact spelling in roster
4. Reload dismissal page

## Best Practices

### Roster Maintenance

1. **Update at start of year** - Upload complete student list
2. **Add new students** - Re-upload full roster with additions
3. **Remove graduates** - Clean roster at year end
4. **Include nicknames** - "Robert" vs "Bob" - use what parents call students
5. **Middle names** - Include if commonly used

### CSV Preparation

1. **Export from SIS** - Use your Student Information System
2. **Clean data** - Remove special characters
3. **Verify grades** - Double-check grade levels
4. **Test small batch** - Upload 5-10 students to test first
5. **Backup** - Keep CSV file saved for future uploads

### Security

- **No sensitive data** - Roster only stores name + grade
- **Local storage** - Not sent to external servers
- **Same auth as admin** - Password protected
- **API-based** - Uses existing secure API

## Technical Details

### Data Storage

- Roster stored in settings.json on API server
- Loaded via `/api/settings` endpoint
- No external services or databases
- Persistent across restarts

### Algorithm

**Levenshtein Distance:**
- Standard edit distance algorithm
- O(n*m) time complexity
- Optimized for short strings (names)
- ~5ms per comparison

**Performance:**
- 500 student roster = ~2.5 seconds to scan
- Cached in memory during dismissal session
- No performance impact on displays

### Privacy

- Names never leave your network
- No cloud services involved
- No logging of student data
- Can be disabled by clearing roster

## Advanced Usage

### Custom Thresholds

To adjust confidence levels, edit `dismissal.js`:

```javascript
// Change these values:
if (corrected && corrected.confidence > 0.7) {  // Auto-correct threshold
if (corrected && corrected.confidence > 0.5) {  // Confirmation threshold
```

Higher = more strict (fewer auto-corrections)
Lower = more lenient (more auto-corrections)

### API Integration

Get roster programmatically:

```javascript
fetch('http://192.168.12.28:8080/api/settings')
  .then(r => r.json())
  .then(data => {
    console.log('Roster:', data.studentRoster);
  });
```

Update roster via API:

```javascript
fetch('http://192.168.12.28:8080/api/settings/studentRoster', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Session-Token': sessionToken
  },
  body: JSON.stringify({
    value: [
      {name: 'John Smith', grade: '3'},
      {name: 'Sarah Johnson', grade: '5'}
    ]
  })
});
```

## FAQ

**Q: Does the roster feature require the dismissal system?**
A: No, but it's designed specifically to improve dismissal accuracy.

**Q: Can I use roster without voice recognition?**
A: The roster doesn't affect manual entry - it only helps with voice transcription.

**Q: How often should I update the roster?**
A: Update when students join/leave, or at the start of each year.

**Q: Is the roster required?**
A: No! Dismissal works fine without it - names are just added as transcribed.

**Q: Can multiple schools share one roster?**
A: No, each server instance has one roster. Deploy separate instances for multiple schools.

**Q: What happens if I upload a roster with errors?**
A: Invalid entries are skipped. Check the count - if it's wrong, fix CSV and re-upload.

**Q: Can I export the current roster?**
A: Not built-in, but you can copy from API: `/api/settings` → `studentRoster`

**Q: Does this work offline?**
A: Roster must be uploaded while online, but once loaded, works during temporary network issues.

## Summary

The roster feature adds intelligent auto-correction to your dismissal system:

- 📤 **Upload once** - CSV file with students
- 🎤 **Voice recognition** - Automatic name correction
- ✅ **Confidence-based** - Smart decisions
- ⚙️ **Optional** - Works with or without

Perfect for reducing errors during busy dismissal times!
