import { historyCompanyChanges } from '../../../../libs/18xx-ui/src/lib/table/historyCompanyChanges.js'
import { historyDescription } from '../../../../libs/18xx-ui/src/lib/table/historyDescription.js'
import { expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import {
    cashOwnedBy,
    getCompany,
    sharesOwned,
    companyMarketSpace,
    placeStockMarker,
    evaluateCompanyStart,
    evaluateCompanyFlotation,
    evaluateSharePurchase,
    exceedsStockLimits,
    isFloatCompany,
    isStartCompany,
    createOrdinaryShareCertificates,
    type StartCompany,
    type FinanceExampleState,
    type Owner,
    type FloatCompany
} from '@tabletop/18xx'
import {
    Definition as Top,
    TheOldPrinceStockRules,
    TheOldPrinceCompanyRules,
    availableTheOldPrinceTranche,
    peirShares,
    TheOldPrinceTrainDepot
} from '@tabletop/the-old-prince'
import {
    Definition as Shikoku,
    Shikoku1889StockRules,
    Shikoku1889CompanyRules
} from '@tabletop/shikoku-1889'
import { example, purchase } from './stockTestUtils.js'
const alex = { kind: 'player', playerId: 'alex' } as const
const blair = { kind: 'player', playerId: 'blair' } as const
const union = { kind: 'company', companyId: 'UB' } as const
function start(
    companyId: string,
    marketSpaceId: string,
    expectedPrice: number,
    buyer: Owner = alex
): StartCompany {
    return {
        id: 'start',
        gameId: 'purchase-example',
        type: 'StartCompany',
        source: ActionSource.User,
        playerId: 'alex',
        buyer,
        companyId,
        marketSpaceId,
        expectedPrice
    }
}
function give(state: FinanceExampleState, id: string, owner: Owner, poolId?: string) {
    const certificate = state.certificates.find((certificate) => certificate.id === id)
    if (!certificate || certificate.retired) throw new Error('Missing fixture certificate')
    certificate.owner = owner
    if (poolId) certificate.poolId = poolId
    else delete certificate.poolId
}
for (const [definition, companyId, marketSpaceId, parPrice] of [
    [Top, 'A', '3:1', 80],
    [Shikoku, 'SR', '5:3', 65]
] as const) {
    it(`starts ${definition.info.id} without prematurely funding or floating it`, () => {
        const { game, engine, state } = example(definition, 'starting')
        const before = structuredClone(state)
        const result = engine.executeCanonicalAction({
            game,
            state,
            action: start(companyId, marketSpaceId, parPrice * 2)
        })
        expect(state).toEqual(before)
        expect(result.processedActions.map((action) => action.type)).toEqual(
            definition === Top ? ['StartCompany', 'FinishStockTurn'] : ['StartCompany']
        )
        expect(getCompany(result.updatedState, companyId)).toMatchObject({
            started: true,
            funded: false,
            floated: false,
            operated: false,
            parPrice,
            president: alex
        })
        expect(cashOwnedBy(result.updatedState, alex)).toBe(240 - parPrice * 2)
        expect(cashOwnedBy(result.updatedState, { kind: 'company', companyId })).toBe(0)
        expect(sharesOwned(result.updatedState, companyId, alex)).toBe(2)
        expect(companyMarketSpace(result.updatedState.stockMarket, companyId).id).toBe(
            marketSpaceId
        )
        expect(
            result.updatedState.stations.find((station) => station.id === `${companyId}:home`)
                ?.status
        ).toBe('available')
        const action = result.processedActions[0]
        expect(isStartCompany(action)).toBe(true)
        let replay = before
        for (const processed of result.processedActions)
            replay = engine.applyProcessedAction({ game, state: replay, action: processed })
        expect(replay).toEqual(result.updatedState)
        for (const processed of result.processedActions.toReversed())
            replay = engine.undoProcessedAction({ state: replay, action: processed })
        expect(replay).toEqual(before)
        expect(() =>
            engine.executeCanonicalAction({
                game,
                state: result.updatedState,
                action: purchase(`${companyId}:share:1`, parPrice)
            })
        ).toThrow()
    })
    it(`floats ${definition.info.id} through a recorded system action, with exact replay and Undo`, () => {
        const { game, engine, state } = example(definition, 'flotation')
        const before = structuredClone(state)
        const certificateId = definition === Top ? 'A:share:4' : 'SR:share:3'
        const result = engine.executeCanonicalAction({
            game,
            state,
            action: purchase(certificateId, parPrice)
        })
        expect(state).toEqual(before)
        expect(result.processedActions.map((action) => action.type)).toEqual([
            'BuyShares',
            'FloatCompany',
            ...(definition === Top ? ['FinishStockTurn'] : [])
        ])
        expect(getCompany(result.updatedState, companyId)).toMatchObject({
            funded: true,
            floated: true,
            operated: false
        })
        expect(cashOwnedBy(result.updatedState, { kind: 'company', companyId })).toBe(parPrice * 10)
        expect(cashOwnedBy(result.updatedState, alex)).toBe(240 - parPrice)
        const flotation = result.processedActions[1]
        expect(isFloatCompany(flotation)).toBe(true)
        expect(flotation.source).toBe(ActionSource.System)
        let replay = before
        for (const action of result.processedActions)
            replay = engine.applyProcessedAction({ game, state: replay, action })
        expect(replay).toEqual(result.updatedState)
        for (const action of [...result.processedActions].reverse())
            replay = engine.undoProcessedAction({ state: replay, action })
        expect(replay).toEqual(before)
        expect(
            definition.runtime.hydrator
                .hydrateState(JSON.parse(JSON.stringify(result.updatedState)))
                .dehydrate()
        ).toEqual(result.updatedState)
        if (definition === Shikoku) {
            expect(cashOwnedBy(result.updatedState, { kind: 'bank' })).toBe(6120 + 65 - 650)
            expect(result.updatedState.stationReservations).toContainEqual({
                companyId: 'SR',
                locationId: 'I2',
                nodeId: 'city'
            })
            expect(
                result.updatedState.stations.find((station) => station.id === 'SR:home')?.status
            ).toBe('available')
        } else {
            expect(
                result.updatedState.certificates.find(
                    (certificate) => certificate.id === 'PEIR:share:2'
                )
            ).toMatchObject({ retired: true })
            expect(sharesOwned(result.updatedState, 'A', alex)).toBe(5)
            expect(peirShares(result.updatedState)).toHaveLength(4)
            expect(
                result.updatedState.stations.find((station) => station.id === 'PEIR:A')?.status
            ).toBe('removed')
            expect(
                result.updatedState.stations.find((station) => station.id === 'A:home')
            ).toMatchObject({
                status: 'placed',
                position: { locationId: 'D6', nodeId: 'city', slot: 0 }
            })
        }
        const repeated = engine.executeCanonicalAction.bind(engine, {
            game,
            state: result.updatedState,
            action: { ...flotation, id: 'duplicate' }
        })
        expect(repeated).toThrow()
    })
}
it('starts a company for Union Bank using its cash before its owner’s contribution', () => {
    const { game, engine, state } = example(Top, 'starting')
    const result = engine.executeCanonicalAction({
        game,
        state,
        action: start('A', '3:1', 160, union)
    })
    expect(cashOwnedBy(result.updatedState, union)).toBe(0)
    expect(cashOwnedBy(result.updatedState, alex)).toBe(120)
    expect(getCompany(result.updatedState, 'A').president).toEqual(union)
    expect(result.updatedState.stockRound.companyPurchases).toEqual(['UB'])
    expect(result.updatedState.tranches[1].companyIds).toEqual(['A'])
})
it('rejects invalid starts without mutation', () => {
    const { game, engine, state } = example(Top, 'starting')
    const before = structuredClone(state)
    for (const action of [
        start('ML', '3:1', 160),
        start('PEIR', '3:1', 160),
        start('A', '1:1', 184),
        start('A', '3:1', 1),
        start('A', 'missing', 160),
        { ...start('A', '3:1', 160), playerId: 'blair' },
        { ...start('A', '3:1', 160), source: ActionSource.System },
        start('A', '3:1', 160, { kind: 'bank' })
    ])
        expect(() => engine.executeCanonicalAction({ game, state, action })).toThrow()
    expect(state).toEqual(before)
    give(state, 'PEIR:share:2', { kind: 'bank' })
    expect(
        evaluateCompanyStart(
            state,
            start('A', '3:1', 160),
            TheOldPrinceStockRules,
            TheOldPrinceCompanyRules
        ).reason
    ).toContain('owned by a player')
})
it('applies TOP phase prices and tranche completion independently of flotation', () => {
    const { state } = example(Top, 'starting')
    for (const [phase, expected] of [
        ['3H', [80, 74, 65, 58]],
        ['5H', [74, 65, 58]],
        ['3+', [65, 58]],
        ['7', [58]]
    ] as const) {
        state.phaseId = phase
        expect(
            TheOldPrinceCompanyRules.startMarketSpaces(state, 'A').map(
                (id) => state.stockMarket.spaces.find((space) => space.id === id)!.price
            )
        ).toEqual(expected)
    }
    state.tranches[1].companyIds.push('A')
    getCompany(state, 'A').started = true
    getCompany(state, 'A').floated = true
    expect(availableTheOldPrinceTranche(state)).toBeUndefined()
    getCompany(state, 'A').operated = true
    expect(availableTheOldPrinceTranche(state)?.id).toBe('2')
    getCompany(state, 'A').operated = false
    for (const certificate of state.certificates)
        if (!certificate.retired && certificate.companyId === 'A') {
            certificate.owner = alex
            delete certificate.poolId
        }
    expect(availableTheOldPrinceTranche(state)?.id).toBe('2')
})
it('counts 1889 Market stock toward flotation and TOP reserved stock separately from Bank stock', () => {
    const shikoku = example(Shikoku, 'flotation').state
    give(shikoku, 'SR:share:3', { kind: 'bank' }, 'open-market')
    expect(
        evaluateCompanyFlotation(shikoku, 'SR', Shikoku1889CompanyRules)?.payments[0].amount
    ).toBe(650)
    const top = example(Top, 'flotation').state
    expect(evaluateCompanyFlotation(top, 'A', TheOldPrinceCompanyRules)).toBeUndefined()
    give(top, 'A:share:4', { kind: 'bank' }, 'reserved')
    expect(evaluateCompanyFlotation(top, 'A', TheOldPrinceCompanyRules)?.payments[0].amount).toBe(
        800
    )
})
it('preserves a forced PEIR ownership excess without allowing further ordinary purchases', () => {
    const { game, engine, state } = example(Top, 'flotation')
    give(state, 'A:share:2', alex)
    give(state, 'A:share:3', alex)
    const result = engine.executeCanonicalAction({ game, state, action: purchase('A:share:4', 80) })
    expect(sharesOwned(result.updatedState, 'A', alex)).toBe(7)
    expect(exceedsStockLimits(result.updatedState, alex, TheOldPrinceStockRules)).toBe(false)
    let nextTurn = result.updatedState
    for (let count = 0; count < 2; count++)
        nextTurn = engine.executeCanonicalAction({
            game,
            state: nextTurn,
            action: {
                id: `pass:${count}`,
                gameId: game.id,
                type: 'FinishStockTurn',
                source: ActionSource.User,
                playerId: nextTurn.activePlayerIds[0]
            }
        }).updatedState
    expect(nextTurn.activePlayerIds).toEqual(['alex'])
    expect(
        evaluateSharePurchase(
            nextTurn,
            { playerId: 'alex', buyer: alex, certificateId: 'A:share:6' },
            TheOldPrinceStockRules
        ).reason
    ).toContain('ownership limit')
})
it('floats an already funded branch without granting initial capital again', () => {
    const { game, engine, state } = example(Top)
    state.companies.push({
        id: 'CB',
        name: 'Cornwall Branch',
        kind: 'major',
        shareCount: 10,
        started: true,
        funded: true,
        floated: false,
        parPrice: 80,
        president: alex
    })
    const market = { owner: { kind: 'bank' } as const, poolId: 'market' }
    state.certificates.push(
        ...createOrdinaryShareCertificates(
            'CB',
            [
                { owner: alex },
                { owner: blair },
                { owner: { kind: 'player', playerId: 'casey' } },
                market,
                market,
                market,
                market,
                market
            ],
            alex
        )
    )
    state.cash.push({ owner: { kind: 'company', companyId: 'CB' }, amount: 560 })
    state.tranches[1].companyIds.push('CB')
    state.stations.push({
        id: 'CB:home',
        companyId: 'CB',
        status: 'placed',
        position: { locationId: 'D6', nodeId: 'city', slot: 0 }
    })
    placeStockMarker(state.stockMarket, 'CB', '3:1')
    const result = engine.executeCanonicalAction({
        game,
        state,
        action: purchase('CB:share:4', 80)
    })
    expect(getCompany(result.updatedState, 'CB').floated).toBe(true)
    expect(result.updatedState.stations).toEqual(state.stations)
    expect(cashOwnedBy(result.updatedState, { kind: 'company', companyId: 'CB' })).toBe(560)
    const action = result.processedActions[1]
    expect(isFloatCompany(action) && action.metadata?.payments).toEqual([])
})
it('closes PEIR and removes its cash and trains on its final exchange', () => {
    const { game, engine, state } = example(Top, 'flotation')
    state.certificates = state.certificates.map((certificate) => {
        if (
            certificate.retired ||
            certificate.companyId !== 'PEIR' ||
            certificate.id === 'PEIR:share:2'
        )
            return certificate
        const { owner: _owner, poolId: _poolId, ...interest } = certificate
        return { ...interest, retired: true }
    })
    state.stations = state.stations.map((station) =>
        station.companyId === 'PEIR' && station.id !== 'PEIR:A'
            ? { id: station.id, companyId: station.companyId, status: 'removed' }
            : station
    )
    const ownedTrainIds = ['3H', '7', 'D'].map((definitionId) => {
        const train = TheOldPrinceTrainDepot.nextTrain(state.trainInventory, definitionId)!
        TheOldPrinceTrainDepot.purchase(state.trainInventory, train.id, definitionId, {
            kind: 'company',
            companyId: 'PEIR'
        })
        return train.id
    })
    const result = engine.executeCanonicalAction({ game, state, action: purchase('A:share:4', 80) })
    for (const id of ownedTrainIds) {
        const train = result.updatedState.trainInventory.trains.find((train) => train.id === id)
        expect(train).toMatchObject({ status: 'removed' })
        expect(train).not.toHaveProperty('owner')
    }
    let replay = state
    for (const action of result.processedActions)
        replay = engine.applyProcessedAction({ game, state: replay, action })
    expect(replay).toEqual(result.updatedState)
    expect(peirShares(result.updatedState)).toHaveLength(0)
    expect(getCompany(result.updatedState, 'PEIR')).toMatchObject({ closed: true })
    expect(getCompany(result.updatedState, 'PEIR').president).toBeUndefined()
    expect(getCompany(result.updatedState, 'KM')).toMatchObject({ closed: true, privateRevenue: 0 })
    expect(cashOwnedBy(result.updatedState, { kind: 'company', companyId: 'PEIR' })).toBe(0)
    expect(
        result.updatedState.certificates.find((certificate) => certificate.id === 'KM:charter')
            ?.retired
    ).toBe(true)
    let undone = result.updatedState
    for (const action of [...result.processedActions].reverse())
        undone = engine.undoProcessedAction({ state: undone, action })
    expect(undone).toEqual(state)
})
it('rejects player-triggered flotation and refuses start costs above the buyer’s cash or limits', () => {
    const { game, engine, state } = example(Shikoku, 'starting')
    const float: FloatCompany = {
        id: 'float',
        gameId: game.id,
        type: 'FloatCompany',
        source: ActionSource.User,
        playerId: 'alex',
        companyId: 'SR'
    }
    expect(() => engine.executeCanonicalAction({ game, state, action: float })).toThrow()
    state.cash.find(
        (cash) => cash.owner.kind === 'player' && cash.owner.playerId === 'alex'
    )!.amount = 129
    expect(
        evaluateCompanyStart(
            state,
            start('SR', '5:3', 130),
            Shikoku1889StockRules,
            Shikoku1889CompanyRules
        ).reason
    ).toContain('afford')
    state.cash.find(
        (cash) => cash.owner.kind === 'player' && cash.owner.playerId === 'alex'
    )!.amount = 240
    state.certificates.find(
        (certificate) => certificate.id === 'AR:president'
    )!.certificateLimitCount = 19
    expect(
        evaluateCompanyStart(
            state,
            start('SR', '5:3', 130),
            Shikoku1889StockRules,
            Shikoku1889CompanyRules
        ).reason
    ).toContain('limits')
})
it('resolves both presidencies when the PEIR exchange changes the largest interests', () => {
    const { game, engine, state } = example(Top, 'starting')
    const company = getCompany(state, 'MS')
    company.started = true
    company.parPrice = 80
    company.president = alex
    state.tranches[1].companyIds.push('MS')
    placeStockMarker(state.stockMarket, 'MS', '3:1')
    give(state, 'MS:president', alex)
    give(state, 'MS:share:1', blair)
    give(state, 'MS:share:2', blair)
    give(state, 'MS:share:3', { kind: 'player', playerId: 'casey' })
    const result = engine.executeCanonicalAction({
        game,
        state,
        action: purchase('MS:share:4', 80, union)
    })
    expect(getCompany(result.updatedState, 'MS').president).toEqual(blair)
    expect(peirShares(result.updatedState)).toHaveLength(4)
    expect(getCompany(result.updatedState, 'PEIR').president).toEqual({
        kind: 'player',
        playerId: 'casey'
    })
    expect(sharesOwned(result.updatedState, 'MS', blair)).toBe(3)
    const flotation = result.processedActions.find(isFloatCompany)!
    const changes = historyCompanyChanges(result.processedActions, result.updatedState)
    const description = historyDescription(
        flotation,
        result.updatedState,
        (id) => id,
        (id) => id,
        changes.get(flotation.id)
    )
    expect(description.detail).toContain('MS President: alex → blair')
    expect(description.detail).toContain('PEIR President: blair → casey')
    expect(description.detail).toContain('blair exchanged PEIR #3 for 1 MS')
    const before = structuredClone(result.updatedState)
    historyCompanyChanges(result.processedActions, result.updatedState)
    expect(result.updatedState).toEqual(before)
})
