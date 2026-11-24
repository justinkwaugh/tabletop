import { sum } from '../model/collections.js'
import type { ScrollSpaceId } from '../data/guilds.js'
import { rosaryBeadSum, unseenBeadValues } from '../model/beads.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { filledScrollSpaces } from '../model/scrolls.js'
import { plural } from '../model/words.js'

/** R-4.6-H1, R-4.6.4, R-4.6.5 Each pick holds a seal, once; `verb` and `cap` name the function's limit. */
export function reasonSealPicksRefused(
    state: HydratedFeudumGameState,
    spaces: readonly ScrollSpaceId[],
    verb: string,
    cap: number
): string | undefined {
    if (spaces.length > cap) {
        return `${verb} at most ${plural(cap, 'seal')}.`
    }
    const filled = filledScrollSpaces(state)
    const missing = spaces.some(
        (spaceId, index) => !filled.includes(spaceId) || spaces.indexOf(spaceId) < index
    )
    return missing ? 'No seal lies on that scroll space.' : undefined
}

export interface FlipTotals {
    readonly rosaryTotal: number
    readonly lowestTotal: number
    readonly highestTotal: number
}

/** R-4.6.4, R-4.6.5, R-5-H1 Reads no vault: the range the unseen values allow. */
export function flipTotals(state: HydratedFeudumGameState, flips: number): FlipTotals {
    const rosaryTotal = rosaryBeadSum(state)
    const unseen = unseenBeadValues(state)
    return {
        rosaryTotal,
        lowestTotal: rosaryTotal + sum(unseen.slice(0, flips)),
        highestTotal: rosaryTotal + sum(unseen.slice(unseen.length - flips))
    }
}
