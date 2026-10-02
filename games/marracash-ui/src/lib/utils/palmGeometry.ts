export type FrondLayer = {
    count: number
    rotation: number
    length: number
    width: number
    teeth: number
    fill: string
    edge: string
    rib: string
}

export const PalmFrondLayers: FrondLayer[] = [
    {
        count: 8,
        rotation: 10,
        length: 36,
        width: 9,
        teeth: 6,
        fill: '#2f7a3c',
        edge: '#1f5a2a',
        rib: '#7fbf5f'
    },
    {
        count: 6,
        rotation: 32,
        length: 23,
        width: 6.5,
        teeth: 4,
        fill: '#5fa64f',
        edge: '#2f7a3c',
        rib: '#b5dd8f'
    }
]

export function frondPath({ length, width, teeth }: FrondLayer): string {
    const points = Array.from({ length: teeth * 2 }, (_, index) => {
        const step = index + 1
        const t = 0.08 + (0.92 * step) / (teeth * 2)
        const isTip = step % 2 === 1
        const halfWidth = width * Math.sin(Math.PI * Math.min(t, 0.98)) ** 0.8 * (isTip ? 1 : 0.45)
        return { x: halfWidth, y: -length * t + (isTip ? length * 0.05 : 0) }
    })
    const right = points.map(({ x, y }) => `${x} ${y}`)
    const left = points.toReversed().map(({ x, y }) => `${-x} ${y}`)
    return `M 0 0 L ${right.join(' L ')} L 0 ${-length} L ${left.join(' L ')} Z`
}

export function frondAngles({ count, rotation }: FrondLayer): number[] {
    return Array.from({ length: count }, (_, index) => rotation + (index * 360) / count)
}
