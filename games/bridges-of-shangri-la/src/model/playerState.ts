import { Hydratable, PlayerState } from '@tabletop/common'
import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'

export enum PlayerColor {
    Red = 'red',
    Blue = 'blue',
    Yellow = 'yellow',
    Purple = 'purple'
}

export type PlayerTile = Static<typeof PlayerTile>
export const PlayerTile = Type.Object({})

export type BridgesPlayerState = Static<typeof BridgesPlayerState>
export const BridgesPlayerState = Type.Composite([
    PlayerState,
    Type.Object({
        color: Type.Enum(PlayerColor),
        numHealers: Type.Number(),
        numDragonBreeders: Type.Number(),
        numFirekeepers: Type.Number(),
        numPriests: Type.Number(),
        numRainmakers: Type.Number(),
        numAstrologers: Type.Number(),
        numYetiWhisperers: Type.Number()
    })
])

export const BridgesPlayerStateValidator = TypeCompiler.Compile(BridgesPlayerState)

export class HydratedBridgesPlayerState
    extends Hydratable<typeof BridgesPlayerState>
    implements BridgesPlayerState
{
    declare playerId: string
    declare color: PlayerColor
    declare numHealers: number
    declare numDragonBreeders: number
    declare numFirekeepers: number
    declare numPriests: number
    declare numRainmakers: number
    declare numAstrologers: number
    declare numYetiWhisperers: number

    constructor(data: BridgesPlayerState) {
        super(data, BridgesPlayerStateValidator)
    }
}
