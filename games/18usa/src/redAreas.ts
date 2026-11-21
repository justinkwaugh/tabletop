import { assertExists, shuffle, type Prng } from '@tabletop/common'
import { createStagedTileRevenue, type TileRevenue } from '@tabletop/18xx'
import { MexicoLocationIds } from './mapFeatures.js'

export const RedAreaIds = [
    'winnipeg',
    'montreal',
    'seattle',
    'san-francisco',
    'mexico',
    'port-of-new-orleans',
    'florida'
] as const
export type RedAreaId = (typeof RedAreaIds)[number]

export type RedArea = {
    id: RedAreaId
    name: string
    locationIds: readonly string[]
    /** Montreal, Mexico and the Port of New Orleans may only begin or end a route (§12.4.1). */
    routeEnd: boolean
}

export const RedAreas: readonly RedArea[] = [
    { id: 'winnipeg', name: 'Winnipeg', locationIds: ['A15'], routeEnd: false },
    { id: 'montreal', name: 'Montreal', locationIds: ['A27'], routeEnd: true },
    { id: 'seattle', name: 'Seattle', locationIds: ['B2'], routeEnd: false },
    { id: 'san-francisco', name: 'San Francisco', locationIds: ['E1'], routeEnd: false },
    { id: 'mexico', name: 'Mexico', locationIds: MexicoLocationIds, routeEnd: true },
    {
        id: 'port-of-new-orleans',
        name: 'Port of New Orleans',
        locationIds: ['J20'],
        routeEnd: true
    },
    { id: 'florida', name: 'Florida', locationIds: ['J24'], routeEnd: false }
]

export function redAreaOf(locationId: string): RedArea | undefined {
    return RedAreas.find((area) => area.locationIds.includes(locationId))
}

/** A red or gray area's values in phases 2, 3–4, 5–6 and 7–8 (§2.6, §8). */
export type PhaseValues = readonly [number, number, number, number]
export type RedAreaToken = { id: string; values: PhaseValues }

/** The red-area value tokens drawn at setup. */
export const RedAreaTokens: readonly RedAreaToken[] = [
    { id: 'red-1', values: [20, 30, 40, 50] },
    { id: 'red-2', values: [20, 30, 40, 60] },
    { id: 'red-3', values: [20, 30, 50, 60] },
    { id: 'red-4', values: [20, 30, 60, 90] },
    { id: 'red-5', values: [20, 40, 50, 80] },
    { id: 'red-6', values: [30, 40, 40, 50] },
    { id: 'red-7', values: [30, 40, 50, 60] },
    { id: 'red-8', values: [30, 50, 60, 80] },
    { id: 'red-9', values: [30, 50, 60, 80] },
    { id: 'red-10', values: [40, 50, 40, 40] }
]

/** The token P6 Import / Export Hub places over a red area's own. */
export const ImportExportHubToken: RedAreaToken = { id: 'import-export', values: [30, 40, 50, 80] }

export function redAreaToken(tokenId: string): RedAreaToken {
    const token = [...RedAreaTokens, ImportExportHubToken].find((entry) => entry.id === tokenId)
    assertExists(token, `Unknown red-area token ${tokenId}`)
    return token
}

/** The stages are the newest tile colour the phase allows, as the token's coloured sections. */
export const PhaseValueStages = ['yellow', 'green', 'brown', 'gray'] as const

export function phaseValuesRevenue(values: PhaseValues): TileRevenue {
    return createStagedTileRevenue(
        PhaseValueStages.map((stage, index) => [stage, values[index]] as const)
    )
}

export type RedAreaAssignment = Readonly<Record<RedAreaId, string>>

/** Deals one random token to each red area; the rest go back to the box (§2.6). */
export function assignRedAreaTokens(prng: Prng): RedAreaAssignment {
    const tokenIds = RedAreaTokens.map((token) => token.id)
    shuffle(tokenIds, prng.random)
    return {
        winnipeg: tokenIds[0],
        montreal: tokenIds[1],
        seattle: tokenIds[2],
        'san-francisco': tokenIds[3],
        mexico: tokenIds[4],
        'port-of-new-orleans': tokenIds[5],
        florida: tokenIds[6]
    }
}
