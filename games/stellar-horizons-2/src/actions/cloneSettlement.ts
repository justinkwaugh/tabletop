import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { CLONING_COST, cloningBases } from '../model/building.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { TurnStep } from '../model/turn.js'

export type CloneSettlement = Type.Static<typeof CloneSettlement>
export const CloneSettlement = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.CloneSettlement),
            playerId: Type.String(),
            systemId: Type.String()
        })
    ])
)

export const CloneSettlementValidator = Compile(CloneSettlement)

export function isCloneSettlement(action?: GameAction): action is CloneSettlement {
    return action?.type === ActionType.CloneSettlement
}

export class HydratedCloneSettlement
    extends HydratableAction<typeof CloneSettlement>
    implements CloneSettlement
{
    declare type: ActionType.CloneSettlement
    declare playerId: string
    declare systemId: string

    constructor(data: CloneSettlement) {
        super(data, CloneSettlementValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const player = state.getPlayerState(this.playerId)
        const base = state.base(this.playerId, this.systemId)
        if (
            !base ||
            player.step !== TurnStep.Build ||
            !cloningBases(state, this.playerId).includes(this.systemId)
        ) {
            throw Error('Invalid CloneSettlement action')
        }
        player.cash -= CLONING_COST
        base.settlements += 1
        base.cloned = true
    }

    static canCloneSettlement(state: HydratedStellarHorizonsGameState, playerId: string) {
        return (
            state.getPlayerState(playerId).step === TurnStep.Build &&
            cloningBases(state, playerId).length > 0
        )
    }
}
