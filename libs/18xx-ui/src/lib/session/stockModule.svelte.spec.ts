import { describe, expect, it } from 'vitest'
import { assert } from '@tabletop/common'
import { companyCharters, createOrdinaryShareCertificates } from '@tabletop/18xx'
import {
    TestCompanyId,
    TestPlayerId,
    minimalCompanyRules,
    minimalValuationRules,
    minimalPlayState,
    minimalStockRules
} from '@tabletop/18xx/testing'
import { StockModule, type StockSession } from './stockModule.svelte.js'
import { testSession } from './moduleTestSession.js'

const player = { kind: 'player', playerId: TestPlayerId } as const
const sale = {
    playerId: TestPlayerId,
    seller: player,
    sales: [{ companyId: TestCompanyId, shares: 1 }]
}
const start = { playerId: TestPlayerId, buyer: player, companyId: TestCompanyId }

function trading(valid: string[] = [], availability = {}) {
    const state: StockSession['state'] = { ...minimalPlayState(), machineState: 'StockRound' }
    let cancelled = 0
    const harness = testSession(
        state,
        {
            stockRules: minimalStockRules,
            companyRules: minimalCompanyRules,
            endingRules: minimalValuationRules
        },
        valid,
        availability
    )
    const module = new StockModule(harness.session, () => cancelled++)
    return { ...harness, module, cancelled: () => cancelled }
}

