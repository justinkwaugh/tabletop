import { calculateActionChecksum, type Game } from '@tabletop/common'
import type { GameService } from '@tabletop/frontend-components'

export async function loadCompatibleExample(
    candidates: readonly Pick<Game, 'id'>[],
    loadGame: GameService['loadGame']
) {
    for (const game of candidates) {
        try {
            const loaded = await loadGame(game.id)
            const state = loaded.game?.state
            if (!state || state.actionCount !== loaded.actions.length) continue
            const ordered = loaded.actions.toSorted(
                (left, right) => (left.index ?? -1) - (right.index ?? -1)
            )
            if (
                ordered.some((action, index) => action.index !== index) ||
                calculateActionChecksum(0, ordered) !== state.actionChecksum
            )
                continue
            return loaded
        } catch (cause) {
            if (
                !(cause instanceof Error) ||
                cause.message !== 'Complete canonical state is required'
            )
                throw cause
        }
    }
    return undefined
}
