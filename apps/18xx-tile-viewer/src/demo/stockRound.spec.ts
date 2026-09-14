import { expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import {
    Definition as Top,
    TheOldPrinceStockRules,
    TheOldPrinceOperatingRules
} from '@tabletop/the-old-prince'
import { Definition as Shikoku, Shikoku1889StockRules } from '@tabletop/shikoku-1889'
import {
    allPlayersPassed,
    companyMarketSpace,
    getCompany,
    isCompleteStockRound,
    isFinishStockTurn,
    evaluateSharePurchase,
    evaluateShareSale,
    placeStockMarker,
    type BuyShares,
    type SellShares,
    type FinishStockTurn,
    type FinanceExampleState,
    type Owner
} from '@tabletop/18xx'
import { example } from './stockTestUtils.js'

function finish(state: FinanceExampleState): FinishStockTurn {
    return {
        id: `finish-${state.actionCount}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type: 'FinishStockTurn',
        playerId: state.activePlayerIds[0]
    }
}
function buy(state: FinanceExampleState, certificateId: string, expectedPrice: number): BuyShares {
    const playerId = state.activePlayerIds[0]
    return {
        id: `buy-${state.actionCount}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type: 'BuyShares',
        playerId,
        buyer: { kind: 'player', playerId },
        certificateId,
        expectedPrice
    }
}
function give(state: FinanceExampleState, certificateId: string, owner: Owner) {
    const certificate = state.certificates.find((certificate) => certificate.id === certificateId)
    if (!certificate || certificate.retired) throw new Error('Missing certificate')
    certificate.owner = owner
    delete certificate.poolId
}

it.each([Top, Shikoku])(
    'completes $info.id once and replays and undoes the entire final-pass cascade',
    (definition) => {
        const { game, engine, state } = example(definition)
        let current = state
        for (const playerId of ['alex', 'blair']) {
            expect(current.activePlayerIds[0]).toBe(playerId)
            const result = engine.executeCanonicalAction({
                game,
                state: current,
                action: finish(current)
            })
            expect(
                isFinishStockTurn(result.processedActions[0]) &&
                    result.processedActions[0].metadata?.passed
            ).toBe(true)
            current = result.updatedState
            expect(current.operatingSet).toBeUndefined()
        }
        const before = structuredClone(current)
        const action = finish(current)
        const result = engine.executeCanonicalAction({ game, state: current, action })
        expect(result.processedActions.map((action) => action.type)).toEqual([
            'FinishStockTurn',
            'CompleteStockRound',
            'StartOperatingSet',
            'StartOperatingRound',
            ...(definition === Top ? ['StartOperatingTurn'] : [])
        ])
        expect(result.updatedState.machineState).toBe(
            definition === Top ? 'LayingTrack' : 'OperatingSet'
        )
        expect(result.updatedState.stockRound.completed).toBe(true)
        expect(result.updatedState.turnManager.turnOrder).toEqual(['alex', 'blair', 'casey'])
        expect(result.updatedState.operatingSet).toMatchObject({
            number: 1,
            roundNumber: 1,
            roundCount: 1
        })
        expect(result.updatedState.operatingSet?.companyOrder).toEqual(
            definition === Top ? ['ML', 'So', 'PEIR'] : ['IR', 'AR']
        )
        expect(engine.getValidActionTypesForPlayer(game, result.updatedState, 'casey')).toEqual(
            definition === Top ? [] : ['LayPrivateTile', 'ContinueOperatingRound']
        )
        const repeated = engine.executeCanonicalAction({ game, state: current, action })
        expect(repeated.updatedState).toEqual(result.updatedState)
        expect(repeated.processedActions.map(({ id, type }) => ({ id, type }))).toEqual(
            result.processedActions.map(({ id, type }) => ({ id, type }))
        )
        let replay = before
        for (const processed of result.processedActions)
            replay = engine.applyProcessedAction({ game, state: replay, action: processed })
        expect(replay).toEqual(result.updatedState)
        for (const processed of [...result.processedActions].reverse())
            replay = engine.undoProcessedAction({ state: replay, action: processed })
        expect(replay).toEqual(before)
        expect(current).toEqual(before)
        for (const processed of result.processedActions)
            expect(() =>
                engine.executeCanonicalAction({
                    game,
                    state: result.updatedState,
                    action: processed
                })
            ).toThrow()
        const hydrated = definition.runtime.hydrator.hydrateState(
            JSON.parse(JSON.stringify(result.updatedState))
        )
        expect(hydrated.dehydrate()).toEqual(result.updatedState)
    }
)

it.each([Top, Shikoku])(
    'finishing a transaction is not a pass in $info.id and advances priority after the last actor',
    (definition) => {
        const { game, engine, state } = example(definition)
        const certificateId = definition === Top ? 'ML:share:5' : 'IR:share:5'
        const price = definition === Top ? 92 : 70
        let current = engine.executeCanonicalAction({
            game,
            state,
            action: buy(state, certificateId, price)
        }).updatedState
        if (current.stockRound.turn.acted)
            current = engine.executeCanonicalAction({
                game,
                state: current,
                action: finish(current)
            }).updatedState
        expect(current.activePlayerIds[0]).toBe('blair')
        expect(current.stockRound.passedPlayerIds).toEqual([])
        expect(current.stockRound.turn).toEqual({
            acted: false,
            bought: false,
            soldBeforeBuying: false,
            companiesSold: []
        })
        for (let index = 0; index < 3; index++)
            current = engine.executeCanonicalAction({
                game,
                state: current,
                action: finish(current)
            }).updatedState
        expect(current.turnManager.turnOrder).toEqual(['blair', 'casey', 'alex'])
        expect(current.stockRound.completed).toBe(true)
    }
)

it.each([Top, Shikoku])(
    'allows a passed player to resume in $info.id with title-specific pass invalidation',
    (definition) => {
        const { game, engine, state } = example(definition)
        let current = engine.executeCanonicalAction({
            game,
            state,
            action: finish(state)
        }).updatedState
        current = engine.executeCanonicalAction({
            game,
            state: current,
            action: buy(
                current,
                definition === Top ? 'So:share:5' : 'AR:share:5',
                definition === Top ? 86 : 65
            )
        }).updatedState
        expect(current.stockRound.passedPlayerIds).toEqual(definition === Top ? ['alex'] : [])
        if (current.stockRound.turn.acted)
            current = engine.executeCanonicalAction({
                game,
                state: current,
                action: finish(current)
            }).updatedState
        current = engine.executeCanonicalAction({
            game,
            state: current,
            action: finish(current)
        }).updatedState
        expect(current.activePlayerIds[0]).toBe('alex')
        current = engine.executeCanonicalAction({
            game,
            state: current,
            action: buy(
                current,
                definition === Top ? 'ML:share:5' : 'IR:share:5',
                definition === Top ? 92 : 70
            )
        }).updatedState
        expect(current.stockRound.passedPlayerIds).toEqual(definition === Top ? ['casey'] : [])
        if (current.stockRound.turn.acted)
            current = engine.executeCanonicalAction({
                game,
                state: current,
                action: finish(current)
            }).updatedState
        current = engine.executeCanonicalAction({
            game,
            state: current,
            action: finish(current)
        }).updatedState
        expect(current.stockRound.completed).toBe(false)
        current = engine.executeCanonicalAction({
            game,
            state: current,
            action: finish(current)
        }).updatedState
        expect(current.stockRound.passedPlayerIds).toEqual(
            definition === Top ? ['casey', 'blair'] : ['blair', 'casey']
        )
        current = engine.executeCanonicalAction({
            game,
            state: current,
            action: finish(current)
        }).updatedState
        expect(current.turnManager.turnOrder).toEqual(
            definition === Top ? ['casey', 'blair', 'alex'] : ['blair', 'casey', 'alex']
        )
    }
)

it('keeps Union Bank usage and sale restrictions across TOP turns while resetting the per-turn budget', () => {
    const { game, engine, state } = example(Top)
    const action = {
        ...buy(state, 'ML:share:5', 92),
        buyer: { kind: 'company', companyId: 'UB' } as const
    }
    let current = engine.executeCanonicalAction({ game, state, action }).updatedState
    expect(current.activePlayerIds[0]).toBe('blair')
    for (let index = 0; index < 2; index++)
        current = engine.executeCanonicalAction({
            game,
            state: current,
            action: finish(current)
        }).updatedState
    expect(current.activePlayerIds[0]).toBe('alex')
    expect(current.stockRound.turn.bought).toBe(false)
    expect(current.stockRound.companyPurchases).toEqual(['UB'])
    expect(TheOldPrinceStockRules.buyers(current, 'alex')).toEqual([
        { kind: 'player', playerId: 'alex' }
    ])
    expect(
        evaluateSharePurchase(
            current,
            { ...action, certificateId: 'ML:share:6' },
            TheOldPrinceStockRules
        ).details
    ).toBeUndefined()
    expect(current.turnManager.turnOrder).not.toContain('UB')
})

it.each([Top, Shikoku])(
    'retains sale history and rejects reacquisition on a later turn in $info.id',
    (definition) => {
        const { game, engine, state } = example(definition)
        const rules = definition === Top ? TheOldPrinceStockRules : Shikoku1889StockRules
        const companyId = definition === Top ? 'ML' : 'AR'
        const request = {
            playerId: 'alex',
            seller: { kind: 'player', playerId: 'alex' } as const,
            sales: [{ companyId, shares: 1 }]
        }
        const details = evaluateShareSale(state, request, rules).details
        if (!details) throw new Error('Missing sale')
        const action: SellShares = {
            ...request,
            id: 'sale',
            gameId: state.gameId,
            source: ActionSource.User,
            type: 'SellShares',
            expectedProceeds: details.proceeds
        }
        let current = engine.executeCanonicalAction({ game, state, action }).updatedState
        for (let index = 0; index < 3; index++)
            current = engine.executeCanonicalAction({
                game,
                state: current,
                action: finish(current)
            }).updatedState
        expect(current.activePlayerIds[0]).toBe('alex')
        expect(current.stockRound.turn.companiesSold).toEqual([])
        expect(current.stockRound.sales).toContainEqual({ owner: request.seller, companyId })
        expect(
            evaluateSharePurchase(
                current,
                { playerId: 'alex', buyer: request.seller, certificateId: `${companyId}:share:5` },
                rules
            ).reason
        ).toMatch(/sold/i)
    }
)

it('counts TOP reserved and Union Bank shares as sold, but excludes Bank and treasury shares', () => {
    const { state } = example(Top)
    expect(TheOldPrinceStockRules.round.soldOut(state, 'ML')).toBe(false)
    give(state, 'ML:share:5', { kind: 'player', playerId: 'casey' })
    give(state, 'ML:share:6', { kind: 'player', playerId: 'casey' })
    expect(TheOldPrinceStockRules.round.soldOut(state, 'ML')).toBe(false)
    give(state, 'ML:share:7', { kind: 'player', playerId: 'casey' })
    expect(TheOldPrinceStockRules.round.soldOut(state, 'ML')).toBe(true)
    expect(Shikoku1889StockRules.round.soldOut(state, 'ML')).toBe(false)
})

it('moves sold-out companies in market order, preserves an existing top marker, and derives operations after movement', () => {
    const { game, engine, state } = example(Shikoku)
    for (const certificate of state.certificates)
        if (
            certificate.kind === 'share' &&
            !certificate.retired &&
            certificate.owner.kind === 'bank'
        )
            give(state, certificate.id, { kind: 'player', playerId: 'casey' })
    placeStockMarker(state.stockMarket, 'AR', '0:2')
    placeStockMarker(state.stockMarket, 'IR', '1:2')
    let current = state
    for (let i = 0; i < 2; i++)
        current = engine.executeCanonicalAction({
            game,
            state: current,
            action: finish(current)
        }).updatedState
    const result = engine.executeCanonicalAction({ game, state: current, action: finish(current) })
    const completion = result.processedActions.find(isCompleteStockRound)
    expect(completion?.metadata?.marketMoves.map((move) => move.companyId)).toEqual(['AR', 'IR'])
    expect(companyMarketSpace(result.updatedState.stockMarket, 'IR').id).toBe('0:2')
    expect(
        result.updatedState.stockMarket.stacks.find((stack) => stack.spaceId === '0:2')?.companyIds
    ).toEqual(['AR', 'IR'])
    expect(result.updatedState.operatingSet?.companyOrder).toEqual(['AR', 'IR'])
})

it.each([Top, Shikoku])(
    'snapshots the operating set length at completion in $info.id',
    (definition) => {
        const { game, engine, state } = example(definition, 'starting')
        state.phaseId = definition === Top ? '4+' : '5'
        let current = state
        for (let index = 0; index < 3; index++)
            current = engine.executeCanonicalAction({
                game,
                state: current,
                action: finish(current)
            }).updatedState
        expect(current.operatingSet?.roundCount).toBe(3)
        expect(current.operatingSet?.companyOrder).not.toContain(definition === Top ? 'A' : 'SR')
        current.phaseId = definition === Top ? '2H' : '2'
        expect(current.operatingSet?.roundCount).toBe(3)
        if (definition === Top) {
            getCompany(current, 'PEIR').closed = true
            expect(TheOldPrinceOperatingRules.companyOrder(current)).not.toContain('PEIR')
            expect(TheOldPrinceOperatingRules.companyOrder(current)).not.toContain('UB')
        }
    }
)

it.each([Top, Shikoku])(
    'rejects inactive finish and premature or player-originated system actions in $info.id',
    (definition) => {
        const { game, engine, state } = example(definition)
        const invalid: GameAction[] = [
            { ...finish(state), playerId: 'blair' },
            { ...finish(state), source: ActionSource.System },
            { ...finish(state), type: 'CompleteStockRound' },
            { ...finish(state), type: 'CompleteStockRound', source: ActionSource.System },
            { ...finish(state), type: 'StartOperatingSet', source: ActionSource.System }
        ]
        for (const action of invalid)
            expect(() => engine.executeCanonicalAction({ game, state, action })).toThrow()
        expect(allPlayersPassed(state)).toBe(false)
    }
)

it.each([Top, Shikoku])(
    'includes a newly floated company in the next operating set for $info.id',
    (definition) => {
        const { game, engine, state } = example(definition, 'flotation')
        const companyId = definition === Top ? 'A' : 'SR'
        const action = buy(
            state,
            definition === Top ? 'A:share:4' : 'SR:share:3',
            definition === Top ? 80 : 65
        )
        let current = engine.executeCanonicalAction({ game, state, action }).updatedState
        expect(getCompany(current, companyId).floated).toBe(true)
        expect(current.stockRound.turn.acted).toBe(definition !== Top)
        expect(current.stockRound.passedPlayerIds).toEqual([])
        for (let index = 0; index < (definition === Top ? 3 : 4); index++)
            current = engine.executeCanonicalAction({
                game,
                state: current,
                action: finish(current)
            }).updatedState
        expect(current.operatingSet?.companyOrder).toContain(companyId)
        expect(current.turnManager.turnOrder).toEqual(['blair', 'casey', 'alex'])
    }
)

it('automatically finishes a TOP purchase in the same undoable result', () => {
    const { game, engine, state } = example(Top)
    const action = buy(state, 'ML:share:5', 92)
    const result = engine.executeCanonicalAction({ game, state, action })
    expect(result.processedActions.at(-1)).toMatchObject({
        type: 'FinishStockTurn', source: ActionSource.System, playerId: 'alex',
        metadata: { passed: false }
    })
    expect(result.updatedState.activePlayerIds[0]).toBe('blair')
    let restored = result.updatedState
    for (const processed of result.processedActions.toReversed())
        restored = engine.undoProcessedAction({ state: restored, action: processed })
    expect(restored).toEqual(state)
})

it('keeps an 1889 purchase turn open when selling is still legal', () => {
    const { game, engine, state } = example(Shikoku)
    const result = engine.executeCanonicalAction({ game, state, action: buy(state, 'IR:share:5', 70) })
    expect(result.processedActions.some(isFinishStockTurn)).toBe(false)
    expect(result.updatedState.activePlayerIds[0]).toBe('alex')
    expect(result.updatedState.stockRound.turn.bought).toBe(true)
})
