import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedPowerGridGameState } from '../model/gameState.js'

export type PassAuction = Type.Static<typeof PassAuction>
export const PassAuction = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PassAuction),
            playerId: Type.String()
        })
    ])
)

export const PassAuctionValidator = Compile(PassAuction)

export function isPassAuction(action?: GameAction): action is PassAuction {
    return action?.type === ActionType.PassAuction
}

export class HydratedPassAuction
    extends HydratableAction<typeof PassAuction>
    implements PassAuction
{
    declare type: ActionType.PassAuction
    declare playerId: string

    constructor(data: PassAuction) {
        super(data, PassAuctionValidator)
    }

    apply(state: HydratedPowerGridGameState, _context?: MachineContext) {
        if (!HydratedPassAuction.canPass(state, this.playerId)) {
            throw Error('Invalid PassAuction action')
        }
        state.endTurn(this.playerId)
    }

    // Recharged p. 4: everyone buys a plant in the first round.
    static canPass(state: HydratedPowerGridGameState, _playerId: string): boolean {
        return !state.isFirstRound()
    }
}
