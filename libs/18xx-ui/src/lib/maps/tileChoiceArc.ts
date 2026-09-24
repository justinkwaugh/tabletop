import type { Point } from '@tabletop/common'

export function tileChoiceArc(
    center: Point,
    width: number,
    height: number,
    count: number,
    preferredSize = 80,
    radiusFactor = 1.25
) {
    if (!count) return { size: 72, points: [] }
    for (const factor of [1, 0.9, 0.8, 0.7, 0.6, 0.5]) {
        const size = preferredSize * factor
        const gap = size / 8
        const margin = size / 2 + 8
        for (let radius = size * radiusFactor; radius < Math.hypot(width, height); radius += 12) {
            const step = 2 * Math.asin((size + gap) / (2 * radius))
            if (step * count > Math.PI * 2) continue
            const candidates = [-Math.PI / 2]
            for (let index = 0; index < count; index++) {
                const offset = (index - (count - 1) / 2) * step
                for (const edge of [margin, width - margin]) {
                    const ratio = (edge - center.x) / radius
                    if (Math.abs(ratio) <= 1) {
                        const angle = Math.acos(ratio)
                        candidates.push(angle - offset, -angle - offset)
                    }
                }
                for (const edge of [margin, height - margin]) {
                    const ratio = (edge - center.y) / radius
                    if (Math.abs(ratio) <= 1) {
                        const angle = Math.asin(ratio)
                        candidates.push(angle - offset, Math.PI - angle - offset)
                    }
                }
            }
            candidates.sort(
                (a, b) =>
                    Math.acos(-Math.sin(a)) - Math.acos(-Math.sin(b)) ||
                    (Math.cos(b) - Math.cos(a)) * (width / 2 - center.x)
            )
            for (const direction of candidates) {
                const start = direction - ((count - 1) * step) / 2
                const points = Array.from({ length: count }, (_, index) => ({
                    x: center.x + radius * Math.cos(start + index * step),
                    y: center.y + radius * Math.sin(start + index * step)
                }))
                if (
                    points.every(
                        (point) =>
                            point.x >= margin - 1e-6 &&
                            point.x <= width - margin + 1e-6 &&
                            point.y >= margin - 1e-6 &&
                            point.y <= height - margin + 1e-6
                    )
                )
                    return { size, points }
            }
        }
    }
    return undefined
}
