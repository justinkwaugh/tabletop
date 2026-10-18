import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { ActionSpaceId } from '../editions/types.js'
import type { HydratedRailheadsGameState } from '../model/gameState.js'

export type ConsolidateMetadata = Type.Static<typeof ConsolidateMetadata>
export const ConsolidateMetadata = Type.Object({
    coins: Type.Number()
})

export type Consolidate = Type.Static<typeof Consolidate>
export const Consolidate = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Consolidate),
            playerId: Type.String(),
            metadata: Type.Optional(ConsolidateMetadata),
            space: Type.Enum(ActionSpaceId)
        })
    ])
)

export const ConsolidateValidator = Compile(Consolidate)

export function isConsolidate(action?: GameAction): action is Consolidate {
    return action?.type === ActionType.Consolidate
}

export class HydratedConsolidate
    extends HydratableAction<typeof Consolidate>
    implements Consolidate
{
    declare type: ActionType.Consolidate
    declare playerId: string
    declare metadata?: ConsolidateMetadata
    declare space: ActionSpaceId

    constructor(data: Consolidate) {
        super(data, ConsolidateValidator)
    }

    apply(state: HydratedRailheadsGameState, _context?: MachineContext) {
        assert(
            state.consolidatableSpaces().includes(this.space),
            `${this.space} holds no coins to collect`
        )
        const coins = state.spaceCoins(this.space)
        state.getPlayerState(this.playerId).cash += coins
        state.actionSpace(this.space).selections = 0
        this.metadata = { coins }
    }

    static canConsolidate(state: HydratedRailheadsGameState, playerId: string): boolean {
        return state.turnPlayerId() === playerId && state.consolidatableSpaces().length > 0
    }
}
