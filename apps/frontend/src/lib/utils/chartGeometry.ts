const MAX_GRID_INTERVALS = 5

export function gridStep(peak: number): number {
    let magnitude = 1
    for (;;) {
        for (const multiple of [1, 2, 5]) {
            if (peak / (multiple * magnitude) <= MAX_GRID_INTERVALS) return multiple * magnitude
        }
        magnitude *= 10
    }
}

export function columnPath(
    x: number,
    top: number,
    width: number,
    bottom: number,
    radius: number
): string {
    const corner = Math.max(0, Math.min(radius, bottom - top, width / 2))
    return `M${x},${bottom}V${top + corner}a${corner},${corner} 0 0 1 ${corner},${-corner}h${width - 2 * corner}a${corner},${corner} 0 0 1 ${corner},${corner}V${bottom}Z`
}
