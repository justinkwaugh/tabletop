import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedDickeKartoffelnGameState } from '../model/gameState.js'
import { SunflowerChange, growSunflowers } from '../model/soil.js'

export type FarmSunflowers = Type.Static<typeof FarmSunflowers>
export const FarmSunflowers = Type.Object({
    playerId: Type.String(),
    changes: Type.Array(SunflowerChange)
})

export type GrowSunflowersMetadata = Type.Static<typeof GrowSunflowersMetadata>
export const GrowSunflowersMetadata = Type.Object({ farms: Type.Array(FarmSunflowers) })

export type GrowSunflowers = Type.Static<typeof GrowSunflowers>
export const GrowSunflowers = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.GrowSunflowers),
            metadata: Type.Optional(GrowSunflowersMetadata)
        })
    ])
)

export const GrowSunflowersValidator = Compile(GrowSunflowers)

export function isGrowSunflowers(action?: GameAction): action is GrowSunflowers {
    return action?.type === ActionType.GrowSunflowers
}

export class HydratedGrowSunflowers
    extends HydratableAction<typeof GrowSunflowers>
    implements GrowSunflowers
{
    declare type: ActionType.GrowSunflowers
    declare metadata?: GrowSunflowersMetadata

    constructor(data: GrowSunflowers) {
        super(data, GrowSunflowersValidator)
    }

    apply(state: HydratedDickeKartoffelnGameState, _context?: MachineContext) {
        this.metadata = {
            farms: state.players.map((player) => ({
                playerId: player.playerId,
                changes: player.fields.map(growSunflowers).filter((change) => change !== undefined)
            }))
        }
    }
}
