import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { GameAction, HydratableAction } from '@tabletop/common'
import { HydratedKaivaiGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type Increase = Static<typeof Increase>
export const Increase = Type.Composite([
    Type.Omit(GameAction, ['playerId']),
    Type.Object({
        type: Type.Literal(ActionType.Increase),
        playerId: Type.String()
    })
])

export const IncreaseValidator = TypeCompiler.Compile(Increase)

export function isIncrease(action?: GameAction): action is Increase {
    return action?.type === ActionType.Increase
}

export class HydratedIncrease extends HydratableAction<typeof Increase> implements Increase {
    declare type: ActionType.Increase
    declare playerId: string

    constructor(data: Increase) {
        super(data, IncreaseValidator)
    }

    apply(state: HydratedKaivaiGameState) {
        const { valid, reason } = HydratedIncrease.isValidIncrease(state, this.playerId)

        if (!valid) {
            throw Error(reason)
        }

        const playerState = state.getPlayerState(this.playerId)
        playerState.movementModiferPosition += 1
    }

    static isValidIncrease(
        state: HydratedKaivaiGameState,
        playerId: string
    ): { valid: boolean; reason: string } {
        const playerState = state.getPlayerState(playerId)
        if (playerState.movementModiferPosition === 8) {
            return { valid: false, reason: 'Movement is already maxed out' }
        }

        return { valid: true, reason: '' }
    }
}
