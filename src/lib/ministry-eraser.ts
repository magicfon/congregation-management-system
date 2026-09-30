import type { Stroke } from './ministry'
type Point = [number, number]

/** Clip stroke centerlines outside a circular eraser in image-width units. */
export function eraseCircle(strokes: Stroke[], center: Point, radius: number, aspect: number): Stroke[] {
  let changed = false
  const output: Stroke[] = []
  for (const stroke of strokes) {
    const r = radius + stroke.width / 2
    const distance = (p: Point) => Math.hypot(p[0] - center[0], (p[1] - center[1]) * aspect)
    if (stroke.points.length === 1) {
      if (distance(stroke.points[0]) > r) output.push(stroke)
      else changed = true
      continue
    }
    let run: Point[] = []
    const flush = () => { if (run.length) output.push({ width: stroke.width, points: run }); run = [] }
    for (let i = 1; i < stroke.points.length; i++) {
      const a = stroke.points[i - 1], b = stroke.points[i]
      const dx = b[0] - a[0], dy = (b[1] - a[1]) * aspect
      const ox = a[0] - center[0], oy = (a[1] - center[1]) * aspect
      const A = dx * dx + dy * dy, B = 2 * (ox * dx + oy * dy), C = ox * ox + oy * oy - r * r
      const cuts = [0, 1], discriminant = B * B - 4 * A * C
      if (A > 0 && discriminant > 0) for (const t of [(-B - Math.sqrt(discriminant)) / (2 * A), (-B + Math.sqrt(discriminant)) / (2 * A)]) if (t > 0 && t < 1) cuts.push(t)
      cuts.sort((x,y) => x-y)
      const at = (t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
      for (let j = 1; j < cuts.length; j++) {
        if (distance(at((cuts[j-1] + cuts[j]) / 2)) > r) {
          if (!run.length) run.push(at(cuts[j-1]))
          run.push(at(cuts[j]))
        } else { changed = true; flush() }
      }
    }
    flush()
  }
  return changed ? output : strokes
}

export function eraseSweep(strokes: Stroke[], from: Point, to: Point, radius: number, aspect: number) {
  const steps = Math.max(1, Math.ceil(Math.hypot(to[0]-from[0], (to[1]-from[1])*aspect) / (radius/2)))
  let result = strokes
  for (let i = 0; i <= steps; i++) result = eraseCircle(result, [from[0]+(to[0]-from[0])*i/steps, from[1]+(to[1]-from[1])*i/steps], radius, aspect)
  return result
}
