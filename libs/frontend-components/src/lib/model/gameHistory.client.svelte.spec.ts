import { describe, expect, it } from 'vitest'
import { createAction } from '@tabletop/common'
import { createPrivateHandGame, PlaySchema } from '@tabletop/common/test-fixtures/private-hand'
import { GameContext } from './gameContext.svelte.js'
import { GameHistory } from './gameHistory.svelte.js'
import { uiRuntime } from './tests/privateHandSession.fixture.js'

// History navigation releases its stepping guard on a timer.
const settleTimers = () => new Promise((resolve) => setTimeout(resolve, 0))

function historyOfTwoPlays() {
    const { game, state, firstPlay } = createPrivateHandGame()
    const context = new GameContext({ runtime: uiRuntime, game, state, actions: [] })
    context.applyAction(firstPlay)
    context.applyAction(createAction(PlaySchema, { gameId: game.id, playerId: 'p2', cardId: 'r2' }))
    const seen: (number | undefined)[] = []
    const replayingSeen: boolean[] = []
    const viewed: { history?: { viewedActionCount: number | undefined; replaying: boolean } } = {}
    const history = new GameHistory(context, {
        waitForTransitionSettled: async () => {
            seen.push(viewed.history?.viewedActionCount)
            replayingSeen.push(viewed.history?.replaying ?? false)
        }
    })
    viewed.history = history
    return { history, seen, replayingSeen }
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
        expect(seen.every((count) => count === undefined)).toBe(true)
        expect(history.viewedActionCount).toBeUndefined()
    })

    it('stays on the viewed position while a replay started there plays', async () => {
        const { history, seen } = historyOfTwoPlays()
        await history.goToActionIndex(0, { exact: true })
        await settleTimers()
        await history.replayRange(1, 1, { holdMs: 0 })
        expect(seen.length).toBeGreaterThan(0)
        expect(seen.every((count) => count === 1)).toBe(true)
        expect(history.viewedActionCount).toBe(1)
    })

    it('says a replay is playing only while it plays', async () => {
        const { history, replayingSeen } = historyOfTwoPlays()
        expect(history.replaying).toBe(false)
        await history.goToActionIndex(0, { exact: true })
        await settleTimers()
        await history.replayRange(1, 1, { holdMs: 0 })
        expect(replayingSeen.length).toBeGreaterThan(0)
        expect(replayingSeen.every(Boolean)).toBe(true)
        expect(history.replaying).toBe(false)
    })
})
