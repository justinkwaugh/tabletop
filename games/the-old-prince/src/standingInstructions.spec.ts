import { expect, it } from 'vitest'
import { ActionSource, ExplorationHistory, assertExists, type GameAction } from '@tabletop/common'
import {
    isBuyShares,
    isFinishStockTurn,
    isStopStockInstruction,
    privateOwner,
    sharesOwned,
    type EighteenXXState
} from '@tabletop/18xx'
import { exampleGame } from '@tabletop/18xx/scenarios'
import { finishTurn, setInstruction } from '@tabletop/18xx/testing'
import { TheOldPrinceStockRules } from './stockRules.js'
import { TheOldPrinceScenarios } from './scenarios/index.js'

type Example = ReturnType<typeof exampleGame>

function explore({ game, engine }: Example, source: EighteenXXState) {
    assertExists(engine.runtime.exploration, 'The Old Prince supports exploration')
    const history = new ExplorationHistory(engine)
    const start = engine.runtime.exploration.createFromCanonicalState(history.prepareState(source))
    start.explorationState = history.checkpoint(source, start, [], game, 'canonical')
    return { history, start }
}

function passTurns({ game, engine }: Example, from: EighteenXXState, playerIds: string[]) {
    let state = from
    const automaticPasses: GameAction[] = []
    for (const playerId of playerIds) {
        const result = engine.executeCanonicalAction({
            game,
            state,
            action: finishTurn(game.id, playerId)
        })
        automaticPasses.push(
            ...result.processedActions.filter(
                (action) => action.source === ActionSource.System && isFinishStockTurn(action)
            )
        )
        state = result.updatedState
    }
    return { state, automaticPasses }
}

it('buys as the player and never on behalf of the Union Bank', () => {
    const { game, engine, state } = exampleGame(TheOldPrinceScenarios, 'trading')
    const alex = { kind: 'player', playerId: 'alex' } as const
    expect(privateOwner(state, 'UB')).toEqual(alex)
    expect(TheOldPrinceStockRules.buyers(state, 'alex')).toContainEqual({
        kind: 'company',
        companyId: 'UB'
    })
    const declaration = setInstruction(game.id, 'alex', {
        kind: 'buy',
        companyId: 'ML',
        preferredPoolId: 'market',
        until: { kind: 'shares', count: sharesOwned(state, 'ML', alex) + 1 },
        thenPass: false
    })
    const result = engine.executeCanonicalAction({ game, state, action: declaration })
    const purchase = result.processedActions[1]
    expect(isBuyShares(purchase) && purchase.source).toBe(ActionSource.System)
    expect(isBuyShares(purchase) && purchase.buyer).toEqual(alex)
    expect(sharesOwned(result.updatedState, 'ML', alex)).toBe(sharesOwned(state, 'ML', alex) + 1)
    expect(sharesOwned(result.updatedState, 'ML', { kind: 'company', companyId: 'UB' })).toBe(
        sharesOwned(state, 'ML', { kind: 'company', companyId: 'UB' })
    )
    expect(result.updatedState.stockRound.companyPurchases).not.toContain('UB')
})

it('falls back from an emptied market to the treasury and stops when the share is unaffordable', () => {
    const { game, engine, state } = exampleGame(TheOldPrinceScenarios, 'trading')
    const alex = { kind: 'player', playerId: 'alex' } as const
    const declaration = setInstruction(game.id, 'alex', {
        kind: 'buy',
        companyId: 'ML',
        preferredPoolId: 'market',
        until: { kind: 'shares', count: 6 },
        thenPass: true
    })
    let current = engine.executeCanonicalAction({ game, state, action: declaration })
    const purchases: string[] = []
    const stops: unknown[] = []
    const record = (actions: readonly GameAction[]) => {
        for (const action of actions) {
            if (isBuyShares(action) && action.source === ActionSource.System)
                purchases.push(action.certificateId)
            if (isStopStockInstruction(action)) stops.push(action.reason)
        }
    }
    record(current.processedActions)
    for (const playerId of ['blair', 'casey', 'blair', 'casey']) {
        current = engine.executeCanonicalAction({
            game,
            state: current.updatedState,
            action: finishTurn(game.id, playerId)
        })
        record(current.processedActions)
    }
    expect(purchases).toEqual(['ML:share:5', 'ML:share:6'])
    expect(stops).toEqual([{ code: 'cannot-afford', companyId: 'ML' }])
    expect(sharesOwned(current.updatedState, 'ML', alex)).toBe(5)
})

it('does not carry standing instructions into an exploration', () => {
    const example = exampleGame(TheOldPrinceScenarios, 'trading')
    const { game, engine, state } = example
    const declared = engine.executeCanonicalAction({
        game,
        state,
        action: setInstruction(game.id, 'casey', { kind: 'pass' })
    })
    const { start } = explore(example, declared.updatedState)
    const explored = passTurns(example, start, ['alex', 'blair'])
    expect(explored.automaticPasses).toEqual([])
    expect(explored.state.stockRound.instructions).toBeUndefined()
    expect(explored.state.activePlayerIds).toEqual(['casey'])
    expect(declared.updatedState.stockRound.instructions).toHaveLength(1)
})

it('keeps standing instructions out when undo reaches back before the exploration', () => {
    const example = exampleGame(TheOldPrinceScenarios, 'trading')
    const { game, engine, state } = example
    const declared = engine.executeCanonicalAction({
        game,
        state,
        action: setInstruction(game.id, 'casey', { kind: 'pass' })
    })
    const passed = engine.executeCanonicalAction({
        game,
        state: declared.updatedState,
        action: finishTurn(game.id, 'alex')
    })
    const { history, start } = explore(example, passed.updatedState)
    let undone = start
    for (const action of passed.processedActions.toReversed())
        undone = history.undo(undone, action, start.explorationState)
    const rebuilt = history.afterUndo(start, undone, passed.processedActions)
    expect(rebuilt.stockRound.instructions).toBeUndefined()
    const explored = passTurns(example, rebuilt, ['alex', 'blair'])
    expect(explored.automaticPasses).toEqual([])
    expect(explored.state.activePlayerIds).toEqual(['casey'])
})
