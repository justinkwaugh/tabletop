import type { HydratedGameState } from '@tabletop/common'
import type { StockMarket } from '@tabletop/18xx'
import type { GameStateChangeListener } from '@tabletop/frontend-components'

export type MarketStateChange = Omit<
    Parameters<GameStateChangeListener<HydratedGameState>>[0],
    'from' | 'to'
> & {
    from?: StockMarket
    to: StockMarket
}
export interface MarketAnimationSource {
    readonly updatingVisibleState: boolean
    subscribe(listener: (change: MarketStateChange) => Promise<void>): () => void
}
export function createMarketAnimationSource<State extends HydratedGameState>(
    session: {
        readonly updatingVisibleState: boolean
        addGameStateChangeListener(listener: GameStateChangeListener<State>): void
        removeGameStateChangeListener(listener: GameStateChangeListener<State>): void
    },
    project: (state: State) => StockMarket
): MarketAnimationSource {
    return {
        get updatingVisibleState() {
            return session.updatingVisibleState
        },
        subscribe(listener) {
            const forward: GameStateChangeListener<State> = (change) =>
                listener({
                    ...change,
                    from: change.from ? project(change.from) : undefined,
                    to: project(change.to)
                })
            session.addGameStateChangeListener(forward)
            return () => session.removeGameStateChangeListener(forward)
        }
    }
}
