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
}
