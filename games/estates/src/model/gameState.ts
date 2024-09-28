import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedSimpleTurnManager,
    PrngState
} from '@tabletop/common'
import { EstatesPlayerState, HydratedEstatesPlayerState } from './playerState.js'
import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { MachineState } from '../definition/states.js'
import { EstatesGameBoard, HydratedEstatesGameBoard } from '../components/gameBoard.js'
import { Cube } from '../components/cube.js'
import { HydratedRoofBag, RoofBag } from '../components/roofBag.js'

export type EstatesGameState = Static<typeof EstatesGameState>
export const EstatesGameState = Type.Composite([
    Type.Omit(GameState, ['players', 'machineState']),
    Type.Object({
        players: Type.Array(EstatesPlayerState),
        machineState: Type.Enum(MachineState),
        board: EstatesGameBoard,
        cubes: Type.Array(Type.Array(Cube)), // 3x8 array of cubes
        roofs: RoofBag
    })
])

const EstatesGameStateValidator = TypeCompiler.Compile(EstatesGameState)

type HydratedProperties = {
    turnManager: HydratedSimpleTurnManager
    players: HydratedEstatesPlayerState[]
    board: HydratedEstatesGameBoard
    roofs: HydratedRoofBag
}

export class HydratedEstatesGameState
    extends HydratableGameState<typeof EstatesGameState>
    implements EstatesGameState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedEstatesPlayerState[]
    declare turnManager: HydratedSimpleTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare board: HydratedEstatesGameBoard
    declare cubes: Cube[][]
    declare roofs: HydratedRoofBag

    constructor(data: EstatesGameState) {
        const hydratedProperties: HydratedProperties = {
            turnManager: new HydratedSimpleTurnManager(data.turnManager),
            players: data.players.map((player) => new HydratedEstatesPlayerState(player)),
            board: new HydratedEstatesGameBoard(data.board),
            roofs: new HydratedRoofBag(data.roofs)
        }
        super(data, EstatesGameStateValidator, hydratedProperties)
    }

    getPlayerState(playerId: string): HydratedEstatesPlayerState {
        const player = this.players.find((player) => player.playerId === playerId)
        if (!player) {
            throw Error(`State for player ${playerId} not found`)
        }
        return player
    }
}
