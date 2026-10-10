import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { regroup } from '../model/attackFlow.js'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'

export type Regroup = Type.Static<typeof Regroup>
export const Regroup = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Regroup),
            playerId: Type.String(),
            /** For each repulsed corps, the unit that stays in it. */
            keep: Type.Record(Type.String(), Type.String())
        })
    ])
)

export const RegroupValidator = Compile(Regroup)

export function isRegroup(action?: GameAction): action is Regroup {
    return action?.type === ActionType.Regroup
}

export class HydratedRegroup extends HydratableAction<typeof Regroup> implements Regroup {
    declare type: ActionType.Regroup
    declare playerId: string
    declare keep: Record<string, string>

    constructor(data: Regroup) {
        super(data, RegroupValidator)
    }

    apply(state: HydratedNapoleonsTriumphGameState) {
        regroup(state, this.playerId, this.keep)
    }
}
