import type { GameProgress, GameProgression } from '@tabletop/common'
import { PALACE_COLORS, startingStock } from '../components/pieces.js'
import { HydratedMedinaGameState, type MedinaProjectedState } from '../model/gameState.js'

export class MedinaProgression implements GameProgression<MedinaProjectedState> {
    progress(state: MedinaProjectedState): GameProgress {
        const hydrated = new HydratedMedinaGameState(state)
        const start = this.startingComponents(hydrated.players.length)
        // With hidden supplies the total left would give away an opponent's count, so only the
        // board counts.
        if (hydrated.hiddenPieces) {
            const placed = hydrated.piecesOnBoard()
            return {
                fraction: Math.min(1, placed / start),
                label: `${placed} ${placed === 1 ? 'piece' : 'pieces'} placed`
            }
        }
        const left = hydrated.players.reduce((sum, player) => sum + player.componentsLeft(), 0)
        const someoneFinished = hydrated.players.some(
            (player) => !hydrated.isPlaceable(player.playerId)
        )
        return {
            fraction: Math.min(1, Math.max(0, 1 - left / start)),
            label: `${left} ${left === 1 ? 'piece' : 'pieces'} left`,
            ...(someoneFinished ? { final: true } : {})
        }
    }

    private startingComponents(playerCount: number): number {
        const stock = startingStock(playerCount)
        const perPlayer =
            stock.buildingsPerColor * PALACE_COLORS.length +
            stock.rooftops +
            stock.neutralRooftops +
            stock.stables +
            stock.merchants +
            stock.walls
        return perPlayer * playerCount
    }
}
