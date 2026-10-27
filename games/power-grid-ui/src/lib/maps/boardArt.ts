import { MapId } from '@tabletop/power-grid'
import type { MapArt } from './mapArt.js'
import { GERMANY_ART } from './germanyArt.js'

const ART: Record<MapId, MapArt> = {
    [MapId.Germany]: GERMANY_ART
}

export function mapArt(id: MapId): MapArt {
    return ART[id]
}

/** Region tints taken from the printed board, muted so the houses stand out. */
export const REGION_FILLS: Record<string, string> = {
    teal: '#6f9e90',
    brown: '#a7835f',
    red: '#bb6a5e',
    yellow: '#cbb65e',
    blue: '#6d8db1',
    purple: '#8e78a4'
}

export const OUT_OF_PLAY_FILL = '#a9a698'
