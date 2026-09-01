import { NEUTRAL_OWNER, PieceOwner } from '../model/owner.js'

// One slot in the castle/knight setup-placement sequence: which player places, and
// who the placed piece belongs to (themselves, or the neutral prince).
export type PlacementSlot = {
    playerId: string
    owner: PieceOwner
}

// Builds the full, ordered sequence of castle+knight placements for setup, following
// the rulebook's per-player-count variable construction rules:
//   - 4 players: each places 3 of their own castles, round-robin (3 laps). There is no
//     neutral prince at all.
//   - 3 players: each places 3 of their own castles (3 laps), then each places
//     1 more castle for the neutral prince (1 lap).
//   - 2 players: each places 4 of their own castles (4 laps), then each places
//     2 castles for the neutral prince (2 laps).
// Every player count places exactly 12 castles total, matching the physical
// component count (4 castles x 4 colors = 16, with 4 held back for a 2-player-only rule).
export function buildPlacementPlan(
    turnOrder: string[],
    hasNeutralOwner: boolean
): PlacementSlot[] {
    const plan: PlacementSlot[] = []
    const playerCount = turnOrder.length

    const ownLaps = playerCount === 2 ? 4 : 3
    for (let lap = 0; lap < ownLaps; lap++) {
        for (const playerId of turnOrder) {
            plan.push({ playerId, owner: playerId })
        }
    }

    if (playerCount === 3 || playerCount === 2) {
        if (!hasNeutralOwner) {
            throw new Error(`a neutral prince is required for a ${playerCount}-player game`)
        }
        const neutralLaps = playerCount === 2 ? 2 : 1
        for (let lap = 0; lap < neutralLaps; lap++) {
            for (const playerId of turnOrder) {
                plan.push({ playerId, owner: NEUTRAL_OWNER })
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
