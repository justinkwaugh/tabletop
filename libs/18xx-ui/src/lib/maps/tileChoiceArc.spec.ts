import { expect, it } from 'vitest'
import { tileChoiceArc } from './tileChoiceArc.js'

it('keeps a compact, evenly spaced arc inside the viewport at its center and edges', () => {
    for (const center of [
        { x: 400, y: 300 },
        { x: 30, y: 30 },
        { x: 770, y: 570 },
        { x: 30, y: 300 }
    ]) {
        const layout = tileChoiceArc(center, 800, 600, 8)
        expect(layout).toBeDefined()
        if (!layout) throw new Error('Missing arc')
        const radii = layout.points.map((point) =>
            Math.hypot(point.x - center.x, point.y - center.y)
        )
        for (const radius of radii) expect(radius).toBeCloseTo(radii[0])
        for (const [index, point] of layout.points.entries()) {
            expect(point.x - layout.size / 2).toBeGreaterThanOrEqual(0)
            expect(point.y - layout.size / 2).toBeGreaterThanOrEqual(0)
            expect(point.x + layout.size / 2).toBeLessThanOrEqual(800)
            expect(point.y + layout.size / 2).toBeLessThanOrEqual(600)
            if (index)
                expect(
                    Math.hypot(
                        point.x - layout.points[index - 1].x,
                        point.y - layout.points[index - 1].y
                    )
                ).toBeCloseTo(layout.size * 1.125)
        }
    }
})

it('centers a short arc directly above the selected hex when it fits', () => {
    const layout = tileChoiceArc({ x: 400, y: 300 }, 800, 600, 3)
    if (!layout) throw new Error('Missing arc')
    expect(layout.points[1].x).toBeCloseTo(400)
    expect(layout.points[1].y).toBeLessThan(300)
    expect(layout.points[0].y).toBeCloseTo(layout.points[2].y)
})

it('rotates just enough to clear an edge without snapping to a cardinal direction', () => {
    const center = { x: 70, y: 300 }
    const layout = tileChoiceArc(center, 800, 600, 3)
    const nearby = tileChoiceArc({ ...center, x: 69 }, 800, 600, 3)
    if (!layout || !nearby) throw new Error('Missing arc')
    const angle = Math.atan2(layout.points[1].y - center.y, layout.points[1].x - center.x)
    const nextAngle = Math.atan2(nearby.points[1].y - center.y, nearby.points[1].x - 69)
    expect(angle).toBeGreaterThan(-Math.PI / 2)
    expect(angle).toBeLessThan(0)
    expect(Math.abs(nextAngle - angle)).toBeLessThan(0.05)
})
