import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color, Hydratable, PlayerState, assertExists } from '@tabletop/common'
import { LocomotiveId, chainIndex } from './locomotives.js'

// A locomotive card a player has developed and the Production Units on it. Units shipped this
// production phase sit above the card until the phase ends.
export type Plant = Type.Static<typeof Plant>
export const Plant = Type.Object({
    locomotiveId: Type.Enum(LocomotiveId),
    units: Type.Number(),
    shipped: Type.Number()
})

export type LwPlayerState = Type.Static<typeof LwPlayerState>
export const LwPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            cash: Type.Number(),
            plants: Type.Array(Plant),
            // A player develops each locomotive only once, even after its card leaves play.
            developed: Type.Array(Type.Enum(LocomotiveId)),
            // The player asked to ship everything automatically until this Production phase ends.
            autoShip: Type.Optional(Type.Boolean())
        })
    ])
)

export const LwPlayerStateValidator = Compile(LwPlayerState)

export class HydratedLwPlayerState
    extends Hydratable<typeof LwPlayerState>
    implements LwPlayerState
{
    declare playerId: string
    declare color: Color
    declare cash: number
    declare plants: Plant[]
    declare developed: LocomotiveId[]
    declare autoShip?: boolean

    constructor(data: LwPlayerState) {
        super(data, LwPlayerStateValidator)
    }

    plant(locomotiveId: LocomotiveId): Plant | undefined {
        return this.plants.find((plant) => plant.locomotiveId === locomotiveId)
    }

    requirePlant(locomotiveId: LocomotiveId): Plant {
        const plant = this.plant(locomotiveId)
        assertExists(plant, `${this.playerId} has no ${locomotiveId} works`)
        return plant
    }

    addPlant(locomotiveId: LocomotiveId, units: number) {
        this.plants.push({ locomotiveId, units, shipped: 0 })
        this.plants.sort((a, b) => chainIndex(a.locomotiveId) - chainIndex(b.locomotiveId))
        this.developed.push(locomotiveId)
    }

    removeEmptyPlants() {
        this.plants = this.plants.filter((plant) => plant.units > 0)
    }

    totalUnits(): number {
        return this.plants.reduce((sum, plant) => sum + plant.units, 0)
    }
}
