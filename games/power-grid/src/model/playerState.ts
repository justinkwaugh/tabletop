import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color, Hydratable, PlayerState } from '@tabletop/common'
import { ResourceAmounts } from '../components/resources.js'
import { canStore, plantsOf, storageRoom } from './fuel.js'
import type { PowerPlant } from '../components/plants.js'

export type PowerGridPlayerState = Type.Static<typeof PowerGridPlayerState>
export const PowerGridPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            money: Type.Integer({ minimum: 0 }),
            plants: Type.Array(Type.Integer()),
            resources: ResourceAmounts
        })
    ])
)

export const PowerGridPlayerStateValidator = Compile(PowerGridPlayerState)

export class HydratedPowerGridPlayerState
    extends Hydratable<typeof PowerGridPlayerState>
    implements PowerGridPlayerState
{
    declare playerId: string
    declare color: Color
    declare money: number
    declare plants: number[]
    declare resources: ResourceAmounts

    constructor(data: PowerGridPlayerState) {
        super(data, PowerGridPlayerStateValidator)
    }

    ownedPlants(): PowerPlant[] {
        return plantsOf(this.plants)
    }

    largestPlant(): number {
        return Math.max(0, ...this.plants)
    }

    canHold(resources: ResourceAmounts): boolean {
        return canStore(this.ownedPlants(), resources)
    }

    storageRoom(): ResourceAmounts {
        return storageRoom(this.ownedPlants(), this.resources)
    }
}
