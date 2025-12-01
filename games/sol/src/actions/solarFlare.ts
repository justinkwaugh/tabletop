import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type SolarFlareMetadata = Static<typeof SolarFlareMetadata>
export const SolarFlareMetadata = Type.Object({})

export type SolarFlare = Static<typeof SolarFlare>
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
    declare playerId: string
    declare metadata?: SolarFlareMetadata

    constructor(data: SolarFlare) {
        super(data, SolarFlareValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        state.instability -= 1
        for (const playerState of state.players) {
            if (playerState.energyCubes > 12) {
                playerState.energyCubes = Math.floor(playerState.energyCubes / 2)
            }
        }
    }
}
