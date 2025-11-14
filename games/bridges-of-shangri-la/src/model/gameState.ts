import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedSimpleTurnManager,
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

type HydratedProperties = {
    turnManager: HydratedSimpleTurnManager
    players: HydratedBridgesPlayerState[]
    board: HydratedBridgesGameBoard
}

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
    declare turnManager: HydratedSimpleTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare board: HydratedBridgesGameBoard
    declare stones: number

    constructor(data: BridgesGameState) {
        const hydratedProperties: HydratedProperties = {
            turnManager: new HydratedSimpleTurnManager(data.turnManager),
            players: data.players.map((player) => new HydratedBridgesPlayerState(player)),
            board: new HydratedBridgesGameBoard(data.board)
        }
        super(data, BridgesGameStateValidator, hydratedProperties)
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
