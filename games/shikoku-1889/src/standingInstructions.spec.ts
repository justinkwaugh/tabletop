import { describe, expect, it } from 'vitest'
import { ActionSource, replaceSupersededAction, type GameAction } from '@tabletop/common'
import {
    evaluateSharePurchase,
    evaluateShareSale,
    isBuyShares,
    isFinishStockTurn,
    isStopStockInstruction,
    sharesOwned,
    standingStockInstructionFor,
    stockPositionChange,
    stoppedStockInstructionFor,
    type EighteenXXState,
    type SellShares
} from '@tabletop/18xx'
import { exampleGame } from '@tabletop/18xx/scenarios'
import { finishTurn, setInstruction, setInstructionStops } from '@tabletop/18xx/testing'
import { Definition as Shikoku, Shikoku1889StockRules } from './index.js'
import { Shikoku1889Scenarios } from './scenarios/index.js'

function currentPlayerId(state: {
    turnManager: { series: readonly { type: string; playerId?: string; end?: number }[] }
}) {
    return state.turnManager.series.findLast(
        (turn) => turn.type === 'turn' && turn.end === undefined
    )?.playerId
}

function summarize(actions: readonly GameAction[]): string[] {
    return actions.map((action) => `${action.source}:${action.type}:${action.playerId}`)
}

