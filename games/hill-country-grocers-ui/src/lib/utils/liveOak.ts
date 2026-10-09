export type Oak = { x: number; y: number; r: number }
export type Ellipse = { cx: number; cy: number; rx: number; ry: number }

export const OAKS: Oak[] = [
    { x: -30, y: -34, r: 9 },
    { x: -12, y: -42, r: 11 },
    { x: 8, y: -36, r: 8 }
]

export const CROWN_LAYERS_BOTTOM_UP = ['canopy-edge', 'canopy']

const CROWN_LOBES = [
    { dx: -0.75, dy: 0.1, rx: 0.55, ry: 0.42 },
    { dx: -0.35, dy: -0.3, rx: 0.6, ry: 0.5 },
    { dx: 0.25, dy: -0.38, rx: 0.62, ry: 0.5 },
    { dx: 0.75, dy: 0.05, rx: 0.55, ry: 0.42 },
    { dx: 0, dy: 0.12, rx: 1.05, ry: 0.38 }
]

const CROWN_HIGHLIGHTS = [
    { dx: -0.35, dy: -0.45, rx: 0.35, ry: 0.22 },
    { dx: 0.3, dy: -0.5, rx: 0.28, ry: 0.18 }
]

function scaled(oak: Oak, shape: { dx: number; dy: number; rx: number; ry: number }): Ellipse {
    return {
        cx: oak.x + shape.dx * oak.r,
        cy: oak.y + shape.dy * oak.r,
        rx: shape.rx * oak.r,
        ry: shape.ry * oak.r
    }
}

export function crownLobes(oak: Oak): Ellipse[] {
    return CROWN_LOBES.map((lobe) => scaled(oak, lobe))
}

export function crownHighlights(oak: Oak): Ellipse[] {
    return CROWN_HIGHLIGHTS.map((highlight) => scaled(oak, highlight))
}

export function groundShadow({ x, y, r }: Oak): Ellipse {
    return { cx: x + 1, cy: y + r * 0.95, rx: r * 1.15, ry: r * 0.22 }
}

export function trunkPath({ x, y, r }: Oak): string {
    const fork = y + r * 0.3
    return [
        `M${x - 1.6} ${y + r * 0.95} L${x - 1} ${fork} L${x - r * 0.45} ${y - r * 0.05}`,
        `M${x - 1} ${fork} L${x + 1} ${fork} L${x + r * 0.5} ${y - r * 0.02}`,
        `M${x + 1} ${fork} L${x + 1.6} ${y + r * 0.95}`
    ].join(' ')
}
