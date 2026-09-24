import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import {
    evaluateSharePurchase,
    evaluateShareSale,
    isBuyShares,
    isFinishStockTurn,
    isStopStockInstruction,
    sharesOwned,
    standingStockInstructionFor,
    type FinishStockTurn,
    type SellShares,
    type SetStockInstruction,
    type StockInstruction
} from '@tabletop/18xx'
import { exampleGame } from '@tabletop/18xx/scenarios'
import { Shikoku1889StockRules } from './index.js'
import { Shikoku1889Scenarios } from './scenarios/index.js'

function setInstruction(
    gameId: string,
    playerId: string,
    instruction?: StockInstruction
): SetStockInstruction {
    return {
        id: `set-${playerId}-${instruction?.kind ?? 'clear'}`,
        gameId,
        source: ActionSource.User,
        type: 'SetStockInstruction',
        playerId,
        outOfTurn: true,
        supersedable: true,
        ...(instruction ? { instruction } : {})
    }
}

function finishTurn(gameId: string, playerId: string): FinishStockTurn {
    return {
        id: `finish-${playerId}`,
        gameId,
        source: ActionSource.User,
        type: 'FinishStockTurn',
        playerId
    }
}

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
            (certificate) =>
                !certificate.retired &&
                certificate.companyId === 'IR' &&
                certificate.poolId === 'open-market'
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
