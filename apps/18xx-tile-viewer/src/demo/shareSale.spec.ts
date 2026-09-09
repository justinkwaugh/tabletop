import { expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import {
    cashOwnedBy,
    getCompany,
    sharesOwned,
    companyMarketSpace,
    placeStockMarker,
    evaluateShareSale,
    evaluateSharePurchase,
    isSellShares,
    isBuyShares,
    exceedsStockLimits,
    stockCertificateCount,
    type SellShares,
    type FinishStockTurn,
    type FinanceExampleState,
    type Owner,
    type ShareSale
} from '@tabletop/18xx'
import { Definition as Top, TheOldPrinceStockRules } from '@tabletop/the-old-prince'
import { Definition as Shikoku, Shikoku1889StockRules } from '@tabletop/shikoku-1889'
import { example, purchase } from './stockTestUtils.js'

const alex = { kind: 'player', playerId: 'alex' } as const
const blair = { kind: 'player', playerId: 'blair' } as const
const casey = { kind: 'player', playerId: 'casey' } as const
const union = { kind: 'company', companyId: 'UB' } as const
function give(state: FinanceExampleState, id: string, owner: Owner, poolId?: string) {
    const certificate = state.certificates.find((certificate) => certificate.id === id)
    if (!certificate || certificate.retired) throw new Error('Missing fixture certificate')
    certificate.owner = owner
    if (poolId) certificate.poolId = poolId
    else delete certificate.poolId
}
function sell(sales: ShareSale[], expectedProceeds: number, seller: Owner = alex): SellShares {
    return {
        id: 'sell',
        gameId: 'purchase-example',
        type: 'SellShares',
        source: ActionSource.User,
        playerId: 'alex',
        seller,
        sales,
        expectedProceeds
    }
}
const finish: FinishStockTurn = {
    id: 'finish',
    gameId: 'purchase-example',
    type: 'FinishStockTurn',
    source: ActionSource.User,
    playerId: 'alex'
}

it.each([
    { definition: Shikoku, companyId: 'AR', price: 90, nextPrice: 75 },
    { definition: Top, companyId: 'ML', price: 92, nextPrice: 86 }
])(
    'settles $definition.info.id sale and presidency exchange with exact replay and Undo',
    ({ definition, companyId, price, nextPrice }) => {
        const { game, engine, state } = example(definition)
        if (companyId === 'AR') give(state, 'AR:share:3', blair)
        const before = structuredClone(state)
        const result = engine.executeCanonicalAction({
            game,
            state,
            action: sell([{ companyId, shares: 2 }], price * 2)
        })
        expect(state).toEqual(before)
        expect(cashOwnedBy(result.updatedState, alex)).toBe(240 + price * 2)
        expect(sharesOwned(result.updatedState, companyId, alex)).toBe(1)
        expect(sharesOwned(result.updatedState, companyId, blair)).toBe(2)
        expect(getCompany(result.updatedState, companyId).president).toEqual(blair)
        expect(
            result.updatedState.certificates.find(
                (certificate) => certificate.id === `${companyId}:president`
            )
        ).toMatchObject({ owner: blair })
        expect(companyMarketSpace(result.updatedState.stockMarket, companyId).price).toBe(nextPrice)
        const action = result.processedActions[0]
        if (!isSellShares(action)) throw new Error('Missing sale action')
        expect(action.metadata?.sales[0].presidency?.exchangedCertificateIds).toHaveLength(2)
        expect(action.metadata?.sales[0].certificateIds).not.toContain(`${companyId}:president`)
        expect(result.updatedState.stockRound.sales).toContainEqual({ owner: alex, companyId })
        expect(engine.applyProcessedAction({ game, state: before, action })).toEqual(
            result.updatedState
        )
        expect(engine.undoProcessedAction({ state: result.updatedState, action })).toEqual(before)
        expect(
            definition.runtime.hydrator
                .hydrateState(JSON.parse(JSON.stringify(result.updatedState)))
                .dehydrate()
        ).toEqual(result.updatedState)
    }
)

it.each([Shikoku, Top])('retains the incumbent on a tied holding in $info.id', (definition) => {
    const { game, engine, state } = example(definition)
    const companyId = definition === Top ? 'ML' : 'AR'
    if (definition === Shikoku) give(state, 'AR:share:3', blair)
    const price = companyMarketSpace(state.stockMarket, companyId).price
    const result = engine.executeCanonicalAction({
        game,
        state,
        action: sell([{ companyId, shares: 1 }], price)
    })
    expect(getCompany(result.updatedState, companyId).president).toEqual(alex)
})

it.each([Shikoku, Top])('supports a presidency change on purchase in $info.id', (definition) => {
    const { game, engine, state } = example(definition)
    const companyId = definition === Top ? 'ML' : 'IR'
    const buyer = definition === Top ? union : alex
    for (const id of [3, 4]) give(state, `${companyId}:share:${id}`, buyer)
    const result = engine.executeCanonicalAction({
        game,
        state,
        action: purchase(`${companyId}:share:5`, definition === Top ? 92 : 70, buyer)
    })
    expect(getCompany(result.updatedState, companyId).president).toEqual(buyer)
    expect(sharesOwned(result.updatedState, companyId, buyer)).toBe(4)
    const previous = definition === Top ? alex : blair
    expect(sharesOwned(result.updatedState, companyId, previous)).toBe(3)
    const record = result.processedActions[0]
    if (!isBuyShares(record)) throw new Error('Expected purchase')
    expect(record.metadata?.presidency?.next).toEqual(buyer)
    expect(engine.undoProcessedAction({ state: result.updatedState, action: record })).toEqual(
        state
    )
    expect(engine.applyProcessedAction({ game, state, action: record })).toEqual(
        result.updatedState
    )
})

it('chooses players before Union Bank when successor holdings tie', () => {
    const { game, engine, state } = example(Top)
    give(state, 'ML:share:6', union)
    const result = engine.executeCanonicalAction({
        game,
        state,
        action: sell([{ companyId: 'ML', shares: 2 }], 184)
    })
    expect(getCompany(result.updatedState, 'ML').president).toEqual(blair)
    expect(sharesOwned(result.updatedState, 'ML', union)).toBe(2)
})
it('allows Union Bank to take a presidency through another owner’s sale', () => {
    const { game, engine, state } = example(Top)
    give(state, 'ML:share:3', union)
    give(state, 'ML:share:4', casey)
    const result = engine.executeCanonicalAction({
        game,
        state,
        action: sell([{ companyId: 'ML', shares: 2 }], 184)
    })
    expect(getCompany(result.updatedState, 'ML').president).toEqual(union)
    expect(sharesOwned(result.updatedState, 'ML', union)).toBe(2)
})
it('resolves 1889 successor ties clockwise from the incumbent using turn order', () => {
    const { state } = example(Shikoku)
    give(state, 'AR:share:5', blair)
    give(state, 'AR:share:6', casey)
    state.turnManager.turnOrder = ['blair', 'alex', 'casey']
    const result = evaluateShareSale(
        state,
        sell([{ companyId: 'AR', shares: 2 }], 180),
        Shikoku1889StockRules
    )
    expect(result.details?.sales[0].presidency?.next).toEqual(casey)
})
it.each([
    ['ML', 'So'],
    ['So', 'ML']
])(
    'preserves the chosen TOP arrival order %s then %s beneath existing markers',
    (first, second) => {
        const { game, engine, state } = example(Top)
        give(state, 'So:share:2', alex)
        state.companies.push({ id: 'stationary', kind: 'major', name: 'Stationary' })
        placeStockMarker(state.stockMarket, 'stationary', '2:1')
        placeStockMarker(state.stockMarket, 'So', '1:1')
        const result = engine.executeCanonicalAction({
            game,
            state,
            action: sell(
                [
                    { companyId: first, shares: 1 },
                    { companyId: second, shares: 1 }
                ],
                184
            )
        })
        expect(
            result.updatedState.stockMarket.stacks.find((stack) => stack.spaceId === '2:1')
                ?.companyIds
        ).toEqual(['stationary', first, second])
        expect(cashOwnedBy(result.updatedState, alex)).toBe(424)
    }
)

it('rejects reserved purchases, Union Bank sales, unoperated companies, PEIR sales and oversized TOP blocks', () => {
    const { state } = example(Top)
    const evaluate = (companyId: string, shares: number, seller: Owner = alex) =>
        evaluateShareSale(state, sell([{ companyId, shares }], 1, seller), TheOldPrinceStockRules)
    expect(evaluate('ML', 1, union).reason).toContain('cannot sell')
    expect(evaluate('PEIR', 1).reason).toContain('no saleable')
    give(state, 'ML:share:5', alex)
    expect(evaluate('ML', 4).reason).toContain('sale limit')
    getCompany(state, 'ML').operated = false
    expect(evaluate('ML', 1).reason).toContain('operated')
    expect(
        evaluateSharePurchase(state, purchase('ML:share:8', 92), TheOldPrinceStockRules).reason
    ).toContain('not available')
})
it('rejects 1889 first-round sales and a Market above 50%', () => {
    const { state } = example(Shikoku)
    state.stockRound.number = 1
    expect(
        evaluateShareSale(state, sell([{ companyId: 'AR', shares: 1 }], 90), Shikoku1889StockRules)
            .reason
    ).toContain('first stock round')
    state.stockRound.number = 2
    for (const id of [5, 6, 7, 8]) give(state, `AR:share:${id}`, { kind: 'bank' }, 'open-market')
    expect(
        evaluateShareSale(state, sell([{ companyId: 'AR', shares: 1 }], 90), Shikoku1889StockRules)
            .reason
    ).toContain('Market cannot')
})
it('rejects a presidency dump without a successor, a stale sale price, an unauthorized actor, and malformed blocks without mutation', () => {
    const { game, engine, state } = example(Shikoku)
    const before = structuredClone(state)
    const requests: SellShares[] = [
        sell([{ companyId: 'AR', shares: 2 }], 180),
        sell([{ companyId: 'AR', shares: 1 }], 1),
        { ...sell([{ companyId: 'AR', shares: 1 }], 90), playerId: 'blair' },
        { ...sell([{ companyId: 'AR', shares: 1 }], 90), source: ActionSource.System },
        sell(
            [
                { companyId: 'AR', shares: 1 },
                { companyId: 'AR', shares: 1 }
            ],
            180
        ),
        sell([{ companyId: 'AR', shares: -1 }], 90)
    ]
    for (const action of requests)
        expect(() => engine.executeCanonicalAction({ game, state, action })).toThrow()
    expect(state).toEqual(before)
})
it('enforces each title’s sale/purchase sequence and one sale block per company', () => {
    for (const [definition, companyId, rules] of [
        [Top, 'ML', TheOldPrinceStockRules],
        [Shikoku, 'AR', Shikoku1889StockRules]
    ] as const) {
        const { game, engine, state } = example(definition)
        const bought = engine.executeCanonicalAction({
            game,
            state,
            action: purchase(`${companyId}:share:5`, definition === Top ? 92 : 65)
        }).updatedState
        expect(
            !!evaluateShareSale(bought, sell([{ companyId, shares: 1 }], 1), rules).details
        ).toBe(definition === Shikoku)
        const sale = engine.executeCanonicalAction({
            game,
            state,
            action: sell([{ companyId, shares: 1 }], definition === Top ? 92 : 90)
        }).updatedState
        expect(
            evaluateShareSale(sale, sell([{ companyId, shares: 1 }], 1), rules).reason
        ).toContain('one block')
        expect(
            evaluateSharePurchase(sale, purchase(`${companyId}:share:5`, 1), rules).reason
        ).toContain('sold shares')
        const other = definition === Top ? 'So' : 'IR'
        const afterBuy = engine.executeCanonicalAction({
            game,
            state: sale,
            action: purchase(`${other}:share:5`, definition === Top ? 86 : 70)
        }).updatedState
        expect(
            evaluateShareSale(afterBuy, sell([{ companyId: other, shares: 1 }], 1), rules).reason
        ).toContain('after this purchase')
    }
})
it('applies yellow/orange exemptions dynamically and requires sales when an exemption ends', () => {
    const { state, game, engine } = example(Shikoku)
    for (const id of [2, 3, 4, 5]) give(state, `AR:share:${id}`, alex)
    placeStockMarker(state.stockMarket, 'AR', '10:0')
    expect(stockCertificateCount(state, alex, Shikoku1889StockRules)).toBe(3)
    expect(exceedsStockLimits(state, alex, Shikoku1889StockRules)).toBe(false)
    placeStockMarker(state.stockMarket, 'AR', '5:0')
    expect(stockCertificateCount(state, alex, Shikoku1889StockRules)).toBe(3)
    expect(exceedsStockLimits(state, alex, Shikoku1889StockRules)).toBe(true)
    placeStockMarker(state.stockMarket, 'AR', '0:2')
    expect(() => engine.executeCanonicalAction({ game, state, action: finish })).toThrow()
    const sold = engine.executeCanonicalAction({
        game,
        state,
        action: sell([{ companyId: 'AR', shares: 1 }], 90)
    }).updatedState
    expect(exceedsStockLimits(sold, alex, Shikoku1889StockRules)).toBe(false)
    const done = engine.executeCanonicalAction({ game, state: sold, action: finish })
    expect(done.updatedState.machineState).toBe('InspectFinances')
    expect(
        engine.undoProcessedAction({ state: done.updatedState, action: done.processedActions[0] })
    ).toEqual(sold)
})
it('does not use a presidency exchange to evade the 1889 certificate limit', () => {
    const { state } = example(Shikoku)
    for (const id of [3, 4]) give(state, `IR:share:${id}`, alex)
    const certificate = state.certificates.find((certificate) => certificate.id === 'AR:president')!
    certificate.certificateLimitCount = 15
    expect(stockCertificateCount(state, alex, Shikoku1889StockRules)).toBe(19)
    expect(
        evaluateSharePurchase(state, purchase('IR:share:5', 70), Shikoku1889StockRules).reason
    ).toContain('certificate limit')
})