describe('StockModule', () => {
    it('offers and buys a share held in its corporation treasury', async () => {
        const { session, applied } = trading(['BuyShares'])
        const treasury = { kind: 'company', companyId: TestCompanyId } as const
        session.state.companies[0].started = true
        session.state.companies[0].floated = true
        session.state.companies[0].president = player
        session.state.cash.push({ owner: player, amount: 100 }, { owner: treasury, amount: 0 })
        session.state.certificates.push(
            {
                id: 'treasury-share',
                companyId: TestCompanyId,
                kind: 'share',
                shares: 1,
                owner: treasury
            },
            {
                id: 'president',
                companyId: TestCompanyId,
                kind: 'share',
                shares: 2,
                president: true,
                owner: player
            }
        )
        const rules = {
            ...session.rules,
            stockRules: {
                ...minimalStockRules,
                purchaseTerms: () => ({ price: 10, recipient: treasury, payers: [player] })
            }
        }
        const module = new StockModule({ ...session, rules }, () => {})
        expect(module.availableMenus.map((choice) => choice.menu)).toContain('buy')
        expect(module.purchaseChoices[0].result.details?.seller).toEqual(treasury)
        module.selectPurchase(module.purchaseChoices[0].request)
        await module.confirmPurchase()
        expect(applied[0]).toMatchObject({
            type: 'BuyShares',
            certificateId: 'treasury-share',
            expectedPrice: 10
        })
    })
    it('leaves a sole menu closed until the player chooses it', async () => {
        const { session, applied } = trading(['FinishStockTurn'])
        const module = new StockModule(
            session,
            () => {},
            () => true
        )
        expect(module.availableMenus.map((choice) => choice.menu)).toEqual(['exchange'])
        expect(module.openMenu).toBeUndefined()
        module.chooseMenu('exchange')
        expect(module.openMenu).toBe('exchange')
        expect(module.hasManual()).toBe(true)
        expect(module.undo()).toBe(true)
        expect(module.openMenu).toBeUndefined()
        await module.finishTurn()
        expect(applied.map((action) => action.type)).toEqual(['FinishStockTurn'])
    })

    it('Undo steps back from the sale company to the menu, then closes the menu', () => {
        const { module } = trading()
        module.chooseMenu('sell')
        module.chooseSaleCompany(TestCompanyId)
        expect(module.openMenu).toBe('sell')
        expect(module.selectedSaleCompany).toBe(TestCompanyId)
        expect(module.undo()).toBe(true)
        expect(module.selectedSaleCompany).toBeUndefined()
        expect(module.openMenu).toBe('sell')
        expect(module.undo()).toBe(true)
        expect(module.openMenu).toBeUndefined()
        expect(module.undo()).toBe(false)
    })

    it('Undo drops a staged sale together with its company in one step', () => {
        const { module, cancelled } = trading()
        module.chooseMenu('sell')
        module.chooseSaleCompany(TestCompanyId)
        module.selectSale(sale)
        const before = cancelled()
        expect(module.undo()).toBe(true)
        expect(module.selectedSale).toBeUndefined()
        expect(module.selectedSaleCompany).toBeUndefined()
        expect(module.openMenu).toBe('sell')
        expect(cancelled()).toBe(before + 1)
    })

    it('does not let Undo consume a menu the session reopened automatically', () => {
        const { module } = trading()
        module.menu.choose('action', { menu: 'sell' }, 'auto')
        expect(module.openMenu).toBe('sell')
        expect(module.hasManual()).toBe(false)
        expect(module.undo()).toBe(false)
        module.chooseSaleCompany(TestCompanyId)
        expect(module.undo()).toBe(true)
        expect(module.openMenu).toBe('sell')
    })

    it('carries a corporate buyer with the menu and drops it when the menu closes', () => {
        const { module } = trading()
        const buyer = { kind: 'company', companyId: 'UB' } as const
        module.chooseMenu('buy', buyer)
        expect(module.menuBuyer).toEqual(buyer)
        module.chooseMenu(undefined)
        expect(module.menuBuyer).toBeUndefined()
        expect(module.hasManual()).toBe(false)
    })

    it('choosing a menu cancels the staged trade and tells the session', () => {
        const { module, cancelled } = trading()
        module.selectSale(sale)
        expect(module.hasSelection).toBe(true)
        module.chooseMenu('buy')
        expect(module.hasSelection).toBe(false)
        expect(cancelled()).toBe(1)
    })

    it('stages a company start as company then price, and Undo unwinds them one at a time', () => {
        const { module } = trading()
        module.selectSale(sale)
        module.selectCompanyStart(start)
        expect(module.selectedSale).toBeUndefined()
        expect(module.selectedStartCompany).toEqual(start)
        module.selectStartPrice('0:1')
        expect(module.selectedStartResult).toBeDefined()
        expect(module.undo()).toBe(true)
        expect(module.selectedStartResult).toBeUndefined()
        expect(module.selectedStartCompany).toEqual(start)
        expect(module.undo()).toBe(true)
        expect(module.hasSelection).toBe(false)
        expect(() => module.selectStartPrice('0:1')).toThrow()
    })

    it('stages a chosen home between company and price, and Undo unwinds it', async () => {
        const { session, applied } = trading(['StartCompany'])
        const treasury = { kind: 'company', companyId: TestCompanyId } as const
        session.state.cash.push({ owner: player, amount: 1000 }, { owner: treasury, amount: 0 })
        session.state.certificates.push({
            id: 'president',
            companyId: TestCompanyId,
            kind: 'share',
            shares: 2,
            president: true,
            owner: treasury
        })
        const homes = [
            { locationId: 'A1', nodeId: 'city', slot: 0, cost: 80 },
            { locationId: 'B1', nodeId: 'city', slot: 0, cost: 120 }
        ]
        const rules = {
            ...session.rules,
            companyRules: {
                ...minimalCompanyRules,
                startMarketSpaces: () => ['0:1'],
                startTerms: () => ({ price: 240, recipient: treasury, payers: [player] }),
                startHomes: () => homes
            }
        }
        const module = new StockModule({ ...session, rules }, () => {})
        expect(module.homePositions).toEqual([])
        module.selectCompanyStart(start)
        expect(module.awaitingStartHome).toBe(true)
        expect(module.homePositions).toEqual(homes)
        expect(() => module.chooseHome({ locationId: 'C1', nodeId: 'city' })).toThrow()
        expect(module.chosenHome).toBeUndefined()
        module.chooseHome({ locationId: 'A1', nodeId: 'city' })
        expect(module.chosenHome).toEqual({
            companyId: TestCompanyId,
            locationId: 'A1',
            nodeId: 'city'
        })
        expect(module.awaitingStartHome).toBe(false)
        expect(module.homePositions).toEqual([])
        expect(module.selectedStartHomeChoice).toEqual(homes[0])
        expect(module.undo()).toBe(true)
        expect(module.chosenHome).toBeUndefined()
        expect(module.awaitingStartHome).toBe(true)
        module.chooseHome({ locationId: 'B1', nodeId: 'city' })
        module.selectStartPrice('0:1')
        expect(module.selectedStartResult?.reason).toBeUndefined()
        expect(module.selectedStartResult?.details?.home).toMatchObject({
            position: { locationId: 'B1', nodeId: 'city' },
            cost: 120
        })
        await module.confirmStart()
        expect(applied[0]).toMatchObject({
            type: 'StartCompany',
            home: { locationId: 'B1', nodeId: 'city' }
        })
    })

    it('stages one company per sale and removes it by company', () => {
        const { module } = trading()
        module.selectSale(sale)
        expect(module.selectedSale).toEqual(sale)
        expect(module.selectedSaleResult?.reason).toBeDefined()
        module.removeSale(TestCompanyId)
        expect(module.hasSelection).toBe(false)
        expect(() =>
            module.selectSale({ ...sale, sales: [...sale.sales, { companyId: 'S', shares: 1 }] })
        ).toThrow()
    })

    it('refuses a purchase the rules do not allow, a trade for another player, and any trade while not interactive', () => {
        const purchase = { playerId: TestPlayerId, buyer: player, certificateId: 'missing' }
        expect(() => trading().module.selectPurchase(purchase)).toThrow()
        expect(() => trading().module.selectSale({ ...sale, playerId: 'blake' })).toThrow()
        expect(() => trading([], { interactive: false }).module.chooseMenu('buy')).toThrow()
    })

    it('hides staged choices while selections are hidden but still reports them as pending', () => {
        const { module } = trading([], { selectionsVisible: false })
        module.chooseMenu('sell')
        module.selectSale(sale)
        expect(module.openMenu).toBeUndefined()
        expect(module.selectedSale).toBeUndefined()
        expect(module.hasManual()).toBe(true)
        module.clear()
        expect(module.hasManual()).toBe(false)
    })

    it('finishes the turn only with nothing staged', async () => {
        const { module, applied } = trading(['FinishStockTurn'])
        module.selectSale(sale)
        await expect(module.finishTurn()).rejects.toThrow()
        module.cancel()
        await module.finishTurn()
        expect(applied.map((action) => action.type)).toEqual(['FinishStockTurn'])
    })

    describe('a purchase the turn may follow with another', () => {
        function buyingTwice(
            allowsAnother: boolean,
            afterPurchase: (state: StockSession['state']) => void = () => {}
        ) {
            const treasury = { kind: 'company', companyId: TestCompanyId } as const
            const { session, applied } = trading(['BuyShares'])
            session.state.companies[0].started = true
            session.state.companies[0].floated = true
            session.state.companies[0].president = player
            session.state.cash.push({ owner: player, amount: 100 }, { owner: treasury, amount: 0 })
            session.state.certificates.push(
                ...['first', 'second'].map((id) => ({
                    id,
                    companyId: TestCompanyId,
                    kind: 'share' as const,
                    shares: 1,
                    owner: treasury
                })),
                {
                    id: 'president',
                    companyId: TestCompanyId,
                    kind: 'share',
                    shares: 2,
                    president: true,
                    owner: player
                }
            )
            const rules = {
                ...session.rules,
                stockRules: {
                    ...minimalStockRules,
                    purchaseTerms: () => ({ price: 10, recipient: treasury, payers: [player] }),
                    multipleBuys: allowsAnother ? { allowsAnother: () => true } : undefined
                }
            }
            // Publishing the new state clears staged selections before the menu can reopen.
            const state = $state(session.state)
            const module: StockModule = new StockModule(
                {
                    ...session,
                    state,
                    rules,
                    applyAction: async (action) => {
                        applied.push(action)
                        state.stockRound.turn.bought = true
                        afterPurchase(state)
                        module.clear()
                    }
                },
                () => {}
            )
            return { module, applied }
        }
        async function buyFirst(module: StockModule) {
            module.chooseMenu('buy')
            const first = module.purchaseChoices.find((choice) => choice.certificate.id === 'first')
            assert(first, 'The first treasury share is on offer')
            module.selectPurchase(first.request)
            await module.confirmPurchase()
        }

        it('reopens Buy for the same buyer, names the company, and lets Undo reverse the purchase', async () => {
            const { module, applied } = buyingTwice(true)
            await buyFirst(module)
            expect(applied).toHaveLength(1)
            expect(module.menu.entry('action')).toEqual({
                value: { menu: 'buy', buyer: player },
                source: 'auto'
            })
            expect(module.furtherPurchaseCompanyId).toBe(TestCompanyId)
            expect(module.hasManual()).toBe(false)
            expect(module.undo()).toBe(false)
        })

        it('reopens Buy after a purchase made in the menu, but not after a direct one', async () => {
            const reopening = buyingTwice(true)
            const offered = reopening.module.purchaseChoices.find(
                (choice) => choice.certificate.id === 'first'
            )
            assert(offered, 'The first treasury share is on offer')
            await reopening.module.buyAndReopenMenu(offered.request)
            expect(reopening.module.menu.value('action')).toEqual({ menu: 'buy', buyer: player })

            const direct = buyingTwice(true)
            const share = direct.module.purchaseChoices.find(
                (choice) => choice.certificate.id === 'first'
            )
            assert(share, 'The first treasury share is on offer')
            await direct.module.buy(share.request)
            expect(direct.applied).toHaveLength(1)
            expect(direct.module.menu.entry('action')).toBeUndefined()
        })

        it('closes the menu when no further purchase is legal', async () => {
            const { module } = buyingTwice(false)
            await buyFirst(module)
            expect(module.furtherPurchaseCompanyId).toBeUndefined()
            expect(module.menu.entry('action')).toBeUndefined()
        })

        it('closes the menu when the turn passes to another player', async () => {
            const { module } = buyingTwice(true, (state) => {
                state.activePlayerIds = ['blair']
            })
            await buyFirst(module)
            expect(module.menu.entry('action')).toBeUndefined()
        })
    })
})

