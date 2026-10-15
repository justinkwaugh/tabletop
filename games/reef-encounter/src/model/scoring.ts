import { CoralColors, type CoralCounts, coralCounts, totalCount } from '../components/colors.js'
import { faceUp, type CoralTileState } from '../components/coralTiles.js'
import type { HydratedReefEncounterPlayerState } from './playerState.js'

export type ScoreBreakdown = {
    parrotfishPolyps: CoralCounts
    total: number
    consumedPolyps: number
    larvaCubes: number
    supplyPolyps: number
    guardedPolyps: number
}

// Each colour is worth 1, plus 1 for every coral tile showing it as the stronger coral.
export function coralValues(coralTiles: readonly CoralTileState[]): CoralCounts {
    const values = coralCounts(1)
    for (const tile of coralTiles) {
        values[faceUp(tile).stronger] += 1
    }
    return values
}

export function parrotfishPoints(polyps: CoralCounts, values: CoralCounts): number {
    return CoralColors.reduce((sum, color) => sum + polyps[color] * values[color], 0)
}

export function scoreBreakdown(
    player: HydratedReefEncounterPlayerState,
    values: CoralCounts,
    guardedPolyps: number
): ScoreBreakdown {
    const parrotfishPolyps = player.getParrotfishPolyps()
    return {
        parrotfishPolyps,
        total: parrotfishPoints(parrotfishPolyps, values),
        consumedPolyps: totalCount(player.consumedPolyps),
        larvaCubes: totalCount(player.getLarvaCubes()),
        supplyPolyps: player.supplyPolypCount(),
        guardedPolyps
    }
}

// Rulebook p. 12 breaks ties by consumed polyps, unplayed larva cubes, unplayed supply polyps,
// then polyps in corals the player's shrimps protect.
export const TieBreakOrder = [
    'consumedPolyps',
    'larvaCubes',
    'supplyPolyps',
    'guardedPolyps'
] as const satisfies readonly (keyof ScoreBreakdown)[]

export type TieBreakCriterion = (typeof TieBreakOrder)[number]

export function compareScores(a: ScoreBreakdown, b: ScoreBreakdown): number {
    for (const key of ['total', ...TieBreakOrder] as const) {
        if (a[key] !== b[key]) return a[key] - b[key]
    }
    return 0
}