describe('Standing stock instructions', () => {
    it('lets a waiting player declare a pass out of turn and passes for them when their turn arrives', () => {
        const { game, engine, state } = exampleGame(Shikoku1889Scenarios, 'trading')
        expect(currentPlayerId(state)).toBe('alex')
        const declared = engine.executeCanonicalAction({
            game,
            state,
            action: setInstruction(game.id, 'blair', { kind: 'pass' })
        })
        expect(summarize(declared.processedActions)).toEqual(['user:SetStockInstruction:blair'])
        expect(currentPlayerId(declared.updatedState)).toBe('alex')
        expect(standingStockInstructionFor(declared.updatedState, 'blair')?.instruction).toEqual({
            kind: 'pass'
        })

        const finished = engine.executeCanonicalAction({
            game,
            state: declared.updatedState,
            action: finishTurn(game.id, 'alex')
        })
        expect(summarize(finished.processedActions)).toEqual([
            'user:FinishStockTurn:alex',
            'system:FinishStockTurn:blair'
        ])
        const automaticPass = finished.processedActions[1]
        expect(isFinishStockTurn(automaticPass) && automaticPass.metadata?.passed).toBe(true)
        expect(currentPlayerId(finished.updatedState)).toBe('casey')
        expect(finished.updatedState.stockRound.passedPlayerIds).toEqual(['alex', 'blair'])

        let undone = finished.updatedState
        for (const action of finished.processedActions.toReversed())
            undone = engine.undoProcessedAction({ state: undone, action })
        expect(undone).toEqual(declared.updatedState)
    })

    it('buys the requested shares, then keeps passing once the goal is met', () => {
        const { game, engine, state } = exampleGame(Shikoku1889Scenarios, 'trading')
        const blair = { kind: 'player', playerId: 'blair' } as const
        const declared = engine.executeCanonicalAction({
            game,
            state,
            action: setInstruction(game.id, 'blair', {
                kind: 'buy',
                companyId: 'IR',
                preferredPoolId: 'initial-offering',
                until: { kind: 'shares', count: sharesOwned(state, 'IR', blair) + 1 },
                thenPass: true
            })
        })
        const finished = engine.executeCanonicalAction({
            game,
            state: declared.updatedState,
            action: finishTurn(game.id, 'alex')
        })
        expect(summarize(finished.processedActions)).toEqual([
            'user:FinishStockTurn:alex',
            'system:BuyShares:blair',
            'system:StopStockInstruction:blair',
            'system:FinishStockTurn:blair'
        ])
        const purchase = finished.processedActions[1]
        expect(isBuyShares(purchase) && purchase.metadata?.companyId).toBe('IR')
        const stop = finished.processedActions[2]
        expect(isStopStockInstruction(stop) && stop.replacement).toEqual({ kind: 'pass' })
        expect(sharesOwned(finished.updatedState, 'IR', blair)).toBe(
            sharesOwned(state, 'IR', blair) + 1
        )
        expect(standingStockInstructionFor(finished.updatedState, 'blair')?.instruction).toEqual({
            kind: 'pass'
        })
        expect(currentPlayerId(finished.updatedState)).toBe('casey')
        expect(finished.updatedState.stockRound.passedPlayerIds).toEqual([])
    })

    it('stops instead of acting when another player sold shares since it was set', () => {
        const { game, engine, state } = exampleGame(Shikoku1889Scenarios, 'trading')
        const alex = { kind: 'player', playerId: 'alex' } as const
        const declared = engine.executeCanonicalAction({
            game,
            state,
            action: setInstruction(game.id, 'blair', { kind: 'pass' })
        })
        const sales = [{ companyId: 'AR', shares: 1 }]
        const terms = evaluateShareSale(
            declared.updatedState,
            { playerId: 'alex', seller: alex, sales },
            Shikoku1889StockRules
        )
        const sale: SellShares = {
            id: 'alex-sells',
            gameId: game.id,
            source: ActionSource.User,
            type: 'SellShares',
            playerId: 'alex',
            seller: alex,
            sales,
            expectedProceeds: terms.details!.proceeds
        }
        const sold = engine.executeCanonicalAction({
            game,
            state: declared.updatedState,
            action: sale
        })
        const finished = engine.executeCanonicalAction({
            game,
            state: sold.updatedState,
            action: finishTurn(game.id, 'alex')
        })
        expect(summarize(finished.processedActions)).toEqual([
            'user:FinishStockTurn:alex',
            'system:StopStockInstruction:blair'
        ])
        const stop = finished.processedActions[1]
        expect(isStopStockInstruction(stop) && stop.reason).toEqual({
            code: 'shares-sold',
            companyId: 'AR'
        })
        expect(standingStockInstructionFor(finished.updatedState, 'blair')).toBeUndefined()
        expect(stoppedStockInstructionFor(finished.updatedState, 'blair')?.stopReason).toEqual({
            code: 'shares-sold',
            companyId: 'AR'
        })
        expect(currentPlayerId(finished.updatedState)).toBe('blair')
    })

    it('fires immediately when the acting player declares, and clears on request', () => {
        const { game, engine, state } = exampleGame(Shikoku1889Scenarios, 'trading')
        const declared = engine.executeCanonicalAction({
            game,
            state,
            action: setInstruction(game.id, 'alex', { kind: 'pass' })
        })
        expect(summarize(declared.processedActions)).toEqual([
            'user:SetStockInstruction:alex',
            'system:FinishStockTurn:alex'
        ])
        expect(currentPlayerId(declared.updatedState)).toBe('blair')
        const cleared = engine.executeCanonicalAction({
            game,
            state: declared.updatedState,
            action: setInstruction(game.id, 'alex')
        })
        expect(standingStockInstructionFor(cleared.updatedState, 'alex')).toBeUndefined()
        expect(() =>
            engine.executeCanonicalAction({
                game,
                state: cleared.updatedState,
                action: setInstruction(game.id, 'alex')
            })
        ).toThrow()
    })

    it('rejects a purchase instruction that cannot be afforded and reports why', () => {
        const { game, engine, state } = exampleGame(Shikoku1889Scenarios, 'trading')
        const blair = { kind: 'player', playerId: 'blair' } as const
        state.cash.find(
            (cash) => cash.owner.kind === 'player' && cash.owner.playerId === 'blair'
        )!.amount = 1
        const blairsTurn = engine.executeCanonicalAction({
            game,
            state,
            action: finishTurn(game.id, 'alex')
        }).updatedState
        const expected = evaluateSharePurchase(
            blairsTurn,
            { playerId: 'blair', buyer: blair, certificateId: 'IR:share:5' },
            Shikoku1889StockRules
        )
        expect(expected.details).toBeUndefined()
        const declared = engine.executeCanonicalAction({
            game,
            state,
            action: setInstruction(game.id, 'blair', {
                kind: 'buy',
                companyId: 'IR',
                preferredPoolId: 'initial-offering',
                until: { kind: 'shares', count: 10 },
                thenPass: false
            })
        })
        const finished = engine.executeCanonicalAction({
            game,
            state: declared.updatedState,
            action: finishTurn(game.id, 'alex')
        })
        const stop = finished.processedActions[1]
        expect(isStopStockInstruction(stop) && stop.reason).toEqual({
            code: 'cannot-afford',
            companyId: 'IR'
        })
        expect(currentPlayerId(finished.updatedState)).toBe('blair')
    })
})

