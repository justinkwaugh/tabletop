import { assertExists, Hydratable, PlayerState } from '@tabletop/common'
import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { Color } from '@tabletop/common'
import { Card } from '../components/cards.js'
import { Sundiver } from '../components/sundiver.js'
import { SolarGate } from '../components/solarGate.js'
import { EnergyNode, SundiverFoundry, TransmitTower } from '../components/stations.js'

export type SolPlayerState = Static<typeof SolPlayerState>
export const SolPlayerState = Type.Evaluate(
    Type.Intersect([
        PlayerState,
        Type.Object({
            score: Type.Number(),
            holdSundivers: Type.Array(Sundiver),
            reserveSundivers: Type.Array(Sundiver),
            energyCubes: Type.Number(),
            solarGates: Type.Array(SolarGate),
            energyNodes: Type.Array(EnergyNode),
            sundiverFoundries: Type.Array(SundiverFoundry),
            transmitTowers: Type.Array(TransmitTower),
            movement: Type.Number(),
            movementPoints: Type.Number(),
            card: Type.Optional(Card),
            drawnCards: Type.Array(Card),
            momentum: Type.Number({ default: 0 })
        })
    ])
)

export const SolPlayerStateValidator = Compile(SolPlayerState)

export class HydratedSolPlayerState
    extends Hydratable<typeof SolPlayerState>
    implements SolPlayerState
{
    declare playerId: string
    declare color: Color
    declare score: number
    declare holdSundivers: Sundiver[]
    declare reserveSundivers: Sundiver[]
    declare energyCubes: number
    declare solarGates: SolarGate[]
    declare energyNodes: EnergyNode[]
    declare sundiverFoundries: SundiverFoundry[]
    declare transmitTowers: TransmitTower[]
    declare movement: number
    declare movementPoints: number
    declare card?: Card
    declare drawnCards: Card[]
    declare momentum: number

    constructor(data: SolPlayerState) {
        super(data, SolPlayerStateValidator)
    }

    public numSundiversInHold(playerId?: string) {
        const owner = playerId ?? this.playerId
        return this.holdSundivers.filter((sundiver) => sundiver.playerId === owner).length
    }

    public removeSundiversFromHold(numSundivers: number, playerId?: string): Sundiver[] {
        const owner = playerId ?? this.playerId
        const ownerSundivers = this.holdSundivers.filter((sundiver) => sundiver.playerId === owner)
        if (ownerSundivers.length < numSundivers) {
            throw new Error(`Player ${owner} only has ${ownerSundivers.length} sundivers in hold`)
        }
        const nonOwnerSundivers = this.holdSundivers.filter(
            (sundiver) => sundiver.playerId !== owner
        )
        const removedSundivers = ownerSundivers.splice(0, numSundivers)

        this.holdSundivers = [...nonOwnerSundivers, ...ownerSundivers]
        for (const sundiver of removedSundivers) {
            sundiver.hold = undefined
        }

        return removedSundivers
    }

    public addSundiversToHold(sundivers: Sundiver[]) {
        for (const sundiver of sundivers) {
            sundiver.hold = this.playerId
        }
        this.holdSundivers.push(...sundivers)
    }

    public holdSundiversPerPlayer(): Map<string, Sundiver[]> {
        const map = new Map<string, Sundiver[]>()
        for (const sundiver of this.holdSundivers) {
            if (!map.has(sundiver.playerId)) {
                map.set(sundiver.playerId, [])
            }
            map.get(sundiver.playerId)!.push(sundiver)
        }
        return map
    }

    public addSundiversToReserve(sundivers: Sundiver[]) {
        for (const sundiver of sundivers) {
            sundiver.reserve = true
        }
        this.reserveSundivers.push(...sundivers)
    }

    public removeSundiversFromReserve(numSundivers: number): Sundiver[] {
        if (this.reserveSundivers.length < numSundivers) {
            throw new Error(
                `Player ${this.playerId} only has ${this.reserveSundivers.length} sundivers in reserve`
            )
        }
        const removedSundivers = this.reserveSundivers.splice(0, numSundivers)
        for (const sundiver of removedSundivers) {
            sundiver.reserve = false
        }
        return removedSundivers
    }

    public removeSolarGate(): SolarGate {
        const solarGate = this.solarGates.pop()
        assertExists(solarGate, 'No solar gate to remove')
        return solarGate
    }

    public removeEnergyNode(): EnergyNode {
        const energyNode = this.energyNodes.pop()
        assertExists(energyNode, 'No energy node to remove')
        return energyNode
    }

    public removeSundiverFoundry(): SundiverFoundry {
        const foundry = this.sundiverFoundries.pop()
        assertExists(foundry, 'No sundiver foundry to remove')
        return foundry
    }

    public removeTransmitTower(): TransmitTower {
        const tower = this.transmitTowers.pop()
        assertExists(tower, 'No transmit tower to remove')
        return tower
    }

    public hasCardChoice(): boolean {
        if (!this.drawnCards || this.drawnCards.length === 0) {
            return false
        }

        if (!this.card) {
            return true
        }

        const filteredCards = this.drawnCards.filter((card) => card.suit !== this.card!.suit)
        return filteredCards.length > 0
    }
}
