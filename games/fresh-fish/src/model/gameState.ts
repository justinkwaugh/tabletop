import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedPrng,
    HydratedSimpleTurnManager,
    HydratedSimultaneousAuction,
    Prng,
    SimultaneousAuction
} from '@tabletop/common'
import { FreshFishPlayerState, HydratedFreshFishPlayerState } from './playerState.js'
import { HydratedTileBag, TileBag } from '../components/tileBag.js'
import { isStallTile, StallTile, Tile } from '../components/tiles.js'
import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { GameBoard, HydratedGameBoard } from '../components/gameBoard.js'
import { MachineState } from '../definition/states.js'
import { GoodsType } from '../definition/goodsType.js'
import { Expropriator } from '../util/expropriation.js'
import { CellType, RoadCell } from '../components/cells.js'
import { Scorer } from '../util/scoring.js'

export type FreshFishGameState = Static<typeof FreshFishGameState>
export const FreshFishGameState = Type.Composite([
    Type.Omit(GameState, ['players', 'machineState']),
    Type.Object({
        players: Type.Array(FreshFishPlayerState),
        machineState: Type.Enum(MachineState),
        tileBag: TileBag,
        board: GameBoard,
        finalStalls: Type.Array(StallTile),
        chosenTile: Type.Optional(Tile),
        currentAuction: Type.Optional(SimultaneousAuction)
    })
])

const FreshFishGameStateValidator = TypeCompiler.Compile(FreshFishGameState)

type HydratedProperties = {
    prng: HydratedPrng
    tileBag: HydratedTileBag
    turnManager: HydratedSimpleTurnManager
    board: HydratedGameBoard
    players: HydratedFreshFishPlayerState[]
    currentAuction?: HydratedSimultaneousAuction
}

export class HydratedFreshFishGameState
    extends HydratableGameState<typeof FreshFishGameState>
    implements FreshFishGameState
{
    declare id: string
    declare gameId: string
    declare prng: Prng
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

    constructor(data: FreshFishGameState) {
        const hydratedProperties: HydratedProperties = {
            prng: new HydratedPrng(data.prng),
            tileBag: new HydratedTileBag(data.tileBag),
            turnManager: new HydratedSimpleTurnManager(data.turnManager),
            board: new HydratedGameBoard(data.board),
            players: data.players.map((player) => new HydratedFreshFishPlayerState(player))
        }
        if (data.currentAuction) {
            hydratedProperties.currentAuction = new HydratedSimultaneousAuction(data.currentAuction)
        }
        super(data, FreshFishGameStateValidator, hydratedProperties)
    }

    getPlayerState(playerId: string): HydratedFreshFishPlayerState {
        const player = this.players.find((player) => player.playerId === playerId)
        if (!player) {
            throw Error(`State for player ${playerId} not found`)
        }
        return player
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
