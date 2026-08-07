import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'

interface MapMeta {
  id: string
  name: string
  range: string
  jsonFile: string
  image: string
  imageSize: [number, number]
}

const MAP_CONFIGS: Record<string, MapMeta> = {
  nanzih: {
    id: 'nanzih',
    name: '楠梓區',
    range: '1-89',
    jsonFile: 'nanzih-areas-detected.json',
    image: '/maps/nanzih-1-89.png',
    imageSize: [7884, 5512],
  },
  chiaotou: {
    id: 'chiaotou',
    name: '橋頭',
    range: '90-148',
    jsonFile: 'chiaotou-areas-detected.json',
    image: '/maps/chiaotou-90-148.png',
    imageSize: [4827, 4534],
  },
  tzuguan: {
    id: 'tzuguan',
    name: '梓官',
    range: '149-213',
    jsonFile: 'tzuguan-areas-detected.json',
    image: '/maps/tzuguan-149-213.png',
    imageSize: [4828, 4038],
  },
}

export async function GET(
  _request: Request,
  { params }: { params: { mapId: string } }
) {
  const config = MAP_CONFIGS[params.mapId]
  if (!config) {
    return NextResponse.json(
      { error: `未知的地图: ${params.mapId}` },
      { status: 404 }
    )
  }

  try {
    const filePath = path.join(
      process.cwd(),
      'public',
      'maps',
      config.jsonFile
    )
    const raw = await readFile(filePath, 'utf-8')
    const json = JSON.parse(raw)

    const areas = (json.areas || []).map((area: any) => ({
      id: area.id,
      center: area.center as [number, number],
      polygon: area.polygon as [number, number][],
      pixelCount: area.pixelCount ?? null,
      bbox: area.bbox ?? null,
    }))

    return NextResponse.json({
      mapId: config.id,
      mapName: config.name,
      range: config.range,
      image: config.image,
      imageSize: config.imageSize,
      bounds: [
        [0, 0],
        [config.imageSize[1], config.imageSize[0]],
      ] as [[number, number], [number, number]],
      totalAreas: areas.length,
      areas,
    })
  } catch (err) {
    console.error(`Failed to load map data for ${params.mapId}:`, err)
    return NextResponse.json(
      { error: '載入地圖資料失敗' },
      { status: 500 }
    )
  }
}

export async function generateStaticParams() {
  return Object.keys(MAP_CONFIGS).map((mapId) => ({ mapId }))
}
