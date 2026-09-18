import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { expect, it, vi } from 'vitest'
import { ActionSource, GameState, HydratableGameState, type PlayerState } from '@tabletop/common'
import { StockMarket, createRectangularStockMarket } from '@tabletop/18xx'
import { AnimationContext, type GameStateChangeListener } from '@tabletop/frontend-components'
import { createMarketAnimationSource } from '../../../../libs/18xx-ui/src/lib/stock/marketAnimationSource.js'

const CustomState = Type.Object({ ...GameState.properties, exchange: StockMarket })
class HydratedCustomState extends HydratableGameState<typeof CustomState, PlayerState> {
    declare exchange: StockMarket
    constructor(exchange: StockMarket) {
        super(
            {
                id: 'state',
                gameId: 'game',
                players: [],
                activePlayerIds: [],
                actionCount: 0,
                actionChecksum: 0,
                prng: { seed: 1, invocations: 0 },
                machineState: 'Trade',
                turnManager: { turnOrder: [], turnCounts: {}, series: [] },
                winningPlayerIds: [],
                exchange
            },
            Compile(CustomState)
        )
    }
}

it('projects a title-owned market while preserving shared lifecycle, replay intent, and unsubscribe', async () => {
    const listeners = new Set<GameStateChangeListener<HydratedCustomState>>()
    const session = {
        updatingVisibleState: false,
        addGameStateChangeListener(listener: GameStateChangeListener<HydratedCustomState>) {
            listeners.add(listener)
        },
        removeGameStateChangeListener(listener: GameStateChangeListener<HydratedCustomState>) {
            listeners.delete(listener)
        }
    }
    const source = createMarketAnimationSource(session, (state) => state.exchange)
    const receive = vi.fn(async () => {})
    const unsubscribe = source.subscribe(receive)
    const from = new HydratedCustomState(createRectangularStockMarket([[100, 110]], () => 'white'))
    const to = new HydratedCustomState(
        createRectangularStockMarket([[100, 110, 120]], () => 'white')
    )
    const animationContext = new AnimationContext()
    const action = { id: 'trade', gameId: 'game', type: 'Trade', source: ActionSource.User }
    session.updatingVisibleState = true
    expect(source.updatingVisibleState).toBe(true)
    for (const listener of listeners) await listener({ from, to, action, animationContext })
    expect(receive).toHaveBeenLastCalledWith({
        from: from.exchange,
        to: to.exchange,
        action,
        animationContext
    })
    for (const listener of listeners) await listener({ from: to, to: from, animationContext })
    expect(receive).toHaveBeenLastCalledWith({
        from: to.exchange,
        to: from.exchange,
        animationContext
    })
    unsubscribe()
    expect(listeners.size).toBe(0)
    session.updatingVisibleState = false
    expect(source.updatingVisibleState).toBe(false)
})
