import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedDickeKartoffelnGameState } from '../model/gameState.js'
import { SoilChange, reactSoil } from '../model/soil.js'

export type FarmSoil = Type.Static<typeof FarmSoil>
export const FarmSoil = Type.Object({
    playerId: Type.String(),
    changes: Type.Array(SoilChange)
})

export type ReactSoilMetadata = Type.Static<typeof ReactSoilMetadata>
export const ReactSoilMetadata = Type.Object({ farms: Type.Array(FarmSoil) })

export type ReactSoil = Type.Static<typeof ReactSoil>
export const ReactSoil = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.ReactSoil),
            metadata: Type.Optional(ReactSoilMetadata)
        })
    ])
)

export const ReactSoilValidator = Compile(ReactSoil)

export function isReactSoil(action?: GameAction): action is ReactSoil {
    return action?.type === ActionType.ReactSoil
}

export class HydratedReactSoil extends HydratableAction<typeof ReactSoil> implements ReactSoil {
    declare type: ActionType.ReactSoil
    declare metadata?: ReactSoilMetadata

    constructor(data: ReactSoil) {
        super(data, ReactSoilValidator)
    }

    apply(state: HydratedDickeKartoffelnGameState, _context?: MachineContext) {
        this.metadata = {
            farms: state.players.map((player) => ({
                playerId: player.playerId,
                changes: player.fields.map(reactSoil).filter((change) => change !== undefined)
            }))
        }
    }
}
