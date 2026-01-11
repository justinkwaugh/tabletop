import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PrngState
} from '@tabletop/common'
import { BridgesPlayerState, HydratedBridgesPlayerState } from './playerState.js'
import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { MachineState } from '../definition/states.js'
import { BridgesGameBoard, HydratedBridgesGameBoard } from '../components/gameBoard.js'

export type BridgesGameState = Static<typeof BridgesGameState>
export const BridgesGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(BridgesPlayerState),
            machineState: Type.Enum(MachineState),
            board: BridgesGameBoard,
            stones: Type.Number()
        })
    ])
)

const BridgesGameStateValidator = Compile(BridgesGameState)

export class HydratedBridgesGameState
    extends HydratableGameState<typeof BridgesGameState, HydratedBridgesPlayerState>
    implements BridgesGameState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedBridgesPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare board: HydratedBridgesGameBoard
    declare stones: number

    constructor(data: BridgesGameState) {
        super(data, BridgesGameStateValidator)
        this.players = data.players.map((player) => new HydratedBridgesPlayerState(player))
        this.board = new HydratedBridgesGameBoard(data.board)
    }

    hasStones() {
        return this.stones > 0
    }

    score() {
        for (const playerState of this.players) {
            playerState.score = this.board.numMastersForPlayer(playerState.playerId)
        }
    }
}
