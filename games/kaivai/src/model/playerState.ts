import { AxialCoordinates, Hydratable, PlayerState } from '@tabletop/common'
import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { PlayerColor } from '@tabletop/common'
import { Boat } from '../components/boat.js'

export type PlayerTile = Static<typeof PlayerTile>
export const PlayerTile = Type.Object({})

export type KaivaiPlayerState = Static<typeof KaivaiPlayerState>
export const KaivaiPlayerState = Type.Composite([
    PlayerState,
    Type.Object({
        score: Type.Number(),
        movementModiferPosition: Type.Number(),
        boats: Type.Array(Boat),
        boatLocations: Type.Record(Type.String(), AxialCoordinates),
        fishermen: Type.Number(),
        shells: Type.Array(Type.Number()),
        fish: Type.Array(Type.Number()),
        influence: Type.Number(),
        buildingCost: Type.Number(),
        baseMovement: Type.Number(),
        initialHutsPlaced: Type.Number()
    })
])

export const KaivaiPlayerStateValidator = TypeCompiler.Compile(KaivaiPlayerState)

const movementModifiers = [0, 1, 2, 2, 3, 3, 4, 4, 5]

export class HydratedKaivaiPlayerState
    extends Hydratable<typeof KaivaiPlayerState>
    implements KaivaiPlayerState
{
    declare playerId: string
    declare color: PlayerColor
    declare score: number
    declare movementModiferPosition: number
    declare boats: Boat[]
    declare boatLocations: Record<string, AxialCoordinates>
    declare fishermen: number
    declare shells: number[]
    declare fish: number[]
    declare influence: number
    declare buildingCost: number
    declare baseMovement: number
    declare initialHutsPlaced: number

    constructor(data: KaivaiPlayerState) {
        super(data, KaivaiPlayerStateValidator)
    }

    hasBoats(): boolean {
        return this.boats.length > 0
    }

    getBoat(): Boat {
        if (!this.hasBoats()) {
            throw Error(`Trying to get a boat from player ${this.playerId} but they have none`)
        }
        return this.boats.pop()!
    }

    hasFisherman(): boolean {
        return this.fishermen > 0
    }

    removeFisherman() {
        if (!this.hasFisherman()) {
            throw Error(`Trying to remove a fisherman from player
                ${this.playerId} but they have none`)
        }
        this.fishermen -= 1
    }

    movement(): number {
        return this.baseMovement + movementModifiers[this.movementModiferPosition]
    }

    money(): number {
        return this.shells.reduce((sum, shells, index) => sum + (shells * index + 1), 0)
    }
}