describe('company trades', () => {
    const bank = { kind: 'bank' } as const
    const blair = { kind: 'player', playerId: 'blair' } as const
    const unionBank = { kind: 'company', companyId: 'U' } as const

    function holdings(valid: string[] = ['BuyShares', 'SellShares'], availability = {}) {
        const harness = trading(valid, availability)
        const { state } = harness.session
        state.players.push({ playerId: 'blair', color: state.players[0].color })
        state.companies[0] = {
            ...state.companies[0],
            started: true,
            floated: true,
            president: player
        }
        state.companies.push({ id: 'U', kind: 'major', started: true, floated: true })
        state.certificatePools.push({ id: 'market', owner: bank }, { id: 'ipo', owner: bank })
        state.certificates.push(
            ...createOrdinaryShareCertificates(
                TestCompanyId,
                [
                    { owner: player },
                    { owner: player },
                    { owner: blair },
                    { owner: blair },
                    { owner: bank, poolId: 'market' },
                    { owner: bank, poolId: 'ipo' },
                    { owner: bank, poolId: 'ipo' },
                    { owner: bank, poolId: 'ipo' }
                ],
                player
            )
        )
        state.cash.push(
            { owner: player, amount: 1000 },
            { owner: blair, amount: 0 },
            { owner: unionBank, amount: 1000 }
        )
        const rules = {
            ...harness.session.rules,
            stockRules: {
                ...minimalStockRules,
                charters: companyCharters(() => ({
                    shareCounts: { [TestCompanyId]: 10, U: 10 },
                    privateRevenues: {}
                })),
                buyers: () => [player, unionBank],
                purchaseTerms: (
                    _state: unknown,
                    certificate: { poolId?: string },
                    buyer: unknown
                ) => ({
                    price: certificate.poolId === 'ipo' ? 100 : 90,
                    recipient: bank,
                    payers: [buyer === unionBank ? unionBank : player]
                }),
                saleTerms: () => ({
                    payer: bank,
                    price: 90,
                    destinationPoolId: 'market',
                    marketLimit: 50,
                    maximumShares: 10,
                    direction: 'down',
                    movement: 1
                }),
                presidencyCandidates: () => [player, blair]
            }
        }
        const module = new StockModule({ ...harness.session, rules }, () => {})
        return { ...harness, module }
    }

    it('offers one purchase per pool and buyer', () => {
        const { module } = holdings()
        const { offers, buyers } = module.companyTrades(TestCompanyId)
        expect(buyers).toEqual([player, unionBank])
        expect(
            offers.map((offer) => ({
                poolId: offer.certificate.poolId,
                shares: offer.certificate.shares,
                purchases: offer.purchases.map((purchase) => [
                    purchase.request.buyer,
                    purchase.details.price
                ])
            }))
        ).toEqual([
            {
                poolId: 'market',
                shares: 1,
                purchases: [
                    [player, 90],
                    [unionBank, 90]
                ]
            },
            {
                poolId: 'ipo',
                shares: 1,
                purchases: [
                    [player, 100],
                    [unionBank, 100]
                ]
            }
        ])
    })

    it('offers a larger or numbered certificate in the same pool as its own purchase', () => {
        const { module, session } = holdings()
        const marketShare = {
            companyId: TestCompanyId,
            kind: 'share',
            owner: bank,
            poolId: 'market'
        } as const
        session.state.certificates.push(
            { ...marketShare, id: 'double', shares: 2 },
            { ...marketShare, id: 'numbered', shares: 1, number: 4 }
        )
        expect(
            module
                .companyTrades(TestCompanyId)
                .offers.map(({ certificate }) => [
                    certificate.poolId,
                    certificate.shares,
                    certificate.number
                ])
        ).toEqual([
            ['market', 1, undefined],
            ['ipo', 1, undefined],
            ['market', 2, undefined],
            ['market', 1, 4]
        ])
    })

    it('offers each sale size for each seller', () => {
        const { module } = holdings()
        const { sales } = module.companyTrades(TestCompanyId)
        expect(
            sales.map((group) => ({
                seller: group.seller,
                sales: group.sales.map((sale) => [sale.shares, sale.proceeds])
            }))
        ).toEqual([
            {
                seller: player,
                sales: [
                    [1, 90],
                    [2, 180],
                    [3, 270],
                    [4, 360]
                ]
            }
        ])
    })

    it('offers nothing for another company or while the player cannot act', () => {
        expect(holdings().module.companyTrades('U')).toEqual({
            buyers: [],
            offers: [],
            sales: []
        })
        expect(
            holdings(undefined, { interactive: false }).module.companyTrades(TestCompanyId)
        ).toEqual({ buyers: [], offers: [], sales: [] })
    })

    it('buys and sells with one press each', async () => {
        const { module, applied } = holdings()
        const { offers, sales } = module.companyTrades(TestCompanyId)
        await module.buy(offers[1].purchases[1].request)
        expect(applied[0]).toMatchObject({
            type: 'BuyShares',
            buyer: unionBank,
            expectedPrice: 100
        })
        await module.sell(sales[0].sales[1].request)
        expect(applied[1]).toMatchObject({
            type: 'SellShares',
            seller: player,
            sales: [{ companyId: TestCompanyId, shares: 2 }],
            expectedProceeds: 180
        })
    })
})
