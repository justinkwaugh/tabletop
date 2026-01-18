import { AxialCoordinates, Hydratable, PlayerState } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Color } from '@tabletop/common'
import { Boat } from '../components/boat.js'

export type PlayerTile = Type.Static<typeof PlayerTile>
export const PlayerTile = Type.Object({})

export type KaivaiPlayerState = Type.Static<typeof KaivaiPlayerState>
export const KaivaiPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            score: Type.Number(),
            movementModiferPosition: Type.Number(),
            boats: Type.Array(Boat),
            boatLocations: Type.Record(Type.String(), AxialCoordinates),
            availableBoats: Type.Array(Type.String()),
            fishermen: Type.Number(),
            shells: Type.Array(Type.Number()),
            fish: Type.Array(Type.Number()),
            influence: Type.Number(),
            buildingCost: Type.Number(),
            baseMovement: Type.Number(),
            initialHutsPlaced: Type.Number(),
            tiles: Type.Number()
        })
    ])
)

export const KaivaiPlayerStateValidator = Compile(KaivaiPlayerState)

const movementModifiers = [0, 1, 2, 2, 3, 3, 4, 4, 5]

export class HydratedKaivaiPlayerState
    extends Hydratable<typeof KaivaiPlayerState>
    implements KaivaiPlayerState
{
    declare playerId: string
    declare color: Color
    declare score: number
    declare movementModiferPosition: number
    declare boats: Boat[]
    declare availableBoats: string[]
    declare boatLocations: Record<string, AxialCoordinates>
    declare fishermen: number
    declare shells: number[]
    declare fish: number[]
    declare influence: number
    declare buildingCost: number
    declare baseMovement: number
    declare initialHutsPlaced: number
    declare tiles: number

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

    returnBoat(boat: Boat) {
        this.boats.push(boat)
        delete this.boatLocations[boat.id]
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

    numFish(): number {
        return this.fish.reduce((sum, fish) => sum + fish, 0)
    }

    devaluedFish(): number {
        return this.numFish() - this.fish[0]
    }

    removeFish(amount: number) {
        let remaining = amount
        for (let i = 0; i < this.fish.length && remaining > 0; i++) {
            const fish = this.fish[i]
            if (fish >= remaining) {
                this.fish[i] -= remaining
                remaining = 0
            } else {
                this.fish[i] = 0
                remaining -= fish
            }
        }

        if (remaining > 0) {
            throw Error(`Player ${this.playerId} doesn't have enough fish to deliver ${amount}`)
        }
    }

    money(): number {
        return this.shells.reduce((sum, shells, index) => sum + shells * (index + 1), 0)
    }

    devaluedMoney(): number {
        return this.shells.reduce((sum, shells, index) => sum + shells * index, 0)
    }

    pay(amount: number) {
        let remaining = amount
        for (let i = 0; i < this.shells.length && remaining > 0; i++) {
            let shells = this.shells[i]
            const value = i + 1

            while (remaining > 0 && shells > 0) {
                shells -= 1
                remaining -= value
            }
            this.shells[i] = shells

            // make change
            if (remaining < 0) {
                this.shells[Math.abs(remaining) - 1] += 1
            }
        }

        if (remaining > 0) {
            throw Error(`Player ${this.playerId} doesn't have enough shells to pay ${amount}`)
        }
    }

    loseFishValue() {
        this.fish[0] = this.fish[1]
        this.fish[1] = this.fish[2]
        this.fish[2] = this.fish[3]
        this.fish[3] = this.fish[4]
        this.fish[4] = 0
    }

    loseShellValue() {
        this.shells[0] = this.shells[1]
        this.shells[1] = this.shells[2]
        this.shells[2] = this.shells[3]
        this.shells[3] = this.shells[4]
        this.shells[4] = 0
    }
}
