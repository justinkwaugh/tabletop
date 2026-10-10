import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { attach } from '../model/attach.js'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'

export type Attach = Type.Static<typeof Attach>
export const Attach = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Attach),
            playerId: Type.String(),
            commanderId: Type.String(),
            unitId: Type.String()
        })
    ])
)

export const AttachValidator = Compile(Attach)

export function isAttach(action?: GameAction): action is Attach {
    return action?.type === ActionType.Attach
}

export class HydratedAttach extends HydratableAction<typeof Attach> implements Attach {
    declare type: ActionType.Attach
    declare playerId: string
    declare commanderId: string
    declare unitId: string

    constructor(data: Attach) {
        super(data, AttachValidator)
    }

    apply(state: HydratedNapoleonsTriumphGameState) {
        attach(state, this.playerId, this.commanderId, this.unitId)
    }
}
