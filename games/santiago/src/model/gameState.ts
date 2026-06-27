import {
    GameResult,
    GameState,
    HydratableGameState,
    HydratedTurnManager,
    PrngState
} from '@tabletop/common'
import { SantiagoPlayerState, HydratedSantiagoPlayerState } from './playerState.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { SantiagoBoard, CropType, PlantingTile, isFieldSquare, CanalSegment } from './board.js'

export type CanalProposal = Type.Static<typeof CanalProposal>
export const CanalProposal = Type.Object({
    playerId: Type.String(),
    segment: CanalSegment,
    amount: Type.Number({ minimum: 0 })
})
import { MachineState } from '../definition/states.js'
import { isIrrigated, connectedSpringIntersections } from '../util/irrigation.js'
import { calculateScores } from '../util/scoring.js'

export type SantiagoGameState = Type.Static<typeof SantiagoGameState>
export const SantiagoGameState = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameState, ['players', 'machineState']),
        Type.Object({
            players: Type.Array(SantiagoPlayerState),
            machineState: Type.Enum(MachineState),
            board: SantiagoBoard,
            // Shuffled bag of planting tiles; draw from front
            tileBag: Type.Array(PlantingTile),
            // The tile drawn at the start of the current player's planting turn
            currentPlantingTile: Type.Optional(PlantingTile),
            // Current round number (1-based)
            round: Type.Number({ default: 0 }),
            // Player IDs in the order they will plant this round
            plantersOrder: Type.Array(Type.String()),
            // Index into plantersOrder — whose planting turn it is
            planterIndex: Type.Number({ default: 0 }),
            // The canal overseer (ditch master) for this round.
            // Also set at game start to the randomly chosen initial overseer,
            // which determines round 1 bidding order.
            canalOverseerId: Type.Optional(Type.String()),
            // Player IDs who have acted during extra irrigation (amount=0 counts as passing)
            extraIrrigationPassed: Type.Array(Type.String()),
            // Sequential order of players for Phase 5 (left of new overseer → overseer last)
            extraIrrigationOrder: Type.Array(Type.String(), { default: [] }),
            // Index into extraIrrigationOrder — whose Phase 5 turn it is
            extraIrrigationIndex: Type.Number({ default: 0 }),
            // True when the canal overseer won by bidding zero — they plant 1 fewer farmer
            overseerBidZero: Type.Boolean({ default: false }),
            // Sequential bid order for the current round (clockwise from player left of overseer)
            biddingOrder: Type.Array(Type.String()),
            // Index into biddingOrder — who bids next
            currentBidderIndex: Type.Number({ default: 0 }),
            // Tiles pre-drawn at the start of each bidding round, visible during bidding
            revealedTiles: Type.Array(PlantingTile, { default: [] }),
            // Phase 4: canal proposals from non-overseer players
            canalProposals: Type.Array(CanalProposal, { default: [] }),
            canalProposalOrder: Type.Array(Type.String(), { default: [] }),
            // -1 = not started (fresh entry), 0..n-1 = proposal phase, n = overseer decision phase
            canalProposalIndex: Type.Number({ default: -1 }),
            // Fixed display order: initial overseer first, then clockwise. Never changes.
            seatOrder: Type.Array(Type.String(), { default: [] })
        })
    ])
)

const SantiagoGameStateValidator = Compile(SantiagoGameState)

export class HydratedSantiagoGameState
    extends HydratableGameState<typeof SantiagoGameState, HydratedSantiagoPlayerState>
    implements SantiagoGameState
{
    declare id: string
    declare gameId: string
    declare prng: PrngState
    declare activePlayerIds: string[]
    declare actionCount: number
    declare actionChecksum: number
    declare players: HydratedSantiagoPlayerState[]
    declare turnManager: HydratedTurnManager
    declare machineState: MachineState
    declare result?: GameResult
    declare winningPlayerIds: string[]
    declare board: SantiagoBoard
    declare tileBag: PlantingTile[]
    declare currentPlantingTile?: PlantingTile
    declare round: number
    declare plantersOrder: string[]
    declare planterIndex: number
    declare canalOverseerId?: string
    declare extraIrrigationPassed: string[]
    declare extraIrrigationOrder: string[]
    declare extraIrrigationIndex: number
    declare overseerBidZero: boolean
    declare biddingOrder: string[]
    declare currentBidderIndex: number
    declare revealedTiles: PlantingTile[]
    declare canalProposals: CanalProposal[]
    declare canalProposalOrder: string[]
    declare canalProposalIndex: number
    declare seatOrder: string[]

    constructor(data: SantiagoGameState) {
        super(data, SantiagoGameStateValidator)
        this.players = data.players.map((p) => new HydratedSantiagoPlayerState(p))
    }

    drawTile(): PlantingTile | undefined {
        return this.tileBag.shift()
    }

    isBagEmpty(): boolean {
        return this.tileBag.length === 0
    }

    applyDrought(isLastRound = false) {
        const connected = connectedSpringIntersections(this.board)
        for (let col = 0; col < 8; col++) {
            for (let row = 0; row < 6; row++) {
                const sq = this.board.squares[col][row]
                if (!isFieldSquare(sq) || sq.dried) continue
                if (isIrrigated(this.board, col, row, connected)) continue

                if (isLastRound) {
                    // Last round: every non-irrigated field dries immediately
                    sq.farmerCount = 0
                    sq.dried = true
                } else if (sq.farmerCount === 0) {
                    // Already neutral (no farmers) — dries out this round
                    sq.dried = true
                } else {
                    // Has farmers — loses one; becomes neutral if it reaches 0
                    sq.farmerCount--
                }
            }
        }
    }

    collectEscudos() {
        for (const player of this.players) {
            player.earn(3)
        }
    }

    score() {
        const scores = calculateScores(this.board)
        for (const player of this.players) {
            player.score = (scores[player.playerId] ?? 0) + player.money
        }
    }
}
