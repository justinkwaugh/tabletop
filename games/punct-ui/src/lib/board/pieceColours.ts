import { SHADE_LEVELS, type Tone } from './pieceShape.js'

type Rgb = [number, number, number]

// As GIPF's discs: each slice of the side mixed from the tone's shaded to its lit colour by
// which way it faces, then across the piece rounded away from the light at either end. Black's
// rim catches more light than its flat top shows, so each piece's edge parts it from the next.
const PALETTE: Record<Tone, { lit: Rgb; shaded: Rgb }> = {
    light: { lit: [238, 241, 246], shaded: [108, 115, 126] },
    dark: { lit: [92, 98, 105], shaded: [0, 0, 0] }
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

function css([r, g, b]: Rgb, brightness = 1): string {
    const channel = (value: number) => Math.round(Math.min(255, value * brightness))
    return `rgb(${channel(r)} ${channel(g)} ${channel(b)})`
}

export function sideStops(tone: Tone, shade: number): { offset: number; colour: string }[] {
    const { lit, shaded } = PALETTE[tone]
    const facing = (shade / (SHADE_LEVELS - 1)) * 2 - 1
    const light = 0.55 + 0.45 * facing
    const base = mix(shaded, lit, Math.min(1, Math.max(0, light)))
    return [
        { offset: 0, colour: css(base, 0.75) },
        { offset: 0.32, colour: css(base, 1.06) },
        { offset: 1, colour: css(base, 0.62) }
    ]
}
