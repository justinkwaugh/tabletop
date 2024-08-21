import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedSimpleTurnManager
} from '@tabletop/common'
import { BridgesPlayerState, HydratedBridgesPlayerState } from './playerState.js'
import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { MachineState } from '../definition/states.js'
import { BridgesGameBoard } from '../components/gameBoard.js'

export type BridgesGameState = Static<typeof BridgesGameState>
export const BridgesGameState = Type.Composite([
    Type.Omit(GameState, ['players', 'machineState']),
    Type.Object({
        seed: Type.Number(),
        players: Type.Array(BridgesPlayerState),
        machineState: Type.Enum(MachineState),
        board: BridgesGameBoard,
        stones: Type.Number()
    })
])

const BridgesGameStateValidator = TypeCompiler.Compile(BridgesGameState)

type HydratedProperties = {
    turnManager: HydratedSimpleTurnManager
    players: HydratedBridgesPlayerState[]
}

export class HydratedBridgesGameState
    extends HydratableGameState<typeof BridgesGameState>
    implements BridgesGameState
{
    declare id: string
    declare gameId: string
    declare seed: number
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedBridgesPlayerState[]
    declare turnManager: HydratedSimpleTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare board: BridgesGameBoard
    declare stones: number

    constructor(data: BridgesGameState) {
        const hydratedProperties: HydratedProperties = {
            turnManager: new HydratedSimpleTurnManager(data.turnManager),
            players: data.players.map((player) => new HydratedBridgesPlayerState(player))
        }
        super(data, BridgesGameStateValidator, hydratedProperties)
    }

    getPlayerState(playerId: string): HydratedBridgesPlayerState {
        const player = this.players.find((player) => player.playerId === playerId)
        if (!player) {
            throw Error(`State for player ${playerId} not found`)
        }
        return player
    }
}
