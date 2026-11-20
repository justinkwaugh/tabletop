import { assert } from '@tabletop/common'
import { ActionType } from './actions.js'

/**
 * R-X.2 Every Action that can reveal hidden information, so can't be undone: those whose every send
 * reveals (their schema fixes `revealsInfo` to true) and those whose `apply` decides. An Action sets
 * the flag only through `markRevealsInfo`, which holds it to this list.
 */
export const RevealingActionTypes: readonly ActionType[] = [
    ActionType.FinaliseHand,
    ActionType.PlaceDisc,
    ActionType.GuildAction,
    ActionType.Feast,
    ActionType.Explore,
    ActionType.KeepWrits,
    ActionType.Improve,
    ActionType.Harvest,
    ActionType.Conquer,
    ActionType.AnswerAttack,
    ActionType.StarveThePeople,
    ActionType.AnswerStarve,
    ActionType.PlayMandate,
    ActionType.RevealPouches,
    ActionType.RollProgressDie,
    ActionType.ReplenishMap,
    ActionType.ReplenishGuilds,
    ActionType.ScoreGame
]

/** R-X.2 Sets whether this send revealed; only a declared Action may. */
export function markRevealsInfo(
    action: { readonly type: string; revealsInfo?: boolean },
    revealed: boolean
): void {
    assert(
        !revealed || RevealingActionTypes.some((type) => type === action.type),
        `R-X.2 ${action.type} reveals, so it is declared in RevealingActionTypes`
    )
    action.revealsInfo = revealed
}
