import { isFieldSquare, type HydratedSantiagoGameState } from '@tabletop/santiago'

// How alive the board looks, from 0 to 1 on each dial. Drought outweighs lushness, so a board
// going to desert returns to the harsh glare even while living fields remain.
export type LandMood = { lush: number; drought: number }

const LIVING_FIELDS_FOR_FULL_LUSH = 24
const DRIED_FIELDS_FOR_FULL_DROUGHT = 16

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
    const drought = Math.min(1, dried / DRIED_FIELDS_FOR_FULL_DROUGHT)
    const lush = Math.min(1, living / LIVING_FIELDS_FOR_FULL_LUSH) * (1 - drought)
    return { lush, drought }
}