it('falls back to another pool when the preferred pool holds no shares of the company', () => {
    const { game, engine, state } = exampleGame(Shikoku1889Scenarios, 'trading')
    const blair = { kind: 'player', playerId: 'blair' } as const
    expect(
        state.certificates.some(
            (certificate) => certificate.companyId === 'IR' && certificate.poolId === 'open-market'
        )
    ).toBe(false)
    const declared = engine.executeCanonicalAction({
        game,
        state,
        action: setInstruction(game.id, 'blair', {
            kind: 'buy',
            companyId: 'IR',
            preferredPoolId: 'open-market',
            until: { kind: 'shares', count: sharesOwned(state, 'IR', blair) + 1 },
            thenPass: false
        })
    })
    const finished = engine.executeCanonicalAction({
        game,
        state: declared.updatedState,
        action: finishTurn(game.id, 'alex')
    })
    const purchase = finished.processedActions[1]
    expect(isBuyShares(purchase) && purchase.metadata?.seller).toEqual({ kind: 'bank' })
    expect(isBuyShares(purchase) && purchase.certificateId.startsWith('IR:')).toBe(true)
    expect(sharesOwned(finished.updatedState, 'IR', blair)).toBe(
        sharesOwned(state, 'IR', blair) + 1
    )
})

it('reinstates a stopped instruction when the change that stopped it is undone', () => {
    const { game, engine, state } = exampleGame(Shikoku1889Scenarios, 'trading')
    const alex = { kind: 'player', playerId: 'alex' } as const
    const declared = engine.executeCanonicalAction({
        game,
        state,
        action: setInstruction(game.id, 'blair', { kind: 'pass' })
    })
    const sales = [{ companyId: 'AR', shares: 1 }]
    const terms = evaluateShareSale(
        declared.updatedState,
        { playerId: 'alex', seller: alex, sales },
        Shikoku1889StockRules
    )
    const sold = engine.executeCanonicalAction({
        game,
        state: declared.updatedState,
        action: {
            id: 'alex-sells',
            gameId: game.id,
            source: ActionSource.User,
            type: 'SellShares',
            playerId: 'alex',
            seller: alex,
            sales,
            expectedProceeds: terms.details!.proceeds
        }
    })
    const finished = engine.executeCanonicalAction({
        game,
        state: sold.updatedState,
        action: finishTurn(game.id, 'alex')
    })
    expect(summarize(finished.processedActions)).toEqual([
        'user:FinishStockTurn:alex',
        'system:StopStockInstruction:blair'
    ])
    expect(standingStockInstructionFor(finished.updatedState, 'blair')).toBeUndefined()

    let undone = finished.updatedState
    for (const action of [...sold.processedActions, ...finished.processedActions].toReversed())
        undone = engine.undoProcessedAction({ state: undone, action })
    expect(undone).toEqual(declared.updatedState)
    expect(standingStockInstructionFor(undone, 'blair')?.instruction).toEqual({ kind: 'pass' })

    const refinished = engine.executeCanonicalAction({
        game,
        state: undone,
        action: finishTurn(game.id, 'alex')
    })
    expect(summarize(refinished.processedActions)).toEqual([
        'user:FinishStockTurn:alex',
        'system:FinishStockTurn:blair'
    ])
})

it('offers the declaration to a waiting player as their only valid action', () => {
    const { game, engine, state } = exampleGame(Shikoku1889Scenarios, 'trading')
    expect(engine.getValidActionTypesForPlayer(game, state, 'blair')).toEqual([
        'SetStockInstruction'
    ])
    expect(engine.getValidActionTypesForPlayer(game, state, 'alex')).toContain(
        'SetStockInstruction'
    )
})

it('refuses to replace a declaration the machine has already acted on', () => {
    const { game, engine, state } = exampleGame(Shikoku1889Scenarios, 'trading')
    const declared = engine.executeCanonicalAction({
        game,
        state,
        action: setInstruction(game.id, 'blair', { kind: 'pass' })
    })
    const finished = engine.executeCanonicalAction({
        game,
        state: declared.updatedState,
        action: finishTurn(game.id, 'alex')
    })
    const window = [...declared.processedActions, ...finished.processedActions]
    const replacement = {
        ...setInstruction(game.id, 'blair', { kind: 'pass' }),
        id: 'blair-again',
        supersedesActionId: declared.processedActions[0].id
    }
    const consumed = replaceSupersededAction({
        engine,
        apiActions: Shikoku.runtime.apiActions,
        game,
        state: finished.updatedState,
        window,
        replacement
    })
    expect(consumed.kind).toBe('invalid')
    const unconsumed = replaceSupersededAction({
        engine,
        apiActions: Shikoku.runtime.apiActions,
        game,
        state: declared.updatedState,
        window: declared.processedActions,
        replacement
    })
    expect(unconsumed.kind).toBe('replace')
})

