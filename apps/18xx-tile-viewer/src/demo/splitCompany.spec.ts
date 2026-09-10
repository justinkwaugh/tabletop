import { expect, it } from 'vitest'
import { ActionSource, MachineContext, createAction } from '@tabletop/common'
import {
    Definition as Top,
    SplitCompany,
    HydratedSplitCompany,
    isSplitCompany,
    TheOldPrinceBranchSplit,
    type BranchSplitAllocation
} from '@tabletop/the-old-prince'
import { Definition as Shikoku } from '@tabletop/shikoku-1889'
import {
    cashOwnedBy,
    getCompany,
    sameOwner,
    sharesOwned,
    companyMarketSpace,
    type FinanceExampleState
} from '@tabletop/18xx'
import { example, purchase } from './stockTestUtils.js'
const alex = { kind: 'player', playerId: 'alex' } as const
function split(state: FinanceExampleState, changes: Partial<BranchSplitAllocation> = {}) {
    return createAction(SplitCompany, {
        id: 'split',
        gameId: state.gameId,
        source: ActionSource.User,
        playerId: 'alex',
        parentId: 'So',
        branchId: 'branch:BB',
        marketSpaceId: '3:1',
        expectedFunding: 560,
        allocation: {
            stationIds: ['So:station:1', 'So:station:2'],
            homeStationId: 'So:station:1',
            trainIds: state.trainInventory.trains
                .filter(
                    (t) =>
                        t.status === 'owned' &&
                        t.owner.kind === 'company' &&
                        t.owner.companyId === 'So'
                )
                .map((t) => t.id),
            cash: 110,
            hunslet: true,
            ...changes
        }
    })
}
function apply(
    state: FinanceExampleState,
    game: ReturnType<typeof example>['game'],
    engine: ReturnType<typeof example>['engine'],
    type: string,
    playerId: string,
    fields = {}
) {
    return engine.executeCanonicalAction({
        game,
        state,
        action: {
            id: `${type}:${state.actionCount}`,
            gameId: game.id,
            type,
            source: ActionSource.User,
            playerId,
            ...fields
        }
    }).updatedState
}
it('commits the exact preview, conserves assets, and uses one stock action', () => {
    const { game, engine, state } = example(Top, 'split')
    const before = structuredClone(state)
    const action = split(state)
    const calculation = new TheOldPrinceBranchSplit(state).allocate(action, action.allocation)
    const result = engine.executeCanonicalAction({ game, state, action })
    expect(result.processedActions).toHaveLength(1)
    const processed = result.processedActions[0]
    if (!isSplitCompany(processed)) throw new Error('Expected a processed split')
    expect(processed.metadata).toEqual(calculation.details)
    const after = result.updatedState
    expect(state).toEqual(before)
    expect(after.certificates.map((c) => c.id).sort()).toEqual(
        state.certificates.map((c) => c.id).sort()
    )
    expect(sharesOwned(after, 'So', { kind: 'company', companyId: 'So' })).toBe(4)
    expect(sharesOwned(after, 'branch:BB', alex)).toBe(2)
    expect(sharesOwned(after, 'branch:BB', { kind: 'bank' })).toBe(7)
    expect(cashOwnedBy(after, { kind: 'company', companyId: 'So' })).toBe(10)
    expect(cashOwnedBy(after, { kind: 'company', companyId: 'branch:BB' })).toBe(670)
    expect(after.cash.filter((c) => c.owner.kind === 'player')).toEqual(
        state.cash.filter((c) => c.owner.kind === 'player')
    )
    expect(after.stations.find((s) => s.id === 'So:home')).toEqual(
        state.stations.find((s) => s.id === 'So:home')
    )
    expect(
        after.stations.filter((s) => s.companyId === 'So' && s.status === 'removed')
    ).toHaveLength(2)
    expect(after.stations.find((s) => s.id === 'branch:BB:home')).toMatchObject({
        status: 'placed',
        position: { locationId: 'K19' }
    })
    expect(
        after.stations.filter((s) => s.companyId === 'branch:BB' && s.status === 'placed')
    ).toHaveLength(2)
    expect(after.stations.filter((s) => s.status === 'placed')).toHaveLength(
        state.stations.filter((s) => s.status === 'placed').length
    )
    expect(after.trainInventory.trains.map((t) => t.id)).toEqual(
        state.trainInventory.trains.map((t) => t.id)
    )
    expect(
        after.trainInventory.trains.filter(
            (t) =>
                t.status === 'owned' &&
                t.owner.kind === 'company' &&
                t.owner.companyId === 'branch:BB'
        )
    ).toHaveLength(1)
    expect(after.certificates.find((c) => c.id === 'HS:charter')).toMatchObject({
        owner: { kind: 'company', companyId: 'branch:BB' }
    })
    expect(getCompany(after, 'So').operated).toBe(true)
    expect(getCompany(after, 'branch:BB')).toMatchObject({
        started: true,
        funded: true,
        floated: false,
        operated: false,
        president: alex,
        parPrice: 80
    })
    expect(after.tranches[1].companyIds).toEqual(['branch:BB'])
    expect(companyMarketSpace(after.stockMarket, 'So')).toEqual(
        companyMarketSpace(state.stockMarket, 'So')
    )
    expect(companyMarketSpace(after.stockMarket, 'branch:BB').price).toBe(80)
    expect(after.stockRound.turn.bought).toBe(true)
    expect(after.stockRound.turn.acted).toBe(true)
    expect(after.activePlayerIds[0]).toBe('alex')
    expect(after.machineState).toBe('StockRound')
})
it('round-trips the action and restores the entire split with replay and Undo', () => {
    const { game, engine, state } = example(Top, 'split')
    const action = split(state)
    const result = engine.executeCanonicalAction({ game, state, action })
    const processed = result.processedActions[0]
    const restored = Top.runtime.hydrator.hydrateAction(processed)
    expect(restored).toBeInstanceOf(HydratedSplitCompany)
    expect(restored.dehydrate()).toEqual(processed)
    expect(Top.runtime.hydrator.hydrateAction(restored).dehydrate()).toEqual(processed)
    expect(Top.runtime.hydrator.hydrateState(result.updatedState).dehydrate()).toEqual(
        result.updatedState
    )
    expect(engine.applyProcessedAction({ game, state, action: processed })).toEqual(
        result.updatedState
    )
    expect(engine.undoProcessedAction({ state: result.updatedState, action: processed })).toEqual(
        state
    )
    expect(Shikoku.runtime.apiActions.SplitCompany).toBeUndefined()
})
it.each([
    ['no station', { stationIds: [] }],
    ['protected home', { stationIds: ['So:home'], homeStationId: 'So:home' }],
    ['foreign station', { stationIds: ['ML:home'], homeStationId: 'ML:home' }],
    ['duplicate station', { stationIds: ['So:station:1', 'So:station:1'] }],
    ['unallocated home', { homeStationId: 'So:home' }],
    ['negative cash', { cash: -1 }],
    ['too much cash', { cash: 121 }],
    ['fractional cash', { cash: 0.5 }],
    ['foreign train', { trainIds: ['missing'] }]
])('rejects %s without changing state', (_name, change) => {
    const { game, engine, state } = example(Top, 'split')
    const action = split(state)
    const before = structuredClone(state)
    const invalid = { ...action, allocation: { ...action.allocation, ...change } }
    expect(() => engine.executeCanonicalAction({ game, state, action: invalid })).toThrow()
    expect(state).toEqual(before)
})
it('rejects duplicate trains, a missing Hunslet, wrong actors, system actions, and stale grants', () => {
    const { game, engine, state } = example(Top, 'split')
    const action = split(state)
    for (const override of [
        { playerId: 'blair' },
        { source: ActionSource.System },
        { expectedFunding: 559 },
        {
            allocation: {
                ...action.allocation,
                trainIds: [action.allocation.trainIds[0], action.allocation.trainIds[0]]
            }
        }
    ])
        expect(() =>
            engine.executeCanonicalAction({ game, state, action: { ...action, ...override } })
        ).toThrow()
    const hunslet = state.certificates.find((c) => c.id === 'HS:charter')
    if (!hunslet || hunslet.retired) throw new Error('Missing Hunslet')
    hunslet.owner = alex
    expect(() => engine.executeCanonicalAction({ game, state, action })).toThrow()
})
it('checks available station pieces and each resulting train limit', () => {
    const { state } = example(Top, 'split')
    const action = split(state)
    state.stations = state.stations.filter(
        (s) => s.companyId !== 'branch:BB' || s.id === 'branch:BB:home'
    )
    expect(new TheOldPrinceBranchSplit(state).allocate(action, action.allocation).reason).toMatch(
        /too few/
    )
    action.allocation.stationIds = ['So:station:1']
    state.phaseId = '7'
    action.marketSpaceId = '6:1'
    const train = state.trainInventory.trains.find((t) => t.id === action.allocation.trainIds[0])
    if (!train) throw new Error('Missing train')
    state.trainInventory.trains.push({ ...train, id: 'extra:1' }, { ...train, id: 'extra:2' })
    action.allocation.trainIds = [train.id, 'extra:1', 'extra:2']
    expect(new TheOldPrinceBranchSplit(state).allocate(action, action.allocation).reason).toMatch(
        /train limit/
    )
    action.allocation.trainIds = []
    expect(new TheOldPrinceBranchSplit(state).allocate(action, action.allocation).reason).toMatch(
        /train limit/
    )
    action.allocation.trainIds = [train.id]
    expect(
        new TheOldPrinceBranchSplit(state).allocate(action, action.allocation).reason
    ).toBeUndefined()
})
it('allows zero cash and no trains or Hunslet to be transferred', () => {
    const { game, engine, state } = example(Top, 'split')
    const result = engine.executeCanonicalAction({
        game,
        state,
        action: split(state, {
            stationIds: ['So:station:2'],
            homeStationId: 'So:station:2',
            cash: 0,
            trainIds: [],
            hunslet: false
        })
    })
    expect(cashOwnedBy(result.updatedState, { kind: 'company', companyId: 'So' })).toBe(120)
    expect(cashOwnedBy(result.updatedState, { kind: 'company', companyId: 'branch:BB' })).toBe(560)
    expect(result.updatedState.certificates.find((c) => c.id === 'HS:charter')).toEqual(
        state.certificates.find((c) => c.id === 'HS:charter')
    )
    expect(result.updatedState.trainInventory).toEqual(state.trainInventory)
    expect(result.updatedState.stations.find((s) => s.id === 'branch:BB:home')).toMatchObject({
        status: 'placed',
        position: { locationId: 'N20' }
    })
})
it('resumes the stock turn, bars a second purchase, and floats later without paying again', () => {
    const { game, engine, state: initial } = example(Top, 'split')
    let state = engine.executeCanonicalAction({
        game,
        state: initial,
        action: split(initial)
    }).updatedState
    expect(() =>
        engine.executeCanonicalAction({ game, state, action: purchase('branch:BB:share:2', 80) })
    ).toThrow()
    state = apply(state, game, engine, 'FinishStockTurn', 'alex')
    expect(state.activePlayerIds[0]).toBe('blair')
    for (const [playerId, certificateId] of [
        ['blair', 'branch:BB:share:2'],
        ['casey', 'branch:BB:share:3'],
        ['alex', 'branch:BB:share:4']
    ] as const) {
        if (playerId === 'casey') {
            const cash = state.cash.find((c) => sameOwner(c.owner, { kind: 'player', playerId }))
            if (!cash || cash.amount === 'unlimited') throw new Error('Missing player cash')
            expect(cash.amount).toBeGreaterThanOrEqual(80)
        }
        const result = engine.executeCanonicalAction({
            game,
            state,
            action: {
                ...purchase(certificateId, 80, { kind: 'player', playerId }),
                id: `purchase:${playerId}`,
                playerId
            }
        })
        state = result.updatedState
        if (playerId !== 'alex') state = apply(state, game, engine, 'FinishStockTurn', playerId)
        else
            expect(result.processedActions.map((action) => action.type)).toEqual([
                'BuyShares',
                'FloatCompany'
            ])
    }
    expect(getCompany(state, 'branch:BB').floated).toBe(true)
    expect(cashOwnedBy(state, { kind: 'company', companyId: 'branch:BB' })).toBe(670)
    expect(
        state.stations.filter((s) => s.companyId === 'branch:BB' && s.status === 'placed')
    ).toHaveLength(2)
    const hydrated = Top.runtime.hydrator.hydrateState(state)
    expect(
        Top.runtime.stateHandlers.StockRound.validActionsForPlayer(
            'alex',
            new MachineContext({ gameConfig: game.config, gameState: hydrated })
        )
    ).not.toContain('SplitCompany')
})
it('preserves reserved certificates and non-acting-player authority during stock exchanges', () => {
    const { game, engine, state } = example(Top, 'split')
    const certificate = state.certificates.find((c) => c.id === 'So:share:8')
    if (!certificate || certificate.retired) throw new Error('Missing share')
    certificate.poolId = 'reserved'
    const result = engine.executeCanonicalAction({ game, state, action: split(state) })
    expect(result.updatedState.certificates.find((c) => c.id === certificate.id)).toEqual(
        certificate
    )
    const otherState = structuredClone(state)
    otherState.activePlayerIds = ['blair', 'alex']
    expect(() =>
        engine.executeCanonicalAction({ game, state: otherState, action: split(otherState) })
    ).toThrow()
})
