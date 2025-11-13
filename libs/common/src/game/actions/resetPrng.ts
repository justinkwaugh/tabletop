import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { GameAction, HydratableAction } from '../engine/gameAction.js'
import { GameState } from '../model/gameState.js'
import { SystemActionType } from '../engine/systemActions.js'

export type ResetPrng = Static<typeof ResetPrng>
export const ResetPrng = Type.Composite([
    GameAction,
    Type.Object({
        type: Type.Literal(SystemActionType.ResetPrng),
        invocations: Type.Number()
    })
])

export const ResetPrngValidator = TypeCompiler.Compile(ResetPrng)

export function isResetPrng(action?: GameAction): action is ResetPrng {
    return action?.type === SystemActionType.ResetPrng
}

export class HydratedResetPrng extends HydratableAction<typeof ResetPrng> implements ResetPrng {
    declare type: SystemActionType.ResetPrng
    declare invocations: number

    constructor(data: ResetPrng) {
        super(data, ResetPrngValidator)
    }

    apply(state: GameState) {
        state.prng.invocations = this.invocations
    }
}
