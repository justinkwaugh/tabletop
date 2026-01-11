import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedOnceAroundAuction,
    HydratedTurnManager,
    OffsetCoordinates,
    OnceAroundAuction,
    PrngState
} from '@tabletop/common'
import { EstatesPlayerState, HydratedEstatesPlayerState } from './playerState.js'
import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { MachineState } from '../definition/states.js'
import { EstatesGameBoard, HydratedEstatesGameBoard } from '../components/gameBoard.js'
import { Cube } from '../components/cube.js'
import { HydratedRoofBag, RoofBag } from '../components/roofBag.js'
import { Company } from '../definition/companies.js'
import { Piece } from '../components/pieces.js'

export type OptionalCube = Static<typeof OptionalCube>
export const OptionalCube = Type.Union([Type.Undefined(), Type.Null(), Cube])

export type EstatesGameState = Static<typeof EstatesGameState>
export const EstatesGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(EstatesPlayerState),
            machineState: Type.Enum(MachineState),
            board: EstatesGameBoard,
            certificates: Type.Array(Type.Enum(Company)),
            cubes: Type.Array(Type.Array(OptionalCube)), // 3x8 array of cubes
            roofs: RoofBag,
            visibleRoofs: Type.Array(Type.Boolean()),
            mayor: Type.Boolean(),
            barrierOne: Type.Boolean(),
            barrierTwo: Type.Boolean(),
            barrierThree: Type.Boolean(),
            cancelCube: Type.Boolean(),
            chosenPiece: Type.Optional(Piece),
            auction: Type.Optional(OnceAroundAuction),
            recipient: Type.Optional(Type.String()),
            embezzled: Type.Optional(Type.Boolean())
        })
    ])
)

const EstatesGameStateValidator = Compile(EstatesGameState)

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
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare board: HydratedEstatesGameBoard
    declare certificates: Company[]
    declare cubes: OptionalCube[][]
    declare roofs: HydratedRoofBag
    declare visibleRoofs: boolean[]
    declare mayor: boolean
    declare barrierOne: boolean
    declare barrierTwo: boolean
    declare barrierThree: boolean
    declare cancelCube: boolean
    declare chosenPiece?: Piece
    declare auction?: HydratedOnceAroundAuction
    declare recipient?: string
    declare embezzled?: boolean

    constructor(data: EstatesGameState) {
        super(data, EstatesGameStateValidator)

        this.players = data.players.map((player) => new HydratedEstatesPlayerState(player))
        this.board = new HydratedEstatesGameBoard(data.board)
        this.roofs = new HydratedRoofBag(data.roofs)
        if (data.auction) {
            this.auction = new HydratedOnceAroundAuction(data.auction)
        }
    }

    placeableCubes(): OffsetCoordinates[] {
        const offerCoords: OffsetCoordinates[] = []
        for (let rowIndex = 0; rowIndex < this.cubes.length; rowIndex++) {
            const row = this.cubes[rowIndex]
            const leftIndex = row.findIndex((cube) => cube)
            const rightIndex = row.findLastIndex((cube) => cube)

            if (this.board.validCubeLocations(row[leftIndex]).length > 0) {
                offerCoords.push({ row: rowIndex, col: leftIndex })
            }
            if (
                rightIndex != leftIndex &&
                this.board.validCubeLocations(row[rightIndex]).length > 0
            ) {
                offerCoords.push({ row: rowIndex, col: rightIndex })
            }
        }

        return offerCoords
    }

    removeCubeFromOffer(cube: Cube) {
        for (let rowIndex = 0; rowIndex < this.cubes.length; rowIndex++) {
            const row = this.cubes[rowIndex]
            for (let colIndex = 0; colIndex < row.length; colIndex++) {
                const offerCube = row[colIndex]
                if (
                    offerCube &&
                    offerCube.company === cube.company &&
                    offerCube.value === cube.value
                ) {
                    row[colIndex] = undefined
                    return
                }
            }
        }
    }

    isEndOfGame(): boolean {
        return this.roofs.isEmpty() || this.board.areTwoRowsComplete()
    }

    calculatePlayerScore(playerState: HydratedEstatesPlayerState): number {
        return this.board.playerScore(playerState) + playerState.stolen
    }
}
