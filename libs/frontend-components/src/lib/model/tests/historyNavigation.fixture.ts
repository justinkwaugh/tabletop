import { assert, createAction } from '@tabletop/common'
import { createPrivateHandGame, PlaySchema } from '@tabletop/common/test-fixtures/private-hand'
import { GameContext } from '../gameContext.svelte.js'
import { GameHistory } from '../gameHistory.svelte.js'
import { uiRuntime } from './privateHandSession.fixture.js'

export async function previousPlayerTurnFromLive(stepFirst: boolean, deferred: boolean) {
    const { game, state, firstPlay } = createPrivateHandGame()
    const context = new GameContext({ runtime: uiRuntime, game, state, actions: [] })
    context.applyAction(firstPlay)
    context.applyAction(createAction(PlaySchema, { gameId: game.id, playerId: 'p2', cardId: 'r2' }))
    const source = deferred
        ? new GameContext({ runtime: uiRuntime, game, state: context.state, actions: [], historyComplete: false })
        : context
    const history = new GameHistory(source)
    if (deferred) {
        await history.goToPlayersPreviousTurn('p1')
        assert(!history.inHistory, 'Incomplete history must remain unavailable')
        assert(source.hydrateHistory(context), 'History should attach to the current state')
    }
    history.disable()
    await history.goToPlayersPreviousTurn('p1')
    assert(!history.inHistory, 'Disabled history must not navigate')
    history.enable()
    if (stepFirst) {
        await history.goToPreviousAction()
        await new Promise((resolve) => setTimeout(resolve, 0))
    }
    await history.goToPlayersPreviousTurn('p1')
    history.visibleContext.verifyFullChecksum()
    return { inHistory: history.inHistory, actionIndex: history.actionIndex, count: history.visibleContext.state.actionCount }
}

export async function navigatePlayerTurn(skipping: 'first' | 'all' | 'none') {
    const { game, state, firstPlay } = createPrivateHandGame()
    const context = new GameContext({ runtime: uiRuntime, game, state, actions: [] })
    context.applyAction(firstPlay)
    context.applyAction(
        createAction(PlaySchema, {
            gameId: game.id,
            playerId: 'p2',
            cardId: 'r2'
        })
    )
    const history = new GameHistory(context, {
        shouldAutoStepAction: (action) =>
            skipping === 'all' || (skipping === 'first' && action.playerId === 'p1')
    })
    await history.goToBeginning()
    await history.goToPlayersNextTurn('p1')
    history.visibleContext.verifyFullChecksum()
    const destination = {
        inHistory: history.inHistory,
        actionIndex: history.actionIndex,
        count: history.visibleContext.state.actionCount
    }
    await history.goToBeginning()
    history.visibleContext.verifyFullChecksum()
    return { destination, beginningCount: history.visibleContext.state.actionCount }
}
