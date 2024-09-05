import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { GameAction, HydratableAction } from '@tabletop/common'
import { HydratedKaivaiGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type Celebrate = Static<typeof Celebrate>
export const Celebrate = Type.Composite([
    Type.Omit(GameAction, ['playerId']),
    Type.Object({
        type: Type.Literal(ActionType.Celebrate),
        playerId: Type.String(),
        islandId: Type.String()
    })
])

export const CelebrateValidator = TypeCompiler.Compile(Celebrate)

export function isCelebrate(action?: GameAction): action is Celebrate {
    return action?.type === ActionType.Celebrate
}

export class HydratedCelebrate extends HydratableAction<typeof Celebrate> implements Celebrate {
    declare type: ActionType.Celebrate
    declare playerId: string
    declare islandId: string

    constructor(data: Celebrate) {
        super(data, CelebrateValidator)
    }

    apply(state: HydratedKaivaiGameState) {
        const { valid, reason } = HydratedCelebrate.isValidIsland(state, this.islandId)

        if (!valid) {
            throw Error(reason)
        }
    }

    static isValidIsland(
        state: HydratedKaivaiGameState,
        islandId: string
    ): { valid: boolean; reason: string } {
        const board = state.board

        return { valid: true, reason: '' }
    }
}
