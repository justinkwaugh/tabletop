import type { RailroadId } from '@tabletop/promontory-point'

// Art plan, "Palette": the railroad colours sampled from the home hexes, on railroad things only.
const RAILROAD_COLOURS: Record<RailroadId, string> = {
    'railroad.cp': 'var(--pp-cp)',
    'railroad.up': 'var(--pp-up)',
    'railroad.kp': 'var(--pp-kp)',
    'railroad.sp': 'var(--pp-sp)'
}

export function railroadColour(railroadId: RailroadId): string {
    return RAILROAD_COLOURS[railroadId]
}

// Southern Pacific's light yellow takes the dark ink.
export function railroadInk(railroadId: RailroadId): string {
    return railroadId === 'railroad.sp' ? 'var(--pp-ink)' : 'var(--pp-rr-ink)'
}
