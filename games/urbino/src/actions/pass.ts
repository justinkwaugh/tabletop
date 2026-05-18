import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedUrbinoGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { hasAnyValidPlacement, hasAnyValidPlacementAfterReposition } from '../logic/board.js'

export type PassMetadata = Type.Static<typeof PassMetadata>
export const PassMetadata = Type.Object({})

export type Pass = Type.Static<typeof Pass>
export const Pass = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Pass),
            playerId: Type.String(),
            metadata: Type.Optional(PassMetadata),
        })
    ])
)

export const PassValidator = Compile(Pass)

export function isPass(action?: GameAction): action is Pass {
    return action?.type === ActionType.Pass
}

export class HydratedPass extends HydratableAction<typeof Pass> implements Pass {
    declare type: ActionType.Pass
    declare playerId: string
    declare metadata?: PassMetadata

    constructor(data: Pass) {
        super(data, PassValidator)
    }

    apply(state: HydratedUrbinoGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid Pass action')
        }
        state.consecutivePasses++
        state.hasRepositionedThisTurn = false
        this.metadata = {}
    }

    isValid(state: HydratedUrbinoGameState): boolean {
        return HydratedPass.canPass(state, this.playerId)
    }

    static canPass(state: HydratedUrbinoGameState, playerId: string): boolean {
        const player = state.getPlayerState(playerId)
        const buildings = player.remainingBuildings
        if (hasAnyValidPlacement(state.board, state.architects, playerId, buildings, state.monumentsVariant)) return false
        if (!state.hasRepositionedThisTurn) {
            return !hasAnyValidPlacementAfterReposition(state.board, state.architects, playerId, buildings, state.monumentsVariant)
        }
        return true
    }
}