it('withdraws a standing instruction in place when the player clears it', () => {
    const { game, engine, state } = exampleGame(Shikoku1889Scenarios, 'trading')
    const declared = engine.executeCanonicalAction({
        game,
        state,
        action: setInstruction(game.id, 'blair', { kind: 'pass' })
    })
    const clear = {
        ...setInstruction(game.id, 'blair'),
        supersedesActionId: declared.processedActions[0].id
    }
    const withdrawn = replaceSupersededAction({
        engine,
        apiActions: Shikoku.runtime.apiActions,
        game,
        state: declared.updatedState,
        window: declared.processedActions,
        replacement: clear
    })
    expect(withdrawn.kind).toBe('replace')
    if (withdrawn.kind !== 'replace') return
    expect(standingStockInstructionFor(withdrawn.state, 'blair')).toBeUndefined()

    const recorded = engine.executeCanonicalAction({ game, state: withdrawn.state, action: clear })
    expect(standingStockInstructionFor(recorded.updatedState, 'blair')).toBeUndefined()
    expect(() =>
        engine.executeCanonicalAction({ game, state, action: setInstruction(game.id, 'blair') })
    ).toThrow()
})

it('lets a player change an instruction that has already acted by declaring afresh', () => {
    const { game, engine, state } = exampleGame(Shikoku1889Scenarios, 'trading')
    const blair = { kind: 'player', playerId: 'blair' } as const
    const declared = engine.executeCanonicalAction({
        game,
        state,
        action: setInstruction(game.id, 'blair', {
            kind: 'buy',
            companyId: 'IR',
            preferredPoolId: 'initial-offering',
            until: { kind: 'shares', count: 10 },
            thenPass: true
        })
    })
    const acted = engine.executeCanonicalAction({
        game,
        state: declared.updatedState,
        action: finishTurn(game.id, 'alex')
    })
    expect(summarize(acted.processedActions)).toEqual([
        'user:FinishStockTurn:alex',
        'system:BuyShares:blair',
        'system:FinishStockTurn:blair'
    ])
    const consumed = replaceSupersededAction({
        engine,
        apiActions: Shikoku.runtime.apiActions,
        game,
        state: acted.updatedState,
        window: [...declared.processedActions, ...acted.processedActions],
        replacement: {
            ...setInstruction(game.id, 'blair', { kind: 'pass' }),
            id: 'blair-change',
            supersedesActionId: declared.processedActions[0].id
        }
    })
    expect(consumed.kind).toBe('invalid')

    const changed = engine.executeCanonicalAction({
        game,
        state: acted.updatedState,
        action: { ...setInstruction(game.id, 'blair', { kind: 'pass' }), id: 'blair-change' }
    })
    expect(summarize(changed.processedActions)).toEqual(['user:SetStockInstruction:blair'])
    expect(standingStockInstructionFor(changed.updatedState, 'blair')?.instruction).toEqual({
        kind: 'pass'
    })
    expect(sharesOwned(changed.updatedState, 'IR', blair)).toBe(sharesOwned(state, 'IR', blair) + 1)
})

