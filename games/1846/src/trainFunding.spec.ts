import { Market1846 } from './stock.js'
import { describe, expect, it } from 'vitest'
import { ActionSource, assert, assertExists, type GameAction } from '@tabletop/common'
import {
    finiteCashOwnedBy,
    getCompany,
    placeStockMarker,
    sameOwner,
    sharesOwned,
    trainsOwnedBy,
    type Owner
} from '@tabletop/18xx'
import {
    emergencyBuyingGame as buyingGame,
    fundablePurchases,
    fundTrain,
    fundingModel,
    resolveFunding
} from './testSupport.js'

type Table = ReturnType<typeof buyingGame>
const treasury = { kind: 'company' as const, companyId: 'IC' }

function phaseII(table: Table) {
    table.state.trainInventory.trains = table.state.trainInventory.trains.filter(
        (train) => !(train.status === 'depot' && train.definitionId === '2')
    )
}
function president(table: Table): Owner {
    return { kind: 'player', playerId: table.state.activePlayerIds[0] }
}
function setCash(table: Table, owner: Owner, amount: number) {
    const balance = table.state.cash.find((entry) => sameOwner(entry.owner, owner))
    assertExists(balance)
    balance.amount = amount
}
function setPrice(table: Table, companyId: string, price: number) {
    const space = Market1846.spaces.find((entry) => entry.price === price)
    assertExists(space)
    placeStockMarker(table.state.stockMarket, companyId, space.id)
}
function giveShares(table: Table, companyId: string, playerId: string, shares: number) {
    const certificates = table.state.certificates
        .filter(
            (certificate) =>
                certificate.kind === 'share' &&
                !certificate.president &&
                certificate.companyId === companyId &&
                certificate.owner.kind === 'company'
        )
        .slice(0, shares)
    expect(certificates).toHaveLength(shares)
    for (const certificate of certificates) {
        certificate.owner = { kind: 'player', playerId }
        delete certificate.poolId
    }
}
function launchOther(table: Table, companyId = 'NYC', price = 40, presidentId = 'p2') {
    const company = getCompany(table.state, companyId)
    Object.assign(company, {
        started: true,
        floated: true,
        funded: true,
        operated: true,
        president: { kind: 'player', playerId: presidentId },
        parPrice: price
    })
    const certificate = table.state.certificates.find(
        (entry) => entry.kind === 'share' && entry.companyId === companyId && entry.president
    )
    assert(certificate)
    certificate.owner = { kind: 'player', playerId: presidentId }
    delete certificate.poolId
    setPrice(table, companyId, price)
    table.state.operatingSet?.companyOrder.push(companyId)
}
function fundingGame(price = 40, cash = 0) {
    const table = buyingGame(0, price)
    const playerId = table.state.activePlayerIds[0]
    setCash(table, { kind: 'player', playerId }, cash)
    return { table, playerId, owner: { kind: 'player' as const, playerId } }
}
function next(table: Table) {
    return fundingModel(table).next()
}
function sales(table: Table) {
    const choice = next(table)
    return choice.kind === 'sell' ? choice.sales : []
}
function sell(table: Table, companyId: string, shares: number) {
    const sale = sales(table).find(
        (sale) => sale.sales[0].companyId === companyId && sale.sales[0].shares === shares
    )
    assertExists(sale, `A ${shares}-share sale of ${companyId} is offered`)
    return table.act('SellFundingShares', {
        seller: sale.seller,
        companyId,
        shares,
        expectedProceeds: sale.proceeds
    })
}
function replaysAndUndoes(table: Table, before: Table['state'], actions: readonly GameAction[]) {
    let replay = before
    for (const action of actions)
        replay = table.engine.applyProcessedAction({ game: table.game, state: replay, action })
    expect(replay).toEqual(table.state)
    for (const action of actions.toReversed())
        replay = table.engine.undoProcessedAction({ state: replay, action })
    expect(replay).toEqual(before)
}

