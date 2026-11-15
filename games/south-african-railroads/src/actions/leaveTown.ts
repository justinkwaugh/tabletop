import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { AutomaticDevelopment, developAutomatically } from '../model/development.js'
import type { HydratedSarGameState } from '../model/gameState.js'

export type LeaveTownMetadata = Type.Static<typeof LeaveTownMetadata>
export const LeaveTownMetadata = Type.Object({
    income: Type.Number(),
    automatic: Type.Optional(AutomaticDevelopment)
})

export type LeaveTown = Type.Static<typeof LeaveTown>
export const LeaveTown = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.LeaveTown),
            playerId: Type.String(),
            metadata: Type.Optional(LeaveTownMetadata),
            settlementId: Type.String()
        })
    ])
)

export const LeaveTownValidator = Compile(LeaveTown)

export function isLeaveTown(action?: GameAction): action is LeaveTown {
    return action?.type === ActionType.LeaveTown
}

// Takes a development cube from a settlement into the player's own area, where it pays at every
// dividend, then triggers Automatic Metro Development.
export class HydratedLeaveTown extends HydratableAction<typeof LeaveTown> implements LeaveTown {
    declare type: ActionType.LeaveTown
    declare playerId: string
    declare metadata?: LeaveTownMetadata
    declare settlementId: string

    constructor(data: LeaveTown) {
        super(data, LeaveTownValidator)
    }

    apply(state: HydratedSarGameState, _context?: MachineContext) {
        assert(
            state.leaveTownOptions(this.playerId).includes(this.settlementId),
            'You cannot take a cube from that settlement'
        )
        state.developments[this.settlementId] = state.developmentLevel(this.settlementId) - 1
        state.getPlayerState(this.playerId).leaveTownCubes += 1
        const income = state.settlementIncome(this.settlementId)
        const automatic = developAutomatically(state)
        this.metadata = automatic ? { income, automatic } : { income }
    }

    static canLeaveTown(state: HydratedSarGameState, playerId: string): boolean {
        return state.leaveTownOptions(playerId).length > 0
    }
}
