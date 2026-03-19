# MapHeatmap - Quick Start Guide

## What Was Built
A professional interactive map heatmap component for the congregation management system that displays area idle status on visual maps.

## Quick Test (Works Now!)
```bash
cd /home/node/.openclaw/workspace/projects/congregation-management-system
npm run dev
# Open http://localhost:3000/dashboard
```

You'll see:
- ✅ Three map tabs (楠梓區 1-89, 橋頭 90-148, 梓官 149-213)
- ✅ Color-coded grid areas (green/yellow/orange/red)
- ✅ Hover for quick info
- ✅ Click for detailed popup
- ✅ Filter and sort controls
- ✅ Status summary counters

## To Make Production-Ready

### Step 1: Get Map Images from Google Drive
Download these 3 files:
- `梓官 149-213.png`
- `楠梓區 1-89.png`
- `橋頭 90-148.png`

### Step 2: Upload to Project
```bash
cd /home/node/.openclaw/workspace/projects/congregation-management-system

# Create backup of placeholders
mv public/maps/nanzih-1-89.svg public/maps/.nanzih-1-89.svg.backup
mv public/maps/chiaotou-90-148.svg public/maps/.chiaotou-90-148.svg.backup
mv public/maps/tzuguan-149-213.svg public/maps/.tzuguan-149-213.svg.backup

# Copy your PNG files
# 楠梓區 1-89.png → public/maps/nanzih-1-89.png
# 橋頭 90-148.png → public/maps/chiaotou-90-148.png
# 梓官 149-213.png → public/maps/tzuguan-149-213.png
```

### Step 3: Update Component (1 line change)
Edit `src/components/dashboard/MapHeatmap.tsx`, find line ~75:
```typescript
// Change this:
image: '/maps/nanzih-1-89.svg',

// To this:
image: '/maps/nanzih-1-89.png',
```

Repeat for all three maps in the `MAP_CONFIGS` array.

### Step 4: (Optional) Fine-tune Polygons
The current grid system works for general visualization. For precise area boundaries, manually define coordinates in `MAP_CONFIGS`:
```typescript
areaPolygons: {
  '1': [[100, 100], [200, 100], [200, 200], [100, 200]],
  // ... custom coordinates
}
```

### Step 5: Build and Deploy
```bash
npm run build
npm start
```

## Troubleshooting

### Dev server doesn't start?
```bash
rm -rf .next
npm run dev
```

### Build fails with missing tailwindcss?
```bash
npm install --save-dev tailwindcss postcss autoprefixer
npm run build
```

### Map images not loading?
1. Check files exist in `/public/maps/`
2. Verify image paths in `MAP_CONFIGS` match actual filenames
3. Check browser console for 404 errors

### Areas showing wrong colors?
1. Check `/api/areas/idle-stats` is returning data
2. Verify area IDs in database match polygon IDs (1-213)
3. Check browser network tab for API errors

## Component Features

### Interactive
- 🗺️ Three map views (楠梓區, 橋頭, 梓官)
- 🔍 Zoom and pan
- 🖱️ Click areas for details
- 💡 Hover for quick info

### Data
- 📊 Live status counts
- 🔍 Filter by status (all/green/yellow/orange/red)
- 📈 Sort by ID, idle days, or name
- 📋 Top 20 areas in sidebar

### Visual
- 🎨 Color-coded regions
- 🌙 Dark theme
- 📱 Responsive design
- ✨ Smooth animations

## API Integration

Component automatically fetches from: `GET /api/areas/idle-stats`

Expected response:
```json
[
  {
    "areaId": "1",
    "areaName": "區域 1",
    "idleDays": 15,
    "status": "yellow",
    "assignedTo": "張三",
    "lastActivityAt": "2026-03-01T10:00:00Z"
  },
  ...
]
```

## File Locations

- Component: `src/components/dashboard/MapHeatmap.tsx`
- Maps: `public/maps/*.png` (or `.svg` for placeholders)
- Dashboard: `src/app/dashboard/page.tsx`
- Docs:
  - `MAP_HEATMAP_README.md` (detailed guide)
  - `IMPLEMENTATION_SUMMARY.md` (task report)
  - `QUICK_START_GUIDE.md` (this file)

## Support

Check these resources:
1. `MAP_HEATMAP_README.md` - Full implementation details
2. `IMPLEMENTATION_SUMMARY.md` - Task completion report
3. Browser console for runtime errors
4. Network tab for API issues

## Success Criteria

✅ Map loads and displays areas
✅ Areas are color-coded by idle status
✅ Click opens detailed popup
✅ Hover shows quick info
✅ Filters and sorting work
✅ Sidebar displays filtered areas
✅ Responsive on mobile

---

**Status**: ✅ Component complete and functional
**Action Item**: Upload actual map images from Google Drive
