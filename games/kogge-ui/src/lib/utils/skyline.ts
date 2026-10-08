// Each city's silhouette: its landmark church spires (relative position, height) and a seed
// for the gabled houses around them.
const LANDMARKS: readonly { spires: [number, number][]; seed: number }[] = [
    { spires: [[0.62, 0.62]], seed: 11 },
    {
        spires: [
            [0.3, 0.78],
            [0.72, 0.58]
        ],
        seed: 23
    },
    { spires: [[0.45, 0.7]], seed: 37 },
    {
        spires: [
            [0.5, 1.0],
            [0.22, 0.6]
        ],
        seed: 41
    },
    {
        spires: [
            [0.38, 0.92],
            [0.7, 0.62]
        ],
        seed: 53
    },
    { spires: [[0.55, 0.8]], seed: 67 },
    {
        spires: [
            [0.35, 0.86],
            [0.75, 0.6]
        ],
        seed: 71
    },
    {
        spires: [
            [0.42, 0.9],
            [0.5, 0.9]
        ],
        seed: 83
    },
    {
        spires: [
            [0.3, 0.7],
            [0.62, 0.74]
        ],
        seed: 97
    }
]

function seeded(seed: number): () => number {
    let state = seed
    return () => {
        state = (state * 1103515245 + 12345) % 2147483648
        return state / 2147483648
    }
}

function stepGable(x: number, width: number, wall: number, ground: number): string {
    const steps = 3
    const stepWidth = width / (2 * steps + 1)
    const stepHeight = (width * 0.55) / steps
    let path = `M${x} ${ground}V${ground - wall}`
    for (let step = 0; step < steps; step++) {
        path += `h${stepWidth}v${-stepHeight}`
    }
    path += `h${stepWidth}`
    for (let step = 0; step < steps; step++) {
        path += `v${stepHeight}h${stepWidth}`
    }
    return `${path}V${ground}Z`
}

function pitched(x: number, width: number, wall: number, ground: number): string {
    return `M${x} ${ground}V${ground - wall}L${x + width / 2} ${ground - wall - width * 0.7}L${x + width} ${ground - wall}V${ground}Z`
}

function spire(x: number, height: number, ground: number): string {
    const towerWidth = height * 0.16
    const towerTop = ground - height * 0.58
    const left = x - towerWidth / 2
    return (
        `M${left} ${ground}V${towerTop}h${towerWidth * 0.08}` +
        `L${x} ${ground - height}L${left + towerWidth * 0.92} ${towerTop}` +
        `h${towerWidth * 0.08}V${ground}Z` +
        `M${x - 0.6} ${ground - height}v${-height * 0.08}h1.2v${height * 0.08}Z`
    )
}

export function skylinePath(city: number, width: number, height: number): string {
    const landmark = LANDMARKS[city]
    const random = seeded(landmark.seed)
    const parts: string[] = []
    let x = 0
    while (x < width) {
        const houseWidth = 12 + random() * 12
        const wall = height * (0.16 + random() * 0.16)
        parts.push(
            random() < 0.6
                ? stepGable(x, houseWidth, wall, height)
                : pitched(x, houseWidth, wall, height)
        )
        x += houseWidth - 1
    }
    for (const [at, scale] of landmark.spires) {
        const centre = width * at
        const naveWidth = height * 0.62
        parts.push(pitched(centre - naveWidth * 0.1, naveWidth, height * 0.34, height))
        parts.push(spire(centre, height * scale, height))
    }
    return parts.join('')
}
