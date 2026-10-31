import type { GameProgress, GameProgression } from '@tabletop/common'
import { RAILROAD_IDS } from '../components/railroads.js'
import { TRACK_PIECES_PER_RAILROAD } from '../components/trackPieces.js'
import { TOWN_TILE_KINDS, RED_TILE_KIND_IDS } from '../components/townTiles.js'
import type { PromontoryPointProjectedState } from '../model/gameState.js'
import { keptPieces } from '../model/playerState.js'
import {
    UNCOVERED_RED_TILES_AT_END,
    gameEndReason,
    uncoveredRedTileCount
} from '../rules/gameEnd.js'

const TRACK_PIECE_COUNT = TRACK_PIECES_PER_RAILROAD * RAILROAD_IDS.length
const RED_TILE_COUNT = RED_TILE_KIND_IDS.reduce(
    (sum, kindId) => sum + TOWN_TILE_KINDS[kindId].count,
    0
)

// R-6.1, R-6.1-H1, R-6.1-H2: how near either end is, from public state only: the bag's count,
// the pieces placed and scrapped, and the red tiles still uncovered. The game ends after the
// turn in which the end test first holds, so that turn is the last.
export class PromontoryPointProgression implements GameProgression<PromontoryPointProjectedState> {
    progress(state: PromontoryPointProjectedState): GameProgress {
        const uncovered = uncoveredRedTileCount(state)
        if (gameEndReason(state) !== undefined) {
            return { fraction: 1, label: 'Last turn', final: true }
        }
        const piecesUsed =
            Object.keys(state.track).length +
            RAILROAD_IDS.reduce((sum, railroadId) => sum + state.scrapped[railroadId], 0)
        // The bag runs out with every hand still held, so the pieces in hands never count. While
        // the bag lasts every seat but the turn player holds a full hand, kept piece included:
        // 3 pieces, or 4 in the variant (R-1.3 step 6, R-6.3).
        const fullHand = Math.max(
            ...state.players.map((player) => player.handCount + keptPieces(player).length)
        )
        const piecesToUse = TRACK_PIECE_COUNT - fullHand * state.players.length
        const redTilesToCover = RED_TILE_COUNT - UNCOVERED_RED_TILES_AT_END
        const fraction = Math.max(
            piecesUsed / piecesToUse,
            (RED_TILE_COUNT - uncovered) / redTilesToCover
        )
        return {
            fraction: Math.min(1, fraction),
            label: `Bag ${state.bag.remaining} · ${uncovered} red ${uncovered === 1 ? 'tile' : 'tiles'} uncovered`
        }
    }
}
