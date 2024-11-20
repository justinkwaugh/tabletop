import { Hydratable, PlayerState } from '@tabletop/common'
import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { Color } from '@tabletop/common'
import { Card } from '../components/cards.js'
import { Sundiver } from 'src/components/sundiver.js'
import { SolarGate } from 'src/components/solarGate.js'
import { EnergyNode, SundiverFoundry, TransmitTower } from 'src/components/stations.js'

export type SolPlayerState = Static<typeof SolPlayerState>
export const SolPlayerState = Type.Composite([
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
        card: Type.Optional(Card)
    })
])

export const SolPlayerStateValidator = TypeCompiler.Compile(SolPlayerState)

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
    declare card?: Card

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

        return removedSundivers
    }

    public addSundiversToHold(sundivers: Sundiver[]) {
        this.holdSundivers.push(...sundivers)
    }

    public addSundiversToReserve(sundivers: Sundiver[]) {
        this.reserveSundivers.push(...sundivers)
    }

    public removeSundiversFromReserve(numSundivers: number): Sundiver[] {
        if (this.reserveSundivers.length < numSundivers) {
            throw new Error(
                `Player ${this.playerId} only has ${this.reserveSundivers.length} sundivers in reserve`
            )
        }
        return this.reserveSundivers.splice(0, numSundivers)
    }
}
