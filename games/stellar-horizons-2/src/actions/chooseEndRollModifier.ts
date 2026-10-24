import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { capabilitiesOf } from '../model/fleet.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

// Transcend Biology: its owner announces, before the end roll, whether to move its chance up or
// down by 3%. It is set in the development step and stands until changed, in view of everyone.
export type ChooseEndRollModifier = Type.Static<typeof ChooseEndRollModifier>
export const ChooseEndRollModifier = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseEndRollModifier),
            playerId: Type.String(),
            amount: Type.Number()
        })
    ])
)

export const ChooseEndRollModifierValidator = Compile(ChooseEndRollModifier)

export function isChooseEndRollModifier(action?: GameAction): action is ChooseEndRollModifier {
    return action?.type === ActionType.ChooseEndRollModifier
}

export function endRollModifierChoices(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): number[] {
    const limit = capabilitiesOf(state, playerId).endRollModifier
    return limit > 0 ? [-limit, 0, limit] : []
}

export class HydratedChooseEndRollModifier
    extends HydratableAction<typeof ChooseEndRollModifier>
    implements ChooseEndRollModifier
{
    declare type: ActionType.ChooseEndRollModifier
    declare playerId: string
    declare amount: number

    constructor(data: ChooseEndRollModifier) {
        super(data, ChooseEndRollModifierValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const player = state.getPlayerState(this.playerId)
        if (
            !endRollModifierChoices(state, this.playerId).includes(this.amount) ||
            (player.endRollModifier ?? 0) === this.amount
        ) {
            throw Error('Invalid ChooseEndRollModifier action')
        }
        player.endRollModifier = this.amount
    }
}
