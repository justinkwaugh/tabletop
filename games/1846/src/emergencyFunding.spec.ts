import { Market1846 } from './stock.js'
import { describe, expect, it } from 'vitest'
import { ActionSource, assert, assertExists } from '@tabletop/common'
import {
    finiteCashOwnedBy,
    getCompany,
    placeStockMarker,
    sharesOwned,
    trainsOwnedBy,
    sameOwner,
    type Owner
} from '@tabletop/18xx'
import { emergencyBuyingGame } from './testSupport.js'
import { emergencyFundingStart, emergencyTrainChoices } from './emergencyTrain.js'
import { emergencyShareSaleChoices, evaluateEmergencyShareSale } from './emergencyFunding.js'

type Table = ReturnType<typeof emergencyBuyingGame>
const treasury = { kind: 'company', companyId: 'IC' } as const
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
                !certificate.retired &&
                certificate.kind === 'share' &&
                !certificate.president &&
                certificate.companyId === companyId &&
                certificate.owner.kind === 'company'
        )
        .slice(0, shares)
    expect(certificates).toHaveLength(shares)
    for (const certificate of certificates) {
        assert(!certificate.retired)
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
        (entry) =>
            !entry.retired &&
            entry.kind === 'share' &&
            entry.companyId === companyId &&
            entry.president
    )
    assert(certificate && !certificate.retired)
    certificate.owner = { kind: 'player', playerId: presidentId }
    delete certificate.poolId
    setPrice(table, companyId, price)
    table.state.operatingSet?.companyOrder.push(companyId)
}
function fundingGame(price = 40, cash = 0) {
    const table = emergencyBuyingGame(0, price)
    const playerId = table.state.activePlayerIds[0]
    setCash(table, { kind: 'player', playerId }, cash)
    return { table, playerId, owner: { kind: 'player' as const, playerId } }
}
function startFunding(table: Table) {
    return table.act('StartEmergencyFunding', { companyId: 'IC' })
}
function sell(table: Table, companyId: string, shares: number) {
    const details = evaluateEmergencyShareSale(table.hydrated, { companyId, shares }).details
    assertExists(details)
    return table.act('SellEmergencyShares', {
        companyId,
        shares,
        expectedProceeds: details.proceeds
    })
}
function buy(table: Table, definitionId = '2') {
    const choice = emergencyTrainChoices(table.hydrated).find(
        (choice) => choice.definitionId === definitionId
    )
    assertExists(choice)
    return table.act('EmergencyBuyTrain', choice)
}
function phaseII(table: Table) {
    for (const train of table.state.trainInventory.trains)
        if (train.status === 'depot' && train.definitionId === '2') train.status = 'removed'
}

