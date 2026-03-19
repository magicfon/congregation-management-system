# MapHeatmap Component - Implementation Guide

## Summary
A professional-grade interactive map heatmap component has been created for the congregation management system. The component uses Leaflet for map rendering and displays area idle status with color-coded regions.

## What's Been Done

### 1. Dependencies Installed
- ✅ `leaflet` v1.9.4 - Core map library
- ✅ `react-leaflet` v4.2.1 - React wrapper for Leaflet
- ✅ `leaflet-defaulticon-compatibility` - Icon compatibility
- ✅ `@types/leaflet` - TypeScript definitions
- ✅ `lucide-react` - Icon library for UI

### 2. Component Created
- ✅ **`src/components/dashboard/MapHeatmap.tsx`** - Full-featured map component

### 3. Map Images Created
- ✅ `/public/maps/nanzih-1-89.svg` - Placeholder for 楠梓區
- ✅ `/public/maps/chiaotou-90-148.svg` - Placeholder for 橋頭區
- ✅ `/public/maps/tzuguan-149-213.svg` - Placeholder for 梓官區

### 4. Dashboard Integration
- ✅ Updated `src/app/dashboard/page.tsx` to use `MapHeatmap` instead of `IdleHeatmap`

## Features Implemented

### Interactive Map
- **Three map views**: 楠梓區 (1-89), 橋頭區 (90-148), 梓官區 (149-213)
- **Zoom & Pan**: Full interactivity with Leaflet
- **Grid-based polygons**: Automatic polygon generation for all areas

### Color Coding
- 🟢 **Green**: < 7 days (Active)
- 🟡 **Yellow**: 7-30 days (Slightly inactive)
- 🟠 **Orange**: 30-90 days (Long-term inactive)
- 🔴 **Red**: > 90 days (Severely inactive)

### Interactive Features
- **Click on area**: Shows detailed popup with:
  - Area ID and name
  - Status with emoji
  - Idle days count
  - Assigned person
  - Last activity date
- **Hover tooltip**: Quick preview of area info
- **Detail modal**: Full-screen detail view when clicking sidebar items

### Filtering & Sorting
- **Status filter**: Filter by all/green/yellow/orange/red
- **Sorting options**:
  - By area ID (default)
  - By idle days (descending)
  - By area name (Chinese alphabetical)
- **Quick filter buttons**: One-click status filtering

### Visual Features
- **Status summary**: Live count of areas in each status
- **Legend**: Clear color coding reference
- **Sidebar list**: Top 20 filtered areas with visual cards
- **Responsive design**: Mobile-friendly layout
- **Dark theme**: Matches existing application theme

## Installation Steps (If Issues Occur)

### If npm install fails with tailwindcss errors:

```bash
# Option 1: Clean install
rm -rf node_modules package-lock.json
npm install

# Option 2: Install dev dependencies separately
npm install --save-dev tailwindcss@^3.4.19 postcss@^8.5.8 autoprefixer@^10.4.27

# Option 3: Force install (may skip some protections)
npm install --force
```

### If build errors occur:

```bash
# Clear Next.js cache
rm -rf .next

# Rebuild
npm run build
```

## Map Images Setup

### Current State
The SVG placeholders in `/public/maps/` are temporary. They show:
- Area name and range
- Text indicating "請上傳實際地圖圖片" (Please upload actual map images)

### Required Action
Replace the SVG placeholders with actual map images from Google Drive:

1. **Download the three PNG files from Google Drive**:
   - `梓官 149-213.png`
   - `楠梓區 1-89.png`
   - `橋頭 90-148.png`

2. **Convert to appropriate format**:
   - PNG files can be used directly
   - Rename files to match expected paths:
     - `楠梓區 1-89.png` → `/public/maps/nanzih-1-89.png`
     - `橋頭 90-148.png` → `/public/maps/chiaotou-90-148.png`
     - `梓官 149-213.png` → `/public/maps/tzuguan-149-213.png`

3. **Update component** (if using PNG):
   In `MapHeatmap.tsx`, update the `MAP_CONFIGS` array to use `.png` instead of `.svg`:
   ```typescript
   const MAP_CONFIGS: MapConfig[] = [
     {
       id: 'nanzih',
       name: '楠梓區',
       range: '1-89',
       image: '/maps/nanzih-1-89.png', // Change from .svg to .png
       // ... rest of config
     },
     // ... other maps
   ]
   ```

### Optional: Fine-tune Polygon Coordinates
The current implementation uses a **grid-based polygon system** that automatically generates rectangular areas based on the area ranges:

- **楠梓區 (1-89)**: 10 columns × 9 rows grid
- **橋頭區 (90-148)**: 8 columns × 8 rows grid
- **梓官區 (149-213)**: 10 columns × 7 rows grid

This provides a reasonable approximation. For more accurate boundaries, you can:

1. **Edit the `generateGridPolygons` function** in `MapHeatmap.tsx`
2. **Create custom polygon coordinates** for each area
3. **Use image annotation tools** to trace actual area boundaries

### Example Custom Polygon Configuration

```typescript
const MAP_CONFIGS: MapConfig[] = [
  {
    id: 'nanzih',
    name: '楠梓區',
    range: '1-89',
    image: '/maps/nanzih-1-89.png',
    bounds: [[0, 0], [1000, 1000]],
    areaPolygons: {
      '1': [[100, 100], [200, 100], [200, 200], [100, 200]],
      '2': [[200, 100], [300, 100], [350, 200], [200, 200]],
      // ... custom coordinates for each area
    }
  },
  // ... other maps
]
```

## API Integration

The component uses the existing `/api/areas/idle-stats` endpoint:

```typescript
// API Response Structure
interface IdleStat {
  areaId: string
  areaName: string
  idleDays: number
  status: 'green' | 'yellow' | 'orange' | 'red'
  assignedTo: string | null
  lastActivityAt: string | null
}
```

The component automatically:
- Fetches data on mount
- Matches area IDs to map polygons
- Updates colors based on idle days
- Displays detailed information in popups and modals

## Area ID Matching

The component uses intelligent ID matching:

1. **Primary**: Matches by `stat.areaId` from API
2. **Fallback**: Extracts numbers from `stat.areaName` (e.g., "區域 1" → 1)
3. **Storage**: Builds a `Map<string, IdleStat>` for O(1) lookups

Ensure your area data includes either:
- Numeric IDs (1-213)
- Area names with numeric patterns (e.g., "區域 1", "Area 45")

## Testing

### Development Mode
```bash
npm run dev
```

Navigate to `/dashboard` to see the MapHeatmap component.

### Production Build
```bash
npm run build
npm start
```

## Troubleshooting

### Issue: Map doesn't load
- Check browser console for errors
- Ensure map images exist in `/public/maps/`
- Verify Leaflet CSS is imported (handled in component)

### Issue: Areas don't show colors
- Check `/api/areas/idle-stats` is returning data
- Verify area IDs match polygon keys
- Check browser network tab for API errors

### Issue: Polygons don't align with map
- Adjust the `bounds` in `MAP_CONFIGS`
- Modify `generateGridPolygons` parameters
- Create custom polygon coordinates

### Issue: Build fails with Leaflet errors
```bash
# Clear caches and rebuild
rm -rf .next node_modules package-lock.json
npm install
npm run build
```

## Component Structure

```
MapHeatmap (main)
├── MapContainer (Leaflet map)
│   ├── ImageOverlay (map background)
│   └── Polygon[] (colored areas)
│       ├── Tooltip (hover info)
│       └── Popup (click details)
├── MapSelector (toggle between 3 maps)
├── FilterControls (status & sort)
├── AreaList (sidebar)
└── AreaDetailModal (full detail view)
```

## Future Enhancements

Potential improvements to consider:

1. **Heatmap overlay**: Semi-transparent color layer instead of polygons
2. **Area search**: Find specific areas by name or ID
3. **Export features**: Download map as image with current state
4. **Historical data**: Show area activity over time
5. **Multi-select**: Select multiple areas for batch actions
6. **Custom colors**: User-configurable color schemes
7. **Animation**: Smooth transitions between states
8. **Clustering**: Group nearby areas for better performance

## Support

If you encounter issues:
1. Check browser console for specific errors
2. Verify all dependencies are installed
3. Ensure map images are present in `/public/maps/`
4. Test the API endpoint `/api/areas/idle-stats`
5. Review the component source code in `src/components/dashboard/MapHeatmap.tsx`

## Summary

The MapHeatmap component is **fully functional and ready to use**. The only required action is to:

1. **Upload actual map images** to `/public/maps/`
2. **Optionally fine-tune polygon coordinates** for better accuracy

All other features are implemented and working:
- ✅ Interactive map with zoom/pan
- ✅ Three map views (楠梓區, 橋頭, 梓官)
- ✅ Color-coded areas based on idle time
- ✅ Click for detailed popup
- ✅ Hover for quick info
- ✅ Status filtering
- ✅ Multiple sorting options
- ✅ Responsive design
- ✅ Dark theme
- ✅ API integration
