import {
    AuctionType,
    Color,
    GameResult,
    GameState,
    HydratableGameState,
    HydratedSimpleTurnManager,
    HydratedSimultaneousAuction,
    PrngState,
    SimultaneousAuction,
    TieResolutionStrategy
} from '@tabletop/common'
import { FreshFishPlayerState, HydratedFreshFishPlayerState } from './playerState.js'
import { HydratedTileBag, TileBag } from '../components/tileBag.js'
import { isStallTile, StallTile, Tile, TileType } from '../components/tiles.js'
import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameBoard, HydratedGameBoard } from '../components/gameBoard.js'
import { MachineState } from '../definition/states.js'
import { GoodsType } from '../definition/goodsType.js'
import { Expropriator } from '../util/expropriation.js'
import { CellType, RoadCell } from '../components/cells.js'
import { Scorer } from '../util/scoring.js'

export type FreshFishGameState = Static<typeof FreshFishGameState>
export const FreshFishGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(FreshFishPlayerState),
            machineState: Type.Enum(MachineState),
            tileBag: TileBag,
            board: GameBoard,
            finalStalls: Type.Array(StallTile),
            chosenTile: Type.Optional(Tile),
            currentAuction: Type.Optional(SimultaneousAuction),
            boardSeed: Type.Optional(Type.Number())
        })
    ])
)

const FreshFishGameStateValidator = Compile(FreshFishGameState)

export class HydratedFreshFishGameState
    extends HydratableGameState<typeof FreshFishGameState, HydratedFreshFishPlayerState>
    implements FreshFishGameState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedFreshFishPlayerState[]
    declare turnManager: HydratedSimpleTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare tileBag: HydratedTileBag
    declare board: HydratedGameBoard
    declare finalStalls: StallTile[]
    declare chosenTile?: Tile
    declare currentAuction?: HydratedSimultaneousAuction
    declare boardSeed?: number

    constructor(data: FreshFishGameState) {
        super(data, FreshFishGameStateValidator)

        this.tileBag = new HydratedTileBag(data.tileBag)
        this.turnManager = new HydratedSimpleTurnManager(data.turnManager)
        this.board = new HydratedGameBoard(data.board)
        this.players = data.players.map((player) => new HydratedFreshFishPlayerState(player))
        if (data.currentAuction) {
            this.currentAuction = new HydratedSimultaneousAuction(data.currentAuction)
        }
    }

    getAuctionGoodsType(): GoodsType | undefined {
        if (!this.currentAuction) {
            return undefined
        }
        return this.getChosenStallType()
    }

    getChosenStallType(): GoodsType | undefined {
        if (!isStallTile(this.chosenTile)) {
            return undefined
        }
        return this.chosenTile.goodsType
    }

    expropriate() {
        const expropriator = new Expropriator(this.board)
        const { expropriatedCoords, returnedDisks } = expropriator.calculateExpropriation()
        for (const coords of expropriatedCoords) {
            const roadCell: RoadCell = { type: CellType.Road }
            this.board.setCell(coords, roadCell)
        }
        Object.entries(returnedDisks).forEach(([playerId, amount]) => {
            this.getPlayerState(playerId).addDisks(amount)
        })
    }

    score() {
        const scorer = new Scorer(this)
        const scores = scorer.calculateScores()
        for (const playerState of this.players) {
            playerState.updateScore(scores[playerState.playerId])
        }
    }
}
