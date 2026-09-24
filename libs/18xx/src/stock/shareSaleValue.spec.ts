import { expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { createOrdinaryShareCertificates } from '../finance/finance.js'
import { createStockRound } from './stockRound.js'
import {
    createRectangularStockMarket,
    placeStockMarker,
    companyMarketSpace
} from './stockMarket.js'
import { evaluateShareSale, evaluateShareDisposal, applyShareSale } from './shareSale.js'
import { shareSaleValue } from './shareSaleValue.js'
import { priorityOrder } from './priorityOrder.js'
import type { StockState } from './stockState.js'
import type { StockRules } from './stockRules.js'

const seller = { kind: 'player', playerId: 'a' } as const
const other = { kind: 'player', playerId: 'b' } as const
const bank = { kind: 'bank' } as const
function example(): StockState {
    const stockMarket = createRectangularStockMarket([[100], [90], [80], [70]], () => 'white')
    placeStockMarker(stockMarket, 'R', '0:0')
    return {
        bank: { name: 'Bank' },
        companies: [
            {
                id: 'R',
                name: 'Railway',
                kind: 'major',
                shareCount: 10,
                president: seller,
                started: true
            }
        ],
        certificates: createOrdinaryShareCertificates(
            'R',
            [
                { owner: seller },
                { owner: seller },
                { owner: seller },
                { owner: other },
                { owner: other },
                { owner: bank, poolId: 'market' },
                { owner: bank, poolId: 'ipo' },
                { owner: bank, poolId: 'ipo' }
            ],
            seller
        ),
        cash: [
            { owner: bank, amount: 10000 },
            { owner: seller, amount: 200 },
            { owner: other, amount: 100 }
        ],
        certificatePools: [
            { id: 'market', owner: bank, name: 'Market' },
            { id: 'ipo', owner: bank, name: 'IPO' }
        ],
        players: [
            { playerId: 'a', color: Color.Blue },
            { playerId: 'b', color: Color.Red },
            { playerId: 'c', color: Color.Green }
        ],
        activePlayerIds: ['a'],
        turnManager: { turnOrder: ['a', 'b', 'c'], series: [], turnCounts: {} },
        phaseId: '3',
        ownershipLimitExemptions: [],
        stockRound: createStockRound(2),
        stockMarket
    }
}
const rules: StockRules = {
    sellers: (_state, playerId) => [{ kind: 'player', playerId }],
    buyers: () => [],
    purchaseTerms: () => 'Unavailable',
    saleTerms: () => ({
        payer: bank,
        price: 100,
        destinationPoolId: 'market',
        marketLimit: 50,
        maximumShares: 10,
        direction: 'down',
        movement: 1
    }),
    presidencyCandidates: () => [seller, other],
    certificateLimit: () => 20,
    certificateWeight: () => 1,
    ownershipLimit: () => 60,
    sellAfterBuying: false,
    round: { passing: 'consecutive', nextPlayerOrder: () => [], soldOut: () => false }
}

it('limits liquidation by market capacity and presidency without mutating state', () => {
    const state = example()
    const before = structuredClone(state)
    expect(shareSaleValue(state, seller, rules)).toBe(400)
    expect(state).toEqual(before)
    expect(shareSaleValue(state, seller, { ...rules, presidencyCandidates: () => [seller] })).toBe(
        300
    )
    expect(
        shareSaleValue(state, seller, {
            ...rules,
            saleTerms: () => ({
                payer: bank,
                price: 100,
                destinationPoolId: 'market',
                marketLimit: 50,
                maximumShares: 2,
                direction: 'down',
                movement: 1
            })
        })
    ).toBe(200)
    expect(shareSaleValue(state, seller, { ...rules, saleTerms: () => 'Not until operated' })).toBe(
        0
    )
})

it('keeps priority through passes and advances it after a stock action', () => {
    const state = example()
    state.activePlayerIds = ['c']
    state.stockRound.passedPlayerIds = ['b']
    expect(priorityOrder(state, rules.round)).toEqual(['b', 'c', 'a'])
    state.stockRound.turn.acted = true
    expect(priorityOrder(state, rules.round)).toEqual(['a', 'b', 'c'])
    state.stockRound.completed = true
    state.turnManager.turnOrder = ['c', 'a', 'b']
    expect(priorityOrder(state, rules.round)).toEqual(['c', 'a', 'b'])
})

it('uses pass order for titles that award priority by passing', () => {
    const state = example()
    state.stockRound.passedPlayerIds = ['c', 'a']
    expect(priorityOrder(state, { ...rules.round, passing: 'pass-order' })).toEqual(['c', 'a', 'b'])
    state.stockRound.passedPlayerIds = ['a']
    expect(priorityOrder(state, { ...rules.round, passing: 'pass-order' })).toEqual(['a', 'b', 'c'])
})

it('requires a separate stock action for each company sale', () => {
    const state = example()
    const before = structuredClone(state)
    expect(
        evaluateShareSale(
            state,
            {
                playerId: 'a',
                seller,
                sales: [
                    { companyId: 'R', shares: 1 },
                    { companyId: 'S', shares: 1 }
                ]
            },
            rules
        ).reason
    ).toBe('Sell one company per action.')
    expect(
        evaluateShareSale(
            state,
            { playerId: 'a', seller, sales: [{ companyId: 'R', shares: 2 }] },
            rules
        ).details?.proceeds
    ).toBe(200)
    expect(state).toEqual(before)
})

it.each([false, true])(
    'extends a sale block at its original price with cumulative movement (per share: %s)',
    (perShare) => {
        const state = example()
        const extended: StockRules = {
            ...rules,
            extendSaleBlocks: true,
            saleTerms: (current, companyId, shares) => ({
                payer: bank,
                price: companyMarketSpace(current.stockMarket, companyId).price,
                destinationPoolId: 'market',
                marketLimit: 80,
                maximumShares: 3,
                direction: 'down',
                movement: perShare ? shares : 1
            })
        }
        const first = evaluateShareSale(
            state,
            { playerId: 'a', seller, sales: [{ companyId: 'R', shares: 1 }] },
            extended
        )
        expect(first.details?.proceeds).toBe(100)
        if (!first.details) throw new Error('Expected legal first sale')
        applyShareSale(state, first.details)
        state.stockRound.turn.companiesSold = ['R']
        state.stockRound.turn.saleBlocks = [
            {
                id: 'first',
                companyId: 'R',
                seller,
                price: 100,
                shares: 1,
                movement: 1,
                direction: 'down'
            }
        ]
        const next = evaluateShareSale(
            state,
            { playerId: 'a', seller, sales: [{ companyId: 'R', shares: 2 }] },
            extended
        )
        expect(next.details?.proceeds).toBe(200)
        expect(next.details?.sales[0].price).toBe(100)
        expect(next.details?.sales[0].toMarketSpaceId).toBe(perShare ? '3:0' : '1:0')
        expect(
            evaluateShareSale(
                state,
                { playerId: 'a', seller, sales: [{ companyId: 'R', shares: 3 }] },
                extended
            ).reason
        ).toContain('per-turn')
        expect(
            evaluateShareSale(
                state,
                { playerId: 'a', seller, sales: [{ companyId: 'R', shares: 1 }] },
                rules
            ).reason
        ).toContain('one block')
        state.stockRound.turn = createStockRound(3).turn
        expect(
            evaluateShareSale(
                state,
                { playerId: 'a', seller, sales: [{ companyId: 'R', shares: 1 }] },
                extended
            ).details?.proceeds
        ).toBe(90)
    }
)

it('uses the actual asset owner for directional sales, independently of the active player', () => {
    const state = example()
    state.stockMarket = createRectangularStockMarket([[80, 90, 100]], () => 'white')
    placeStockMarker(state.stockMarket, 'R', '0:2')
    const directional: StockRules = {
        ...rules,
        saleTerms(current, companyId, shares, owner) {
            const president = current.companies.find(
                (company) => company.id === companyId
            )?.president
            return {
                payer: bank,
                price: 100,
                destinationPoolId: 'market',
                marketLimit: 50,
                maximumShares: 10,
                direction: 'left',
                movement:
                    owner.kind === president?.kind &&
                    owner.kind === 'player' &&
                    president.kind === 'player' &&
                    owner.playerId === president.playerId
                        ? shares
                        : 0
            }
        }
    }
    expect(
        evaluateShareDisposal(state, other, [{ companyId: 'R', shares: 1 }], directional).details
            ?.sales[0].toMarketSpaceId
    ).toBe('0:2')
    expect(
        evaluateShareDisposal(state, seller, [{ companyId: 'R', shares: 1 }], directional).details
            ?.sales[0].toMarketSpaceId
    ).toBe('0:1')
    state.stockRound.turn.saleBlocks = [
        {
            id: 'first',
            companyId: 'R',
            seller,
            price: 100,
            shares: 1,
            movement: 1,
            direction: 'left'
        }
    ]
    state.stockRound.turn.companiesSold = ['R']
    placeStockMarker(state.stockMarket, 'R', '0:1')
    const extended = evaluateShareSale(
        state,
        {
            playerId: 'a',
            seller,
            sales: [{ companyId: 'R', shares: 1 }]
        },
        { ...directional, extendSaleBlocks: true }
    )
    expect(extended.details?.sales[0].toMarketSpaceId).toBe('0:0')
})
