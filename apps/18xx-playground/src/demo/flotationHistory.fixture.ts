import { ActionSource } from '@tabletop/common'
import { EighteenXXStateValidator, isFinishStockTurn } from '@tabletop/18xx'
import { Definition as Top } from '@tabletop/the-old-prince'
import { UiDefinition } from '@tabletop/the-old-prince-ui'
import { GameContext } from '@tabletop/frontend-components'
import { GameHistory } from '../../../../libs/frontend-components/dist/model/gameHistory.svelte.js'
import { shouldContinueHistoryStep } from '../../../../libs/18xx-ui/src/lib/table/historyNavigation.js'
import { historyRounds } from '../../../../libs/18xx-ui/src/lib/table/historyRounds.js'
import { finishedGame } from './finishedGame.js'
import { example, purchase } from './stockTestUtils.js'

export async function flotationHistorySteps() {
    const { game, engine, state } = example(Top, 'flotation')
    const bought = engine.executeCanonicalAction({
        game,
        state,
        action: purchase('A:share:4', 80)
    })
    const passed = engine.executeCanonicalAction({
        game,
        state: bought.updatedState,
        action: {
            id: 'next-pass',
            gameId: game.id,
            source: ActionSource.User,
            type: 'FinishStockTurn',
            playerId: bought.updatedState.activePlayerIds[0]
        }
    })
    const context = new GameContext({
        runtime: await UiDefinition.runtime(),
        game,
        state: passed.updatedState,
        actions: [...bought.processedActions, ...passed.processedActions]
    })
    const history = new GameHistory(context, {
        shouldAutoStepAction: shouldContinueHistoryStep
    })
    const position = () => {
        const visible = history.visibleContext
        visible.verifyFullChecksum()
        if (!EighteenXXStateValidator.Check(visible.state)) throw Error('Expected 18xx state')
        return {
            actionTypes: visible.actions.map((action) => action.type),
            floated: visible.state.companies.find((company) => company.id === 'A')?.floated
        }
    }
    await history.goToBeginning()
    const beginning = position()
    await history.goToNextAction()
    await new Promise((resolve) => setTimeout(resolve, 0))
    const purchasePosition = position()
    await history.goToNextAction()
    await new Promise((resolve) => setTimeout(resolve, 0))
    const next = position()
    await history.goToPreviousAction()
    await new Promise((resolve) => setTimeout(resolve, 0))
    const previous = position()
    return { beginning, purchase: purchasePosition, next, previous }
}

export async function finishedStockTurnHistorySteps() {
    const { game, state, initialState, actions, engine } = await finishedGame(
        'local-user',
        'SR 3 history'
    )
    const thirdStockRound = new Set(
        historyRounds(actions, state)
            .find((round) => round.label === 'SR 3')
            ?.entries.map((entry) => entry.id)
    )
    const purchaseIndex = actions.findIndex(
        (action) => thirdStockRound.has(action.id) && action.type === 'BuyShares'
    )
    if (purchaseIndex < 1) throw Error('SR 3 first purchase missing')
    const excerpt = actions.slice(0, purchaseIndex + 3)
    let excerptState = initialState
    for (const action of excerpt)
        excerptState = engine.applyProcessedAction({ game, state: excerptState, action })
    const context = new GameContext({
        runtime: await UiDefinition.runtime(),
        game,
        state: excerptState,
        actions: excerpt
    })
    const history = new GameHistory(context, {
        shouldAutoStepAction: shouldContinueHistoryStep
    })
    const position = () => {
        const visible = history.visibleContext
        visible.verifyFullChecksum()
        const action = visible.actions.at(-1)
        return {
            index: visible.actions.length - 1,
            type: action?.type,
            source: action?.source,
            passed: action && isFinishStockTurn(action) ? action.metadata?.passed : undefined
        }
    }
    const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
    await history.goToActionIndex(purchaseIndex - 1, { exact: true })
    await settle()
    const beforePurchase = position()
    await history.goToNextAction()
    await settle()
    const purchasePosition = position()
    await history.goToNextAction()
    await settle()
    const followingPass = position()
    await history.goToPreviousAction()
    await settle()
    const previous = position()
    await history.goToActionIndex(purchaseIndex, { exact: true })
    await settle()
    const exactPurchase = position()
    await history.goToNextAction()
    await settle()
    const afterExactPurchase = position()
    return {
        purchaseIndex,
        beforePurchase,
        purchasePosition,
        followingPass,
        previous,
        exactPurchase,
        afterExactPurchase
    }
}
