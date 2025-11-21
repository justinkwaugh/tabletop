import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { HydratedKaivaiGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'

export type Increase = Static<typeof Increase>
export const Increase = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Increase),
            playerId: Type.String()
        })
    ])
)

export const IncreaseValidator = Compile(Increase)

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
        const playerState = state.getPlayerState(this.playerId)
        const { valid, reason } = HydratedIncrease.isValidIncrease(state, this.playerId)

        if (!valid) {
            throw Error(reason)
        }

        if (state.machineState === MachineState.TakingActions) {
            const requiredInfluence = state.influence[ActionType.Increase] ?? 0
            if (playerState.influence < requiredInfluence) {
                throw Error('Player does not have enough influence to fish')
            }

            if (requiredInfluence === 0) {
                state.influence[ActionType.Increase] = 1
            } else {
                playerState.influence -= requiredInfluence
                state.influence[ActionType.Increase] += requiredInfluence
            }
        }

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
