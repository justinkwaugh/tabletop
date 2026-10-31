import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedDickeKartoffelnGameState } from '../model/gameState.js'
import { FieldHarvest, harvestField } from '../model/harvest.js'

export type FarmHarvest = Type.Static<typeof FarmHarvest>
export const FarmHarvest = Type.Object({
    playerId: Type.String(),
    fields: Type.Array(FieldHarvest)
})

export type HarvestMetadata = Type.Static<typeof HarvestMetadata>
export const HarvestMetadata = Type.Object({ farms: Type.Array(FarmHarvest) })

export type Harvest = Type.Static<typeof Harvest>
export const Harvest = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.Harvest),
            metadata: Type.Optional(HarvestMetadata)
        })
    ])
)

export const HarvestValidator = Compile(Harvest)

export function isHarvest(action?: GameAction): action is Harvest {
    return action?.type === ActionType.Harvest
}

export class HydratedHarvest extends HydratableAction<typeof Harvest> implements Harvest {
    declare type: ActionType.Harvest
    declare metadata?: HarvestMetadata

    constructor(data: Harvest) {
        super(data, HarvestValidator)
    }

    apply(state: HydratedDickeKartoffelnGameState, _context?: MachineContext) {
        const message = state.messages?.current
        this.metadata = {
            farms: state.players.map((player) => ({
                playerId: player.playerId,
                fields: player.fields.flatMap((field) => {
                    const harvest = harvestField(field, message)
                    if (!harvest) return []
                    field.harvest = harvest.sacks
                    return [harvest]
                })
            }))
        }
    }
}
