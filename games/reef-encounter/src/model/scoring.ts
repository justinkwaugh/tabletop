import { CoralColors, type CoralCounts, coralCounts, totalCount } from '../components/colors.js'
import { faceUp, type CoralTileState } from '../components/coralTiles.js'
import type { HydratedReefEncounterPlayerState } from './playerState.js'

export type ScoreBreakdown = {
    parrotfishPolyps: CoralCounts
    total: number
    larvaCubes: number
    screenPolyps: number
}

// Each colour is worth 1, plus 1 for every coral tile showing it as the stronger coral.
export function coralValues(coralTiles: readonly CoralTileState[]): CoralCounts {
    const values = coralCounts(1)
    for (const tile of coralTiles) {
        values[faceUp(tile).stronger] += 1
    }
    return values
}

export function scoreBreakdown(
    player: HydratedReefEncounterPlayerState,
    values: CoralCounts
): ScoreBreakdown {
    const parrotfishPolyps = player.getParrotfishPolyps()
    return {
        parrotfishPolyps,
        total: CoralColors.reduce((sum, color) => sum + parrotfishPolyps[color] * values[color], 0),
        larvaCubes: totalCount(player.getLarvaCubes()),
        screenPolyps: player.screenPolypCount()
    }
}

// Rulebook p. 12 breaks ties by consumed polyps, unplayed larva cubes, unplayed screen polyps,
// then polyps under the player's shrimps; consumed polyps and shrimps join as they are built.
export function compareScores(a: ScoreBreakdown, b: ScoreBreakdown): number {
    return a.total - b.total || a.larvaCubes - b.larvaCubes || a.screenPolyps - b.screenPolyps
}
