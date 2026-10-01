import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PrngState
} from '@tabletop/common'
import { MarracashPlayerState, HydratedMarracashPlayerState } from './playerState.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { MachineState } from '../definition/states.js'

export type MarracashGameState = Type.Static<typeof MarracashGameState>
export const MarracashGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(MarracashPlayerState), // Redefine with the specific player state type
            machineState: Type.Enum(MachineState) // Redefine with the specific machine states
        })
    ])
)

const MarracashGameStateValidator = Compile(MarracashGameState)

export class HydratedMarracashGameState
    extends HydratableGameState<typeof MarracashGameState, HydratedMarracashPlayerState>
    implements MarracashGameState
{
    // Declare properties to satisfy the interface, they will be populated by the base class
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedMarracashPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]

    constructor(data: MarracashGameState) {
        super(data, MarracashGameStateValidator)

        this.players = data.players.map((player) => new HydratedMarracashPlayerState(player))
    }
}
