import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type SolarFlareMetadata = Type.Static<typeof SolarFlareMetadata>
export const SolarFlareMetadata = Type.Object({
    newInstability: Type.Number(),
    unstableEnergy: Type.Array(
        Type.Object({
            playerId: Type.String(),
            initial: Type.Number(),
            remaining: Type.Number()
        })
    ),
    hurlBonus: Type.Optional(Type.String())
})

export type SolarFlare = Type.Static<typeof SolarFlare>
export const SolarFlare = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.SolarFlare),
            metadata: Type.Optional(SolarFlareMetadata)
        })
    ])
)

export const SolarFlareValidator = Compile(SolarFlare)

export function isSolarFlare(action?: GameAction): action is SolarFlare {
    return action?.type === ActionType.SolarFlare
}

export class HydratedSolarFlare extends HydratableAction<typeof SolarFlare> implements SolarFlare {
    declare type: ActionType.SolarFlare
    declare metadata?: SolarFlareMetadata

    constructor(data: SolarFlare) {
        super(data, SolarFlareValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        state.instability -= 1
        this.metadata = {
            newInstability: state.instability,
            unstableEnergy: []
        }
        for (const playerState of state.players) {
            if (playerState.energyCubes > 12) {
                const before = playerState.energyCubes
                playerState.energyCubes = Math.ceil(before / 2)
                this.metadata.unstableEnergy.push({
                    playerId: playerState.playerId,
                    initial: before,
                    remaining: playerState.energyCubes
                })
            }
        }
        if (state.hurled) {
            const currentPlayerId = state.turnManager.currentTurn()?.playerId
            if (!currentPlayerId) {
                throw Error('No current player')
            }
            const playerState = state.getPlayerState(currentPlayerId)
            playerState.momentum += 1
            this.metadata.hurlBonus = playerState.playerId
        }
    }
}