describe('1846 personal emergency train funding', () => {
    it('issues first, sells a block, contributes only the shortfall, and replays and undoes the entire flow', () => {
        const { table, playerId, owner } = fundingGame()
        launchOther(table)
        giveShares(table, 'NYC', playerId, 2)
        const before = structuredClone(table.state)
        const startIndex = table.actions.length
        const start = startFunding(table)
        expect(start.processedActions[0].metadata).toMatchObject({
            certificateIds: [expect.any(String), expect.any(String)]
        })
        expect(table.state.machineState).toBe('FundingTrain')
        expect(Market1846.companySpace(table.state.stockMarket, 'IC').price).toBe(20)
        expect(finiteCashOwnedBy(table.state, treasury)).toBe(20)
        expect(finiteCashOwnedBy(table.state, owner)).toBe(0)
        sell(table, 'NYC', 2)
        expect(Market1846.companySpace(table.state.stockMarket, 'NYC').price).toBe(40)
        expect(table.state.emergencyFunding).toEqual({
            companyId: 'IC',
            minimumPrice: 61,
            soldCompanyIds: ['NYC']
        })
        expect(emergencyShareSaleChoices(table.hydrated)).toEqual([])
        buy(table)
        expect(table.state.emergencyFunding).toBeUndefined()
        expect(table.state.machineState).toBe('BuyingTrains')
        expect(finiteCashOwnedBy(table.state, treasury)).toBe(0)
        expect(finiteCashOwnedBy(table.state, owner)).toBe(20)
        expect(trainsOwnedBy(table.state, treasury)).toHaveLength(1)
        let replay = before
        const actions = table.actions.slice(startIndex)
        for (const action of actions)
            replay = table.engine.applyProcessedAction({ game: table.game, state: replay, action })
        expect(replay).toEqual(table.state)
        for (const action of actions.toReversed())
            replay = table.engine.undoProcessedAction({ state: replay, action })
        expect(replay).toEqual(before)
        table.act('FinishOperatingTurn', { companyId: 'IC' })
    })
    it('cannot bypass issuance, repeat it, finish, trade, construct, or forge an emergency sale', () => {
        const { table, playerId } = fundingGame()
        launchOther(table)
        giveShares(table, 'NYC', playerId, 2)
        const sale = { companyId: 'NYC', shares: 1, expectedProceeds: 40 }
        expect(() => table.act('SellEmergencyShares', sale)).toThrow()
        for (const fields of [
            { companyId: 'NYC' },
            { companyId: 'IC', playerId: 'p2' },
            { companyId: 'IC', source: ActionSource.System }
        ])
            expect(() => table.act('StartEmergencyFunding', fields)).toThrow()
        startFunding(table)
        const before = structuredClone(table.state)
        expect(() => startFunding(table)).toThrow()
        expect(() => table.act('FinishOperatingTurn', { companyId: 'IC' })).toThrow()
        expect(() => table.act('FinishTrack', { companyId: 'IC' })).toThrow()
        for (const fields of [
            { playerId: 'p2' },
            { source: ActionSource.System },
            { expectedProceeds: 1 },
            { shares: 3 },
            { companyId: 'MS' }
        ])
            expect(() => table.act('SellEmergencyShares', { ...sale, ...fields })).toThrow()
        expect(table.state).toEqual(before)
    })
    it('enforces a single block per corporation and forbids overselling', () => {
        const { table, playerId } = fundingGame()
        launchOther(table)
        giveShares(table, 'NYC', playerId, 3)
        startFunding(table)
        expect(
            evaluateEmergencyShareSale(table.hydrated, { companyId: 'NYC', shares: 3 }).reason
        ).toContain('more shares')
        sell(table, 'NYC', 1)
        expect(
            evaluateEmergencyShareSale(table.hydrated, { companyId: 'NYC', shares: 1 }).reason
        ).toContain('single block')
        expect(emergencyTrainChoices(table.hydrated)).toEqual([])
    })
    it('blocks a non-president sale before operation and enforces the market’s 50% limit', () => {
        const { table, playerId } = fundingGame(20)
        launchOther(table)
        giveShares(table, 'NYC', playerId, 2)
        getCompany(table.state, 'NYC').operated = false
        startFunding(table)
        expect(
            evaluateEmergencyShareSale(table.hydrated, { companyId: 'NYC', shares: 1 }).reason
        ).toContain('before')
        getCompany(table.state, 'NYC').operated = true
        for (const certificate of table.state.certificates
            .filter(
                (entry) =>
                    !entry.retired && entry.companyId === 'NYC' && entry.owner.kind === 'company'
            )
            .slice(0, 4)) {
            assert(!certificate.retired)
            certificate.owner = { kind: 'bank' }
            certificate.poolId = 'open-market'
        }
        expect(
            evaluateEmergencyShareSale(table.hydrated, { companyId: 'NYC', shares: 2 }).reason
        ).toContain('Market')
        expect(
            evaluateEmergencyShareSale(table.hydrated, { companyId: 'NYC', shares: 1 }).details
        ).toBeDefined()
    })
    it('protects the operating presidency but permits a sale that retains it', () => {
        const { table, playerId } = fundingGame(20)
        giveShares(table, 'IC', playerId, 1)
        giveShares(table, 'IC', 'p2', 2)
        startFunding(table)
        expect(
            evaluateEmergencyShareSale(table.hydrated, { companyId: 'IC', shares: 2 }).reason
        ).toContain('keep its president')
        sell(table, 'IC', 1)
        expect(getCompany(table.state, 'IC').president).toEqual({ kind: 'player', playerId })
        expect(Market1846.companySpace(table.state.stockMarket, 'IC').price).toBe(10)
        expect(sharesOwned(table.state, 'IC', { kind: 'bank' })).toBe(1)
    })
    it('never closes the operating corporation through personal sales', () => {
        const { table, playerId } = fundingGame(10)
        giveShares(table, 'IC', playerId, 1)
        startFunding(table)
        expect(
            evaluateEmergencyShareSale(table.hydrated, { companyId: 'IC', shares: 1 }).reason
        ).toContain('remain open')
    })
    it('allows another presidency to change and reorders only pending companies', () => {
        const { table, playerId } = fundingGame(20)
        launchOther(table, 'NYC', 40, playerId)
        giveShares(table, 'NYC', 'p2', 2)
        launchOther(table, 'B&O', 40, 'p3')
        assertExists(table.state.operatingSet)
        table.state.operatingSet.number = 2
        startFunding(table)
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
        startFunding(table)
        const beforeClosure = structuredClone(table.state)
        const result = sell(table, 'NYC', 1)
        expect(result.processedActions.map((action) => action.type)).toEqual([
            'SellEmergencyShares',
            'CloseCorporation'
        ])
        expect(getCompany(table.state, 'NYC').closed).toBe(true)
        let replay = beforeClosure
        for (const action of result.processedActions)
            replay = table.engine.applyProcessedAction({ game: table.game, state: replay, action })
        expect(replay).toEqual(table.state)
        for (const action of result.processedActions.toReversed())
            replay = table.engine.undoProcessedAction({ state: replay, action })
        expect(replay).toEqual(beforeClosure)
        expect(table.state.machineState).toBe('FundingTrain')
        expect(table.state.activePlayerIds).toEqual([playerId])
        expect(table.state.operatingSet?.completedCompanyIds).not.toContain('IC')
        sell(table, 'B&O', 1)
        buy(table)
        expect(table.state.operatingSet?.companyOrder).not.toContain('NYC')
    })
    it('permits extra funding for the dearer variant but prevents switching to the cheaper train after excess sales', () => {
        const { table, playerId } = fundingGame(20, 130)
        phaseII(table)
        launchOther(table, 'NYC', 40)
        giveShares(table, 'NYC', playerId, 2)
        startFunding(table)
        sell(table, 'NYC', 2)
        expect(table.state.emergencyFunding?.minimumPrice).toBe(171)
        expect(emergencyTrainChoices(table.hydrated).map((choice) => choice.definitionId)).toEqual([
            '4'
        ])
        const result = buy(table, '4')
        expect(result.processedActions.map((action) => action.type)).toContain('AdvancePhase')
        expect(table.state.machineState).toBe('BuyingTrains')
        expect(table.state.phaseId).toBe('II')
        table.act('FinishOperatingTurn', { companyId: 'IC' })
    })
    it('allows either variant when the same sale is necessary for both', () => {
        const { table, playerId } = fundingGame(20, 140)
        phaseII(table)
        launchOther(table, 'NYC', 40)
        giveShares(table, 'NYC', playerId, 1)
        startFunding(table)
        sell(table, 'NYC', 1)
        expect(
            emergencyTrainChoices(table.hydrated)
                .map((choice) => choice.definitionId)
                .sort()
        ).toEqual(['3/5', '4'])
    })
    it('does not start personal sales when corporate funding can cover the cheaper train', () => {
        const { table } = fundingGame(40)
        phaseII(table)
        setCash(table, treasury, 140)
        expect(emergencyFundingStart(table.hydrated)).toBeUndefined()
        expect(() => startFunding(table)).toThrow()
    })
})
