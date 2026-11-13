import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, Visibility } from '@tabletop/common'
import { CardIdSchema } from '../components/cards.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedKoenigrufenGameState } from '../model/gameState.js'

export type LayAwayResult = Type.Static<typeof LayAwayResult>
export const LayAwayResult = Type.Object({
    // Cards laid away face up, for every viewer: trumps, or in Farbendreier suit cards.
    shown: Type.Array(CardIdSchema)
})

// Declarer lays away as many cards as they took from the talon; only they see which, apart from
// those laid face up.
export type LayAway = Type.Static<typeof LayAway>
export const LayAway = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.LayAway),
            playerId: Type.String(),
            cardIds: Visibility.protect(Type.Array(CardIdSchema), {
                policy: Visibility.Policy.Actor
            }),
            metadata: Type.Optional(LayAwayResult)
        })
    ])
)

export const LayAwayValidator = Compile(LayAway)

export function isLayAway(action?: GameAction): action is LayAway {
    return action?.type === ActionType.LayAway
}

export class HydratedLayAway extends HydratableAction<typeof LayAway> implements LayAway {
    declare type: ActionType.LayAway
    declare playerId: string
    declare cardIds: string[]
    declare metadata?: LayAwayResult

    constructor(data: LayAway) {
        super(data, LayAwayValidator)
    }

    apply(state: HydratedKoenigrufenGameState) {
        this.metadata = { shown: state.layAway(this.playerId, this.cardIds) }
    }
}
