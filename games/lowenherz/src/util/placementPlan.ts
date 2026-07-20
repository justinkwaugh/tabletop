import { Color } from '@tabletop/common'

// One slot in the castle/knight setup-placement sequence: which player places, and
// which color they place it in (their own, or the shared neutral color).
export type PlacementSlot = {
    playerId: string
    color: Color
}

// Builds the full, ordered sequence of castle+knight placements for setup, following
// the rulebook's per-player-count variable construction rules:
//   - 4 players: each places 3 castles in their own color, round-robin (3 laps). No
//     neutral color is used at all.
//   - 3 players: each places 3 castles in their own color (3 laps), then each places
//     1 more castle in the shared neutral (4th) color (1 lap).
//   - 2 players: each places 4 castles in their own color (4 laps), then each places
//     2 castles in a third, neutral color (2 laps).
// Every player count places exactly 12 castles total, matching the physical
// component count (4 castles x 4 colors = 16, with 4 held back for a 2-player-only rule).
export function buildPlacementPlan(
    turnOrder: string[],
    colorForPlayer: (playerId: string) => Color,
    neutralColor: Color | undefined
): PlacementSlot[] {
    const plan: PlacementSlot[] = []
    const playerCount = turnOrder.length

    const ownLaps = playerCount === 2 ? 4 : 3
    for (let lap = 0; lap < ownLaps; lap++) {
        for (const playerId of turnOrder) {
            plan.push({ playerId, color: colorForPlayer(playerId) })
        }
    }

    if (playerCount === 3 || playerCount === 2) {
        if (!neutralColor) {
            throw new Error(`neutralColor is required for a ${playerCount}-player game`)
        }
        const neutralLaps = playerCount === 2 ? 2 : 1
        for (let lap = 0; lap < neutralLaps; lap++) {
            for (const playerId of turnOrder) {
                plan.push({ playerId, color: neutralColor })
            }
        }
    }

    return plan
}

// Setup progress is derived from the board itself (total castles placed so far) rather
// than tracked as separate mutable state - the Nth castle placed always corresponds to
// plan[N]. Returns undefined once every slot in the plan has been filled.
export function currentPlacementSlot(
    plan: PlacementSlot[],
    totalCastlesPlaced: number
): PlacementSlot | undefined {
    return plan[totalCastlesPlaced]
}

export function isSetupComplete(plan: PlacementSlot[], totalCastlesPlaced: number): boolean {
    return totalCastlesPlaced >= plan.length
}
