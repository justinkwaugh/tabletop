import { describe, expect, it } from 'vitest'
import { createAction } from '@tabletop/common'
import { createPrivateHandGame, PlaySchema } from '@tabletop/common/test-fixtures/private-hand'
import { GameContext } from './gameContext.svelte.js'
import { GameHistory } from './gameHistory.svelte.js'
import { uiRuntime } from './tests/privateHandSession.fixture.js'

function historyOfTwoPlays() {
    const { game, state, firstPlay } = createPrivateHandGame()
    const context = new GameContext({ runtime: uiRuntime, game, state, actions: [] })
    context.applyAction(firstPlay)
    context.applyAction(createAction(PlaySchema, { gameId: game.id, playerId: 'p2', cardId: 'r2' }))
    const seen: (number | undefined)[] = []
    const viewed: { history?: { viewedActionCount: number | undefined } } = {}
    const history = new GameHistory(context, {
        waitForTransitionSettled: async () => {
            seen.push(viewed.history?.viewedActionCount)
        }
    })
    viewed.history = history
    return { history, seen }
}

describe('GameHistory viewed position', () => {
    it('is the visible action count in History View and nothing in Live View', async () => {
        const { history } = historyOfTwoPlays()
        expect(history.viewedActionCount).toBeUndefined()
        await history.goToActionIndex(0, { exact: true })
        expect(history.viewedActionCount).toBe(1)
    })

    it('stays in Live View while a replay started there plays', async () => {
        const { history, seen } = historyOfTwoPlays()
        await history.replayRange(1, 1, { holdMs: 0 })
        expect(seen.length).toBeGreaterThan(0)
        expect(seen).toEqual(seen.map(() => undefined))
        expect(history.viewedActionCount).toBeUndefined()
    })

    it('stays on the viewed position while a replay started there plays', async () => {
        const { history, seen } = historyOfTwoPlays()
        await history.goToActionIndex(0, { exact: true })
        await new Promise((resolve) => setTimeout(resolve, 0))
        await history.replayRange(1, 1, { holdMs: 0 })
        expect(seen.length).toBeGreaterThan(0)
        expect(seen).toEqual(seen.map(() => 1))
        expect(history.viewedActionCount).toBe(1)
    })
})
