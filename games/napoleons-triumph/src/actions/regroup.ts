import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { NapoleonsTriumphAction } from './gameAction.js'
import { AttackEndMetadata } from './attackEnd.js'
import { regroup } from '../model/attackDecisions.js'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'

export type Regroup = Type.Static<typeof Regroup>
export const Regroup = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Regroup),
            playerId: Type.String(),
            metadata: Type.Optional(AttackEndMetadata),
            keep: Type.Record(Type.String(), Type.String())
        })
    ])
)

export const RegroupValidator = Compile(Regroup)

export function isRegroup(action?: GameAction): action is Regroup {
    return action?.type === ActionType.Regroup
}

export class HydratedRegroup extends NapoleonsTriumphAction<typeof Regroup> implements Regroup {
    declare type: ActionType.Regroup
    declare playerId: string
    declare keep: Record<string, string>

    constructor(data: Regroup) {
        super(data, RegroupValidator)
    }

    protected perform(state: HydratedNapoleonsTriumphGameState) {
        regroup(state, this.playerId, this.keep)
    }
}
