import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedPhaseManager,
    HydratedRoundManager,
    HydratedSimpleTurnManager,
    PhaseManager,
    RoundManager
} from '@tabletop/common'
import { KaivaiPlayerState, HydratedKaivaiPlayerState } from './playerState.js'
import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { MachineState } from '../definition/states.js'
import { KaivaiGameBoard, HydratedKaivaiGameBoard } from '../components/gameBoard.js'
import { PlayerAction } from '../definition/playerActions.js'

export type KaivaiGameState = Static<typeof KaivaiGameState>
export const KaivaiGameState = Type.Composite([
    Type.Omit(GameState, ['players', 'machineState']),
    Type.Object({
        seed: Type.Number(),
        players: Type.Array(KaivaiPlayerState),
        machineState: Type.Enum(MachineState),
        rounds: RoundManager,
        phases: PhaseManager,
        board: KaivaiGameBoard,
        influence: Type.Record(Type.Enum(PlayerAction), Type.Number()),
        bids: Type.Record(Type.String(), Type.Number()),
        cultTiles: Type.Number()
    })
])

const KaivaiGameStateValidator = TypeCompiler.Compile(KaivaiGameState)

type HydratedProperties = {
    turnManager: HydratedSimpleTurnManager
    rounds: HydratedRoundManager
    phases: HydratedPhaseManager
    players: HydratedKaivaiPlayerState[]
    board: HydratedKaivaiGameBoard
}

export class HydratedKaivaiGameState
    extends HydratableGameState<typeof KaivaiGameState>
    implements KaivaiGameState
{
    declare id: string
    declare gameId: string
    declare seed: number
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedKaivaiPlayerState[]
    declare turnManager: HydratedSimpleTurnManager
    declare rounds: HydratedRoundManager
    declare phases: HydratedPhaseManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare board: HydratedKaivaiGameBoard
    declare influence: Record<PlayerAction, number>
    declare bids: Record<string, number>
    declare cultTiles: number

    constructor(data: KaivaiGameState) {
        const hydratedProperties: HydratedProperties = {
            turnManager: new HydratedSimpleTurnManager(data.turnManager),
            rounds: new HydratedRoundManager(data.rounds),
            phases: new HydratedPhaseManager(data.phases),
            players: data.players.map((player) => new HydratedKaivaiPlayerState(player)),
            board: new HydratedKaivaiGameBoard(data.board)
        }
        super(data, KaivaiGameStateValidator, hydratedProperties)
    }

    getPlayerState(playerId: string): HydratedKaivaiPlayerState {
        const player = this.players.find((player) => player.playerId === playerId)
        if (!player) {
            throw Error(`State for player ${playerId} not found`)
        }
        return player
    }
}