describe('1846 emergency train funding', () => {
    it('issues only enough stock, selling one price below the shifted marker, then buys', () => {
        const table = buyingGame()
        const before = structuredClone(table.state)
        const start = table.actions.length
        fundTrain(table)
        expect(next(table)).toMatchObject({ kind: 'issue', details: { proceeds: 80 } })
        resolveFunding(table)
        expect(Market1846.companySpace(table.state.stockMarket, 'IC').price).toBe(90)
        expect(finiteCashOwnedBy(table.state, treasury)).toBe(10)
        expect(sharesOwned(table.state, 'IC', { kind: 'bank' })).toBe(1)
        expect(trainsOwnedBy(table.state, treasury)).toHaveLength(1)
        replaysAndUndoes(table, before, table.actions.slice(start))
    })
    it('issues every share before the president pays only the shortfall', () => {
        const table = buyingGame(0, 40)
        const owner = president(table)
        const cash = finiteCashOwnedBy(table.state, owner)
        fundTrain(table)
        expect(next(table)).toMatchObject({ kind: 'issue', details: { proceeds: 20 } })
        table.act('IssueTreasuryShares', { expectedProceeds: 20 })
        expect(Market1846.companySpace(table.state.stockMarket, 'IC').price).toBe(20)
        expect(next(table)).toMatchObject({ kind: 'contribute', amount: 60 })
        table.act('ContributeTrainFunds', { owner, amount: 60 })
        expect(finiteCashOwnedBy(table.state, owner)).toBe(cash - 60)
        expect(finiteCashOwnedBy(table.state, treasury)).toBe(80)
        expect(next(table)).toMatchObject({ kind: 'buy' })
    })
    it('cannot issue below $20; proceeds can be $10 a share', () => {
        const table = buyingGame(0, 30)
        fundTrain(table)
        expect(next(table)).toMatchObject({ kind: 'issue', details: { proceeds: 10 } })
        const floor = buyingGame(0, 20)
        fundTrain(floor)
        expect(next(floor)).toMatchObject({ kind: 'contribute', amount: 80 })
    })
    it('deducts market shares from the issuance limit', () => {
        const table = buyingGame(0, 40)
        const certificate = table.state.certificates.find(
            (c) => c.companyId === 'IC' && c.owner.kind === 'company'
        )
        assertExists(certificate)
        certificate.owner = { kind: 'bank' }
        certificate.poolId = 'open-market'
        fundTrain(table)
        expect(next(table)).toMatchObject({ kind: 'issue', details: { proceeds: 20 } })
        table.act('IssueTreasuryShares', { expectedProceeds: 20 })
        expect(next(table)).toMatchObject({ kind: 'contribute', amount: 60 })
    })
    it('offers the dearer variant with issuance, never president cash, while a cheaper train is affordable', () => {
        const table = buyingGame(160, 20)
        phaseII(table)
        expect(fundablePurchases(table)).toEqual([])
        setPrice(table, 'IC', 40)
        expect(fundablePurchases(table).map((purchase) => purchase.definitionId)).toEqual(['4'])
        const [purchase] = fundablePurchases(table)
        expect(fundingModel(table).preview(purchase)).toMatchObject({
            treasuryProceeds: 20,
            contributions: []
        })
    })
    it('also forbids president cash when issuing stock can cover the cheaper variant', () => {
        const table = buyingGame(140, 40)
        phaseII(table)
        expect(fundablePurchases(table).map((purchase) => purchase.definitionId)).toEqual(['3/5'])
    })
    it('permits either variant once a president contribution is necessary and advances phase', () => {
        const table = buyingGame(0, 20)
        phaseII(table)
        expect(
            fundablePurchases(table)
                .map((purchase) => purchase.definitionId)
                .sort()
        ).toEqual(['3/5', '4'])
        fundTrain(table, '4')
        const result = resolveFunding(table)
        assertExists(result)
        expect(result.processedActions.map((action) => action.type)).toContain('AdvancePhase')
        expect(result.processedActions).toContainEqual(
            expect.objectContaining({ type: 'FinishOperatingTurn', source: ActionSource.System })
        )
        expect(table.state.phaseId).toBe('II')
    })
    it('keeps the obligation when the president cannot pay', () => {
        const table = buyingGame(0, 20)
        setCash(table, president(table), 79)
        expect(fundablePurchases(table)).toHaveLength(1)
        expect(() => table.act('FinishOperatingTurn', { companyId: 'IC' })).toThrow()
    })
    it('rejects forged funding requests and a second funding', () => {
        const table = buyingGame()
        const [purchase] = fundablePurchases(table)
        const { price, ...request } = purchase
        for (const fields of [
            { expectedPrice: 1 },
            { companyId: 'MS' },
            { playerId: 'p2' },
            { source: ActionSource.System },
            { exchangeTrainId: 'MS:2' }
        ])
            expect(() =>
                table.act('FundTrain', { ...request, expectedPrice: price, ...fields })
            ).toThrow()
        fundTrain(table)
        expect(() => fundTrain(table)).toThrow()
    })
})

