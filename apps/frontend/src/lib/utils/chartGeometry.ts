const MAX_GRID_INTERVALS = 5

export type ValueAxis = {
    ceiling: number
    y: (value: number) => number
    gridlines: { value: number; y: number }[]
}

export function valueAxis(peak: number, top: number, bottom: number): ValueAxis {
    const step = gridStep(Math.max(1, peak))
    const ceiling = Math.ceil(Math.max(1, peak) / step) * step
    const y = (value: number) => bottom - (value / ceiling) * (bottom - top)
    return {
        ceiling,
        y,
        gridlines: Array.from({ length: ceiling / step + 1 }, (_, index) => ({
            value: index * step,
            y: y(index * step)
        }))
    }
}

function gridStep(peak: number): number {
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
