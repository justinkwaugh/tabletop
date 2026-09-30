import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { reasonNotYourTurn } from '../util/turn.js'
import { forgoFreeActionNow, freeActionTypesNow } from '../util/freeActions.js'

export type ForgoFreeActionMetadata = Type.Static<typeof ForgoFreeActionMetadata>
export const ForgoFreeActionMetadata = Type.Object({
    forgone: Type.Union([Type.Literal(ActionType.Travel), Type.Literal(ActionType.Campaign)])
})

export type ForgoFreeAction = Type.Static<typeof ForgoFreeAction>
export const ForgoFreeAction = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ForgoFreeAction),
            playerId: Type.String(),
            metadata: Type.Optional(ForgoFreeActionMetadata)
        })
    ])
)

export const ForgoFreeActionValidator = Compile(ForgoFreeAction)

export function isForgoFreeAction(action?: GameAction): action is ForgoFreeAction {
    return action?.type === ActionType.ForgoFreeAction
}

export class HydratedForgoFreeAction
    extends HydratableAction<typeof ForgoFreeAction>
    implements ForgoFreeAction
{
    declare type: ActionType.ForgoFreeAction
    declare playerId: string
    declare metadata?: ForgoFreeActionMetadata

    constructor(data: ForgoFreeAction) {
        super(data, ForgoFreeActionValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        this.revealsInfo = false
        const reason = HydratedForgoFreeAction.reasonCannotForgoFreeAction(state, this.playerId)
        if (reason) {
            throw Error(`Cannot give up a free action: ${reason}`)
        }
        this.metadata = { forgone: forgoFreeActionNow(state, this.playerId) }
    }

    static reasonCannotForgoFreeAction(
        state: HydratedOathGameState,
        playerId: string
    ): string | undefined {
        const notYours = reasonNotYourTurn(state, playerId)
        if (notYours) return notYours
        if (freeActionTypesNow(state, playerId).length === 0) return 'no free action is due'
        return undefined
    }

    static canDoForgoFreeAction(state: HydratedOathGameState, playerId: string): boolean {
        return HydratedForgoFreeAction.reasonCannotForgoFreeAction(state, playerId) === undefined
    }
}
