import { isFieldSquare, type HydratedSantiagoGameState } from '@tabletop/santiago'

// How alive the board looks, from 0 to 1 on each dial. Drought holds off until half the placed
// fields have dried, then grows to full as the rest dry, and outweighs lushness, so a board going
// to desert returns to the harsh glare even while living fields remain.
export type LandMood = { lush: number; drought: number }

const LIVING_FIELDS_FOR_FULL_LUSH = 24
const DRIED_SHARE_FOR_DROUGHT = 0.5

export function landMood(state: HydratedSantiagoGameState): LandMood {
    let living = 0
    let dried = 0
    for (const column of state.board.squares) {
        for (const square of column) {
            if (!isFieldSquare(square)) continue
            if (square.dried) dried++
            else living++
        }
    }
    const driedShare = dried / Math.max(1, living + dried)
    const drought = Math.max(
        0,
        (driedShare - DRIED_SHARE_FOR_DROUGHT) / (1 - DRIED_SHARE_FOR_DROUGHT)
    )
    const lush = Math.min(1, living / LIVING_FIELDS_FOR_FULL_LUSH) * (1 - drought)
    return { lush, drought }
}
