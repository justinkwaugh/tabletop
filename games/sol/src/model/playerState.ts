import { Hydratable, PlayerState } from '@tabletop/common'
import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { Color } from '@tabletop/common'

export type SolPlayerState = Static<typeof SolPlayerState>
export const SolPlayerState = Type.Composite([
    PlayerState,
    Type.Object({
        score: Type.Number(),
        holdSundivers: Type.Number(),
        reserveSundivers: Type.Number(),
        energyCubes: Type.Number(),
        solarGates: Type.Number(),
        energyNodes: Type.Number(),
        sundiverFoundries: Type.Number(),
        transmitTowers: Type.Number(),
        movement: Type.Number()
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
    declare holdSundivers: number
    declare reserveSundivers: number
    declare energyCubes: number
    declare solarGates: number
    declare energyNodes: number
    declare sundiverFoundries: number
    declare transmitTowers: number
    declare movement: number

    constructor(data: SolPlayerState) {
        super(data, SolPlayerStateValidator)
    }
}
