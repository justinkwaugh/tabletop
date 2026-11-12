import { calculateHexGeometry, HexOrientation } from '@tabletop/common'
import { Map1849 } from '@tabletop/1849'
const pts = Map1849.definition.locations.map((l) => ({
    id: l.id,
    ...calculateHexGeometry(
        { orientation: HexOrientation.Flat, dimensions: { radius: 50 } },
        l.coordinates
    ).center
}))
const xs = pts.map((p) => p.x),
    ys = pts.map((p) => p.y)
console.log('bounds', Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys))
// grid print: rows by y bucket
const rows = new Map()
for (const p of pts) {
    const k = Math.round(p.y / 43.3)
    rows.set(k, [...(rows.get(k) ?? []), p])
}
for (const k of [...rows.keys()].sort((a, b) => a - b))
    console.log(
        String(k * 43.3).padStart(7),
        rows
            .get(k)
            .sort((a, b) => a.x - b.x)
            .map((p) => `${p.id}@${Math.round(p.x)}`)
            .join(' ')
    )