describe('Ignored stops', () => {
    function alexSellsAR(example: ReturnType<typeof exampleGame>, state: EighteenXXState) {
        const alex = { kind: 'player', playerId: 'alex' } as const
        const sales = [{ companyId: 'AR', shares: 1 }]
        const terms = evaluateShareSale(
            state,
            { playerId: 'alex', seller: alex, sales },
            Shikoku1889StockRules
        )
        return example.engine.executeCanonicalAction({
            game: example.game,
            state,
            action: {
                id: 'alex-sells',
                gameId: example.game.id,
                source: ActionSource.User,
                type: 'SellShares',
                playerId: 'alex',
                seller: alex,
                sales,
                expectedProceeds: terms.details!.proceeds
            }
        }).updatedState
    }

    it('keeps passing through a sale the player chose to ignore', () => {
        const example = exampleGame(Shikoku1889Scenarios, 'trading')
        const { game, engine, state } = example
        const declared = engine.executeCanonicalAction({
            game,
            state,
            action: setInstruction(game.id, 'blair', {
                kind: 'pass',
                ignoredStops: ['shares-sold']
            })
        })
        const sold = alexSellsAR(example, declared.updatedState)
        const finished = engine.executeCanonicalAction({
            game,
            state: sold,
            action: finishTurn(game.id, 'alex')
        })
        expect(summarize(finished.processedActions)).toEqual([
            'user:FinishStockTurn:alex',
            'system:FinishStockTurn:blair'
        ])
    })

    it('changes the stops of a running instruction without forgetting earlier changes', () => {
        const example = exampleGame(Shikoku1889Scenarios, 'trading')
        const { game, engine, state } = example
        const declared = engine.executeCanonicalAction({
            game,
            state,
            action: setInstruction(game.id, 'blair', { kind: 'pass' })
        })
        const sold = alexSellsAR(example, declared.updatedState)
        const blairInstruction = (current: EighteenXXState) =>
            standingStockInstructionFor(current, 'blair')!
        expect(stockPositionChange(sold, blairInstruction(sold), Shikoku1889StockRules)).toEqual({
            code: 'shares-sold',
            companyId: 'AR'
        })
        expect(engine.getValidActionTypesForPlayer(game, sold, 'blair')).toContain(
            'SetStockInstructionStops'
        )

        const ignoring = engine.executeCanonicalAction({
            game,
            state: sold,
            action: setInstructionStops(game.id, 'blair', ['shares-sold'])
        })
        const ignored = blairInstruction(ignoring.updatedState)
        expect(ignored.instruction).toEqual({ kind: 'pass', ignoredStops: ['shares-sold'] })
        expect(ignored.snapshot).toEqual(blairInstruction(sold).snapshot)
        expect(
            stockPositionChange(ignoring.updatedState, ignored, Shikoku1889StockRules)
        ).toBeUndefined()

        const watchingAgain = {
            ...setInstructionStops(game.id, 'blair', []),
            supersedesActionId: ignoring.processedActions[0].id
        }
        const replaced = replaceSupersededAction({
            engine,
            apiActions: Shikoku.runtime.apiActions,
            game,
            state: ignoring.updatedState,
            window: ignoring.processedActions,
            replacement: watchingAgain
        })
        expect(replaced.kind).toBe('replace')
        const watching = engine.executeCanonicalAction({
            game,
            state: ignoring.updatedState,
            action: watchingAgain
        }).updatedState
        expect(blairInstruction(watching).instruction).toEqual({ kind: 'pass' })
        expect(
            stockPositionChange(watching, blairInstruction(watching), Shikoku1889StockRules)
        ).toEqual({ code: 'shares-sold', companyId: 'AR' })
    })

    it('carries ignored stops into the pass that follows an Autobuy goal', () => {
        const { game, engine, state } = exampleGame(Shikoku1889Scenarios, 'trading')
        const blair = { kind: 'player', playerId: 'blair' } as const
        const declared = engine.executeCanonicalAction({
            game,
            state,
            action: setInstruction(game.id, 'blair', {
                kind: 'buy',
                companyId: 'IR',
                preferredPoolId: 'initial-offering',
                until: { kind: 'shares', count: sharesOwned(state, 'IR', blair) + 1 },
                thenPass: true,
                ignoredStops: ['company-started', 'shares-sold']
            })
        })
        const finished = engine.executeCanonicalAction({
            game,
            state: declared.updatedState,
            action: finishTurn(game.id, 'alex')
        })
        const stop = finished.processedActions[2]
        expect(isStopStockInstruction(stop) && stop.replacement).toEqual({
            kind: 'pass',
            ignoredStops: ['company-started', 'shares-sold']
        })
    })

    it('has no stops to change without a standing instruction', () => {
        const { game, engine, state } = exampleGame(Shikoku1889Scenarios, 'trading')
        expect(engine.getValidActionTypesForPlayer(game, state, 'blair')).not.toContain(
            'SetStockInstructionStops'
        )
        expect(() =>
            engine.executeCanonicalAction({
                game,
                state,
                action: setInstructionStops(game.id, 'blair', ['shares-sold'])
            })
        ).toThrow()
    })

    it('resumes a stopped instruction with the stop ignored and still reports the next change', () => {
        const example = exampleGame(Shikoku1889Scenarios, 'trading')
        const { game, engine, state } = example
        const alex = { kind: 'player', playerId: 'alex' } as const
        const declared = engine.executeCanonicalAction({
            game,
            state,
            action: setInstruction(game.id, 'blair', { kind: 'pass' })
        })
        const purchase = evaluateSharePurchase(
            declared.updatedState,
            { playerId: 'alex', buyer: alex, certificateId: 'IR:share:5' },
            Shikoku1889StockRules
        )
        const bought = engine.executeCanonicalAction({
            game,
            state: declared.updatedState,
            action: {
                id: 'alex-buys',
                gameId: game.id,
                source: ActionSource.User,
                type: 'BuyShares',
                playerId: 'alex',
                buyer: alex,
                certificateId: 'IR:share:5',
                expectedPrice: purchase.details!.price
            }
        })
        const sold = alexSellsAR(example, bought.updatedState)
        const finished = engine.executeCanonicalAction({
            game,
            state: sold,
            action: finishTurn(game.id, 'alex')
        })
        const firstStop = finished.processedActions.at(-1)!
        expect(isStopStockInstruction(firstStop) && firstStop.reason).toEqual({
            code: 'shares-sold',
            companyId: 'AR'
        })

        const resumed = engine.executeCanonicalAction({
            game,
            state: finished.updatedState,
            action: setInstructionStops(game.id, 'blair', ['shares-sold'])
        })
        expect(summarize(resumed.processedActions)).toEqual([
            'user:SetStockInstructionStops:blair',
            'system:StopStockInstruction:blair'
        ])
        expect(stoppedStockInstructionFor(resumed.updatedState, 'blair')).toMatchObject({
            instruction: { kind: 'pass', ignoredStops: ['shares-sold'] },
            stopReason: { code: 'president-changed', companyId: 'IR' }
        })
    })

    it('replaces an instruction whose stops changed by declaring afresh', () => {
        const { game, engine, state } = exampleGame(Shikoku1889Scenarios, 'trading')
        const declared = engine.executeCanonicalAction({
            game,
            state,
            action: setInstruction(game.id, 'blair', { kind: 'pass' })
        })
        const ignoring = engine.executeCanonicalAction({
            game,
            state: declared.updatedState,
            action: setInstructionStops(game.id, 'blair', ['shares-sold'])
        })
        const clear = {
            ...setInstruction(game.id, 'blair'),
            supersedesActionId: declared.processedActions[0].id
        }
        expect(
            replaceSupersededAction({
                engine,
                apiActions: Shikoku.runtime.apiActions,
                game,
                state: ignoring.updatedState,
                window: [...declared.processedActions, ...ignoring.processedActions],
                replacement: clear
            }).kind
        ).toBe('invalid')
        const cleared = engine.executeCanonicalAction({
            game,
            state: ignoring.updatedState,
            action: setInstruction(game.id, 'blair')
        })
        expect(standingStockInstructionFor(cleared.updatedState, 'blair')).toBeUndefined()
        const redeclared = engine.executeCanonicalAction({
            game,
            state: cleared.updatedState,
            action: { ...setInstruction(game.id, 'blair', { kind: 'pass' }), id: 'blair-again' }
        })
        expect(standingStockInstructionFor(redeclared.updatedState, 'blair')?.instruction).toEqual({
            kind: 'pass'
        })
    })

    it('stores declared ignored stops once each, in a fixed order', () => {
        const { game, engine, state } = exampleGame(Shikoku1889Scenarios, 'trading')
        const declared = engine.executeCanonicalAction({
            game,
            state,
            action: setInstruction(game.id, 'blair', {
                kind: 'pass',
                ignoredStops: ['shares-sold', 'company-started', 'shares-sold']
            })
        })
        expect(standingStockInstructionFor(declared.updatedState, 'blair')?.instruction).toEqual({
            kind: 'pass',
            ignoredStops: ['company-started', 'shares-sold']
        })
        const none = engine.executeCanonicalAction({
            game,
            state,
            action: setInstruction(game.id, 'blair', { kind: 'pass', ignoredStops: [] })
        })
        expect(standingStockInstructionFor(none.updatedState, 'blair')?.instruction).toEqual({
            kind: 'pass'
        })
    })
})
