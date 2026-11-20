import { ActionSource, type GameAction, type Turn } from '@tabletop/common'
import { isDiscardWrit } from '@tabletop/feudum'

/** R-4.4-H5 An off-turn writ discard moves no decision on; the turn player's is a press. */
export function isOffTurnDiscard(action: GameAction, turnSeat: string | undefined): boolean {
    return isDiscardWrit(action) && action.playerId !== turnSeat
}

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
