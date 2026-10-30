import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PrngState
} from '@tabletop/common'
import { PromontoryPointPlayerState, HydratedPromontoryPointPlayerState } from './playerState.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { MachineState } from '../definition/states.js'

// R-X.3
export const CURRENT_PROMONTORY_POINT_REVISION = 1

export type PromontoryPointGameState = Type.Static<typeof PromontoryPointGameState>
export const PromontoryPointGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(PromontoryPointPlayerState),
            machineState: Type.Enum(MachineState),
            promontoryPointRevision: Type.Number()
        })
    ])
)

export const PromontoryPointGameStateValidator = Compile(PromontoryPointGameState)

export class HydratedPromontoryPointGameState
    extends HydratableGameState<typeof PromontoryPointGameState, HydratedPromontoryPointPlayerState>
    implements PromontoryPointGameState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedPromontoryPointPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare promontoryPointRevision: number
    declare result?: GameResult
    declare winningPlayerIds: string[]

    constructor(data: PromontoryPointGameState) {
        super(data, PromontoryPointGameStateValidator)

        this.players = data.players.map((player) => new HydratedPromontoryPointPlayerState(player))
    }
}
