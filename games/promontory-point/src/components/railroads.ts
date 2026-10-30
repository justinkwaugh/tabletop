import type { AxialCoordinates } from '@tabletop/common'

export const RAILROAD_IDS = ['railroad.cp', 'railroad.up', 'railroad.kp', 'railroad.sp'] as const

export type RailroadId = (typeof RAILROAD_IDS)[number]

export type Railroad = {
    id: RailroadId
    name: string
    homeHex: AxialCoordinates
}

// R-0, R-1.1
export const RAILROADS: Record<RailroadId, Railroad> = {
    'railroad.cp': {
        id: 'railroad.cp',
        name: 'Central Pacific',
        homeHex: { q: -2, r: -4 }
    },
    'railroad.up': {
        id: 'railroad.up',
        name: 'Union Pacific',
        homeHex: { q: 6, r: -4 }
    },
    'railroad.kp': {
        id: 'railroad.kp',
        name: 'Kansas Pacific',
        homeHex: { q: 2, r: 4 }
    },
    'railroad.sp': {
        id: 'railroad.sp',
        name: 'Southern Pacific',
        homeHex: { q: -6, r: 4 }
    }
}