describe('1846 personal share sales for a train', () => {
    it('issues first, sells a block, contributes only the shortfall, and replays and undoes the entire flow', () => {
        const { table, playerId, owner } = fundingGame()
        launchOther(table)
        giveShares(table, 'NYC', playerId, 2)
        const before = structuredClone(table.state)
        const start = table.actions.length
        fundTrain(table)
        expect(next(table)).toMatchObject({ kind: 'issue', details: { proceeds: 20 } })
        table.act('IssueTreasuryShares', { expectedProceeds: 20 })
        expect(finiteCashOwnedBy(table.state, treasury)).toBe(20)
        expect(sales(table).map((sale) => [sale.sales[0].shares, sale.proceeds])).toEqual([
            [1, 40],
            [2, 80]
        ])
        sell(table, 'NYC', 2)
        expect(Market1846.companySpace(table.state.stockMarket, 'NYC').price).toBe(40)
        expect(next(table)).toMatchObject({ kind: 'contribute', amount: 60 })
        table.act('ContributeTrainFunds', { owner, amount: 60 })
        expect(finiteCashOwnedBy(table.state, owner)).toBe(20)
        expect(finiteCashOwnedBy(table.state, treasury)).toBe(80)
        const bought = resolveFunding(table)
        assertExists(bought)
        expect(bought.processedActions).toContainEqual(
            expect.objectContaining({ type: 'FinishOperatingTurn', source: ActionSource.System })
        )
        expect(trainsOwnedBy(table.state, treasury)).toHaveLength(1)
        replaysAndUndoes(table, before, table.actions.slice(start))
    })
    it('cannot sell before issuing, repeat issuance, finish, build, or forge a sale', () => {
        const { table, playerId } = fundingGame()
        launchOther(table)
        giveShares(table, 'NYC', playerId, 2)
        fundTrain(table)
        const sale = { seller: { kind: 'player', playerId }, companyId: 'NYC', shares: 1 }
        expect(() => table.act('SellFundingShares', { ...sale, expectedProceeds: 40 })).toThrow()
        table.act('IssueTreasuryShares', { expectedProceeds: 20 })
        const before = structuredClone(table.state)
        expect(() => table.act('IssueTreasuryShares', { expectedProceeds: 20 })).toThrow()
        expect(() => table.act('FinishOperatingTurn', { companyId: 'IC' })).toThrow()
        expect(() => table.act('FinishTrack', { companyId: 'IC' })).toThrow()
        for (const fields of [
            { playerId: 'p2' },
            { source: ActionSource.System },
            { expectedProceeds: 1 },
            { shares: 3 },
            { companyId: 'MS' }
        ])
            expect(() =>
                table.act('SellFundingShares', { ...sale, expectedProceeds: 40, ...fields })
            ).toThrow()
        expect(table.state).toEqual(before)
    })
    it('sells each corporation in one block and never more than the shortfall needs', () => {
        const { table, playerId } = fundingGame()
        launchOther(table)
        giveShares(table, 'NYC', playerId, 3)
        fundTrain(table)
        table.act('IssueTreasuryShares', { expectedProceeds: 20 })
        expect(sales(table).map((sale) => sale.sales[0].shares)).toEqual([1, 2])
        sell(table, 'NYC', 1)
        expect(sales(table)).toEqual([])
        expect(next(table)).toMatchObject({ kind: 'contribute', amount: 40 })
        const result = resolveFunding(table)
        expect(result?.processedActions.map((action) => action.type)).toContain('DeclareBankruptcy')
    })
    it('blocks a non-president sale before operation and enforces the market’s 50% limit', () => {
        const { table, playerId } = fundingGame(20)
        launchOther(table)
        giveShares(table, 'NYC', playerId, 2)
        getCompany(table.state, 'NYC').operated = false
        const [purchase] = fundablePurchases(table)
        expect(fundingModel(table).preview(purchase).choice).toMatchObject({ kind: 'bankrupt' })
        getCompany(table.state, 'NYC').operated = true
        for (const certificate of table.state.certificates
            .filter((entry) => entry.companyId === 'NYC' && entry.owner.kind === 'company')
            .slice(0, 4)) {
            certificate.owner = { kind: 'bank' }
            certificate.poolId = 'open-market'
        }
        const choice = fundingModel(table).preview(purchase).choice
        assert(choice.kind === 'sell', 'The president may sell within the market limit')
        expect(choice.sales.map((sale) => sale.sales[0].shares)).toEqual([1])
    })
    it('protects the operating presidency but permits a sale that retains it', () => {
        const { table, playerId } = fundingGame(20)
        giveShares(table, 'IC', playerId, 1)
        giveShares(table, 'IC', 'p2', 2)
        fundTrain(table)
        expect(sales(table).map((sale) => [sale.sales[0].companyId, sale.sales[0].shares])).toEqual(
            [['IC', 1]]
        )
        sell(table, 'IC', 1)
        expect(getCompany(table.state, 'IC').president).toEqual({ kind: 'player', playerId })
        expect(Market1846.companySpace(table.state.stockMarket, 'IC').price).toBe(10)
        expect(sharesOwned(table.state, 'IC', { kind: 'bank' })).toBe(1)
    })
    it('never closes the operating corporation through personal sales', () => {
        const { table, playerId } = fundingGame(10)
        giveShares(table, 'IC', playerId, 1)
        const [purchase] = fundablePurchases(table)
        expect(fundingModel(table).preview(purchase).choice).toMatchObject({ kind: 'bankrupt' })
    })
    it('allows another presidency to change and reorders only pending companies', () => {
        const { table, playerId } = fundingGame(20)
        launchOther(table, 'NYC', 40, playerId)
        giveShares(table, 'NYC', 'p2', 2)
        launchOther(table, 'B&O', 40, 'p3')
        assertExists(table.state.operatingSet)
        table.state.operatingSet.number = 2
        fundTrain(table)
        sell(table, 'NYC', 1)
        expect(getCompany(table.state, 'NYC').president).toEqual({ kind: 'player', playerId: 'p2' })
        expect(Market1846.companySpace(table.state.stockMarket, 'NYC').price).toBe(30)
        expect(table.state.operatingSet.companyOrder).toEqual(['MS', 'BIG4', 'IC', 'B&O', 'NYC'])
    })
    it('closes another corporation without ending the operating company’s turn, then continues funding', () => {
        const { table, playerId } = fundingGame(20)
        launchOther(table, 'NYC', 10, playerId)
        giveShares(table, 'NYC', playerId, 1)
        launchOther(table, 'B&O', 100, 'p2')
        giveShares(table, 'B&O', playerId, 1)
        fundTrain(table)
        const beforeClosure = structuredClone(table.state)
        const result = sell(table, 'NYC', 1)
        expect(result.processedActions.map((action) => action.type)).toEqual([
            'SellFundingShares',
            'CloseCorporation'
        ])
        expect(getCompany(table.state, 'NYC').closed).toBe(true)
        replaysAndUndoes(table, beforeClosure, result.processedActions)
        expect(table.state.machineState).toBe('FundingTrain')
        expect(table.state.activePlayerIds).toEqual([playerId])
        expect(table.state.operatingSet?.completedCompanyIds).not.toContain('IC')
        sell(table, 'B&O', 1)
        resolveFunding(table)
        expect(table.state.operatingSet?.companyOrder).not.toContain('NYC')
    })
    it('funds the dearer variant chosen up front, selling no more than it needs', () => {
        const { table, playerId } = fundingGame(20, 130)
        phaseII(table)
        launchOther(table, 'NYC', 40)
        giveShares(table, 'NYC', playerId, 2)
        fundTrain(table, '4')
        expect(sales(table).map((sale) => [sale.sales[0].shares, sale.proceeds])).toEqual([
            [1, 40],
            [2, 80]
        ])
        sell(table, 'NYC', 2)
        expect(sales(table)).toEqual([])
        const result = resolveFunding(table)
        assertExists(result)
        expect(result.processedActions.map((action) => action.type)).toContain('AdvancePhase')
        expect(table.state.phaseId).toBe('II')
        expect(trainsOwnedBy(table.state, treasury).map((train) => train.definitionId)).toEqual([
            '4'
        ])
    })
    it('offers either variant when the same sale is necessary for both', () => {
        const { table, playerId } = fundingGame(20, 140)
        phaseII(table)
        launchOther(table, 'NYC', 40)
        giveShares(table, 'NYC', playerId, 1)
        expect(
            fundablePurchases(table)
                .map((purchase) => purchase.definitionId)
                .sort()
        ).toEqual(['3/5', '4'])
    })
    it('does not start personal sales when corporate funding can cover the cheaper train', () => {
        const { table } = fundingGame(40)
        phaseII(table)
        setCash(table, treasury, 140)
        expect(fundablePurchases(table).map((purchase) => purchase.definitionId)).toEqual(['3/5'])
        fundTrain(table)
        expect(next(table)).toMatchObject({ kind: 'issue' })
        resolveFunding(table)
        expect(trainsOwnedBy(table.state, treasury)).toHaveLength(1)
    })
})
