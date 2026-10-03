import { getPrng, type OffsetCoordinates, type RandomFunction } from '@tabletop/common'
import { shiftLightness } from '$lib/utils/colorLightness.js'

type FrondLayer = {
    counts: readonly number[]
    rotation: number
    length: number
    width: number
    teeth: number
    fill: string
    edge: string
    rib: string
}

type FrondShape = {
    length: number
    width: number
    bend: number
    leaflets: number[]
}

export type Frond = {
    angle: number
    path: string
    rib: string
    fill: string
    edge: string
    ribColor: string
}

const PalmFrondLayers: FrondLayer[] = [
    {
        counts: [8, 9],
        rotation: 10,
        length: 36,
        width: 9,
        teeth: 6,
        fill: '#2f7a3c',
        edge: '#1f5a2a',
        rib: '#7fbf5f'
    },
    {
        counts: [5, 6],
        rotation: 32,
        length: 23,
        width: 6.5,
        teeth: 4,
        fill: '#5fa64f',
        edge: '#2f7a3c',
        rib: '#b5dd8f'
    },
    {
        counts: [3, 4],
        rotation: 55,
        length: 14,
        width: 4,
        teeth: 3,
        fill: '#8cc66a',
        edge: '#4f8f3f',
        rib: '#d6efb5'
    }
]

const AngleJitter = 0.45
const LengthSpread = 0.2
const WidthSpread = 0.12
const BendSpread = 0.28
const LeafletSpread = 0.18
const ToneSpread = 0.04
const RibEnd = 0.92

function spread(random: RandomFunction, amount: number): number {
    return (random() * 2 - 1) * amount
}

function frondPath({ length, width, bend, leaflets }: FrondShape): string {
    const steps = leaflets.length * 2
    const points = Array.from({ length: steps }, (_, index) => {
        const step = index + 1
        const t = 0.08 + (0.92 * step) / steps
        const isTip = step % 2 === 1
        const leaflet = isTip ? leaflets[Math.floor(index / 2)] : 0.45
        const halfWidth = width * Math.sin(Math.PI * Math.min(t, 0.98)) ** 0.8 * leaflet
        return {
            halfWidth,
            midrib: bend * t * t,
            y: -length * t + (isTip ? length * 0.05 : 0)
        }
    })
    const right = points.map(({ halfWidth, midrib, y }) => `${midrib + halfWidth} ${y}`)
    const left = points.toReversed().map(({ halfWidth, midrib, y }) => `${midrib - halfWidth} ${y}`)
    return `M 0 0 L ${right.join(' L ')} L ${bend} ${-length} L ${left.join(' L ')} Z`
}

// The midrib x = bend·t², y = −length·t is a quadratic Bézier; this is its
// first RibEnd of the way, so the rib stops just short of the tip.
function ribPath({ length, bend }: FrondShape): string {
    return `M 0 0 Q 0 ${(-length * RibEnd) / 2} ${bend * RibEnd ** 2} ${-length * RibEnd}`
}

export function palmFronds(coords: OffsetCoordinates): Frond[] {
    const random = getPrng(coords.row * 100 + coords.col)
    const turn = random() * 360
    return PalmFrondLayers.flatMap((layer) => {
        const count = layer.counts[Math.floor(random() * layer.counts.length)]
        const gap = 360 / count
        return Array.from({ length: count }, (_, index) => {
            const length = layer.length * (1 + spread(random, LengthSpread))
            const shape: FrondShape = {
                length,
                width: layer.width * (1 + spread(random, WidthSpread)),
                bend: length * spread(random, BendSpread),
                leaflets: Array.from(
                    { length: layer.teeth },
                    () => 1 + spread(random, LeafletSpread)
                )
            }
            return {
                angle: turn + layer.rotation + index * gap + gap * spread(random, AngleJitter),
                path: frondPath(shape),
                rib: ribPath(shape),
                fill: shiftLightness(layer.fill, spread(random, ToneSpread)),
                edge: layer.edge,
                ribColor: layer.rib
            }
        })
    })
}
