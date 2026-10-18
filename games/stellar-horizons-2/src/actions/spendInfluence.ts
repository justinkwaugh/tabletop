import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { CASH_PER_INFLUENCE } from '../model/campaign.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type SpendInfluence = Type.Static<typeof SpendInfluence>
export const SpendInfluence = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.SpendInfluence),
            playerId: Type.String(),
            influence: Type.Number()
        })
    ])
)

export const SpendInfluenceValidator = Compile(SpendInfluence)

export function isSpendInfluence(action?: GameAction): action is SpendInfluence {
    return action?.type === ActionType.SpendInfluence
}

// IP's chart: an IP may be turned into $1B at any time, which here means whenever the Player
// is acting.
export class HydratedSpendInfluence
    extends HydratableAction<typeof SpendInfluence>
    implements SpendInfluence
{
    declare type: ActionType.SpendInfluence
    declare playerId: string
    declare influence: number

    constructor(data: SpendInfluence) {
        super(data, SpendInfluenceValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const player = state.getPlayerState(this.playerId)
        if (
            !Number.isInteger(this.influence) ||
            this.influence < 1 ||
            this.influence > player.influence
        ) {
            throw Error('Invalid SpendInfluence action')
        }
        player.influence -= this.influence
        player.cash += this.influence * CASH_PER_INFLUENCE
    }
}
