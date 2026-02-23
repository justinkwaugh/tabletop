import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PrngState
} from '@tabletop/common'
import { IndonesiaPlayerState, HydratedIndonesiaPlayerState } from './playerState.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { MachineState } from '../definition/states.js'
import { IndonesiaBoard, HydratedIndonesiaBoard } from '../components/board.js'
import { AnyDeed } from '../components/deed.js'

export type IndonesiaGameState = Type.Static<typeof IndonesiaGameState>
export const IndonesiaGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(IndonesiaPlayerState), // Redefine with the specific player state type
            machineState: Type.Enum(MachineState), // Redefine with the specific machine states
            board: IndonesiaBoard,
            availableDeeds: Type.Array(AnyDeed)
        })
    ])
)

const IndonesiaGameStateValidator = Compile(IndonesiaGameState)

export class HydratedIndonesiaGameState
    extends HydratableGameState<typeof IndonesiaGameState, HydratedIndonesiaPlayerState>
    implements IndonesiaGameState
{
    // Declare properties to satisfy the interface, they will be populated by the base class
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedIndonesiaPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare board: HydratedIndonesiaBoard
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare availableDeeds: AnyDeed[]

    constructor(data: IndonesiaGameState) {
        super(data, IndonesiaGameStateValidator)

        this.players = data.players.map((player) => new HydratedIndonesiaPlayerState(player))
        this.board = new HydratedIndonesiaBoard(data.board)
    }
}
