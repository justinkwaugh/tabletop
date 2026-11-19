import { ActionSource, type GameAction, type Turn } from '@tabletop/common'
import { isDiscardWrit } from '@tabletop/feudum'

/**
 * R-4.4-H5 A writ discarded at any time by a seat whose turn it isn't: play stays where it was, so
 * it moves no decision on. The turn player's own discard, down to the writ limit (R-4.4-H9) or not,
 * is a press of its turn. Outside a turn no discard is one.
 */
export function isOffTurnDiscard(action: GameAction, turnSeat: string | undefined): boolean {
    return isDiscardWrit(action) && action.playerId !== turnSeat
}

/** A seat's press that moves the game on: every one but another seat's off-turn discard. */
export function isDecisionPress(action: GameAction, turnSeat: string | undefined): boolean {
    return action.source === ActionSource.User && !isOffTurnDiscard(action, turnSeat)
}

/** R-3.2 Whose turn it was when the Action was played, from the public turn series. */
export function turnSeatAt(turns: readonly Turn[], { index }: GameAction): string | undefined {
    if (index === undefined) {
        return undefined
    }
    return turns.findLast(({ start, end }) => start <= index && (end === undefined || index < end))
        ?.playerId
}
