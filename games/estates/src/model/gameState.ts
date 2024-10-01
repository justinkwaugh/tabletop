import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedOnceAroundAuction,
    HydratedSimpleTurnManager,
    OffsetCoordinates,
    OnceAroundAuction,
    PrngState
} from '@tabletop/common'
import { EstatesPlayerState, HydratedEstatesPlayerState } from './playerState.js'
import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { MachineState } from '../definition/states.js'
import { EstatesGameBoard, HydratedEstatesGameBoard } from '../components/gameBoard.js'
import { Cube } from '../components/cube.js'
import { HydratedRoofBag, RoofBag } from '../components/roofBag.js'
import { Company } from '../definition/companies.js'
import { Piece } from '../components/pieces.js'

export type EstatesGameState = Static<typeof EstatesGameState>
export const EstatesGameState = Type.Composite([
    Type.Omit(GameState, ['players', 'machineState']),
    Type.Object({
        players: Type.Array(EstatesPlayerState),
        machineState: Type.Enum(MachineState),
        board: EstatesGameBoard,
        certificates: Type.Array(Type.Enum(Company)),
        cubes: Type.Array(Type.Array(Cube)), // 3x8 array of cubes
        roofs: RoofBag,
        mayor: Type.Boolean(),
        barrierOne: Type.Boolean(),
        barrierTwo: Type.Boolean(),
        barrierThree: Type.Boolean(),
        cancelCube: Type.Boolean(),
        chosenPiece: Type.Optional(Piece),
        auction: Type.Optional(OnceAroundAuction),
        recipient: Type.Optional(Type.String())
    })
])

const EstatesGameStateValidator = TypeCompiler.Compile(EstatesGameState)

type HydratedProperties = {
    turnManager: HydratedSimpleTurnManager
    players: HydratedEstatesPlayerState[]
    board: HydratedEstatesGameBoard
    roofs: HydratedRoofBag
    auction?: HydratedOnceAroundAuction
}

export class HydratedEstatesGameState
    extends HydratableGameState<typeof EstatesGameState, HydratedEstatesPlayerState>
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
    declare certificates: Company[]
    declare cubes: Cube[][]
    declare roofs: HydratedRoofBag
    declare mayor: boolean
    declare barrierOne: boolean
    declare barrierTwo: boolean
    declare barrierThree: boolean
    declare cancelCube: boolean
    declare chosenPiece?: Piece
    declare auction?: HydratedOnceAroundAuction
    declare recipient?: string

    constructor(data: EstatesGameState) {
        const hydratedProperties: HydratedProperties = {
            turnManager: new HydratedSimpleTurnManager(data.turnManager),
            players: data.players.map((player) => new HydratedEstatesPlayerState(player)),
            board: new HydratedEstatesGameBoard(data.board),
            roofs: new HydratedRoofBag(data.roofs),
            auction: data.auction ? new HydratedOnceAroundAuction(data.auction) : undefined
        }
        super(data, EstatesGameStateValidator, hydratedProperties)
    }

    placeableCubes(): OffsetCoordinates[] {
        const offerCoords: OffsetCoordinates[] = []
        for (let rowIndex = 0; rowIndex < this.cubes.length; rowIndex++) {
            const row = this.cubes[rowIndex]
            if (this.board.validCubeLocations(row[0]).length > 0) {
                offerCoords.push({ row: rowIndex, col: 0 })
            }
            if (this.board.validCubeLocations(row[row.length - 1]).length > 0) {
                offerCoords.push({ row: rowIndex, col: 1 })
            }
        }

        return offerCoords
    }
}
