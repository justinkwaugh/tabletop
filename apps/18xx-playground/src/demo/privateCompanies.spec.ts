import { historyCompanyChanges } from '../../../../libs/18xx-ui/src/lib/table/historyCompanyChanges.js'
import { historyDescription } from '../../../../libs/18xx-ui/src/lib/table/historyDescription.js'
import { expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import {
    Definition as Top,
    TheOldPrincePrivateRules,
    TheOldPrinceStockRules,
    TheOldPrinceTrainRules
} from '@tabletop/the-old-prince'
import {
    Definition as Shikoku,
    Shikoku1889PrivateRules,
    Shikoku1889TrackRules,
    Shikoku1889StockRules,
    Shikoku1889TrainRules
} from '@tabletop/shikoku-1889'
import {
    isAdvancePhase,
    evaluatePrivateExchange,
    evaluateSharePurchase,
    privateExchangeOffers,
    getCompany,
    privateOwner,
    sharesOwned,
    stockCertificateCount,
    privateIncomePayments,
    exceedsStockLimits,
    TrainPurchase,
    type TrackRequest,
    type EighteenXXState
} from '@tabletop/18xx'
import { example } from './stockTestUtils.js'
function action(state: EighteenXXState, type: string, fields: object = {}): GameAction {
    return {
        id: `${type}:${state.actionCount}`,
        gameId: state.gameId,
        type,
        playerId: state.activePlayerIds[0],
        source: ActionSource.User,
        ...fields
    }
}
function exchange(
    state: EighteenXXState,
    privateCompanyId: string,
    certificateId: string,
    playerId = state.activePlayerIds[0]
) {
    return action(state, 'ExchangePrivate', { privateCompanyId, certificateId, playerId })
}
const Titles = [
    {
        definition: Top,
        rules: TheOldPrincePrivateRules,
        stocks: TheOldPrinceStockRules,
        privateId: 'MC',
        share: 'So:share:6'
    },
    {
        definition: Shikoku,
        rules: Shikoku1889PrivateRules,
        stocks: Shikoku1889StockRules,
        privateId: 'DR',
        share: 'IR:share:5'
    }
]
it.each(Titles)(
    'exchanges once with ownership, hydration, replay and Undo in $definition.info.id',
    ({ definition, rules, stocks, privateId, share }) => {
        const { game, engine, state } = example(definition, 'privates')
        const initial = structuredClone(state)
        const result = engine.executeCanonicalAction({
            game,
            state,
            action: exchange(state, privateId, share)
        })
        expect(getCompany(result.updatedState, privateId).closed).toBe(true)
        expect(privateOwner(result.updatedState, privateId)).toBeUndefined()
        expect(result.updatedState.certificates.find((item) => item.id === share)).toMatchObject({
            owner: { kind: 'player', playerId: 'alex' }
        })
        expect(result.updatedState.stockRound.turn.bought).toBe(false)
        expect(
            stockCertificateCount(result.updatedState, { kind: 'player', playerId: 'alex' }, stocks)
        ).toBe(
            stockCertificateCount(state, { kind: 'player', playerId: 'alex' }, stocks) -
                (definition === Shikoku ? 1 : 0)
        )
        expect(() =>
            engine.executeCanonicalAction({
                game,
                state: result.updatedState,
                action: exchange(result.updatedState, privateId, share)
            })
        ).toThrow()
        expect(
            privateExchangeOffers(result.updatedState, 'alex', rules, stocks).some(
                (offer) => offer.privateCompanyId === privateId
            )
        ).toBe(false)
        let replay = initial
        for (const processed of result.processedActions)
            replay = engine.applyProcessedAction({ game, state: replay, action: processed })
        expect(replay).toEqual(result.updatedState)
        expect(definition.runtime.hydrator.hydrateState(result.updatedState).dehydrate()).toEqual(
            result.updatedState
        )
        let undone = result.updatedState
        for (const processed of [...result.processedActions].reverse())
            undone = engine.undoProcessedAction({ state: undone, action: processed })
        expect(undone).toEqual(initial)
        expect(state).toEqual(initial)
    }
)
it('TOP extra exchanges cancel a retained pass and leave an ordinary purchase available', () => {
    const { game, engine, state } = example(Top, 'privates')
    state.stockRound.passedPlayerIds = ['casey', 'alex', 'blair']
    const result = engine.executeCanonicalAction({
        game,
        state,
        action: exchange(state, 'MC', 'So:share:6')
    }).updatedState
    expect(result.stockRound.passedPlayerIds).toEqual(['casey', 'blair'])
    expect(result.stockRound.turn).toMatchObject({ acted: true, bought: false })
    expect(
        evaluateSharePurchase(
            result,
            {
                playerId: 'alex',
                buyer: { kind: 'player', playerId: 'alex' },
                certificateId: 'ML:share:5'
            },
            TheOldPrinceStockRules
        ).details
    ).toBeDefined()
    const finished = engine.executeCanonicalAction({
        game,
        state: result,
        action: action(result, 'FinishStockTurn')
    })
    expect(finished.processedActions[0]).toMatchObject({ metadata: { passed: false } })
})
it('TOP reserved exchanges work after buying or selling the railway and permit retaining more than 60%', () => {
    const { game, engine, state } = example(Top, 'privates')
    const owner = { kind: 'player', playerId: 'alex' } as const
    for (const certificate of state.certificates)
        if (
            !certificate.retired &&
            certificate.kind === 'share' &&
            certificate.companyId === 'So' &&
            certificate.poolId !== 'reserved'
        ) {
            certificate.owner = owner
            delete certificate.poolId
        }
    getCompany(state, 'So').president = owner
    state.stockRound.turn.bought = true
    state.stockRound.sales.push({ owner, companyId: 'So' })
    const result = engine.executeCanonicalAction({
        game,
        state,
        action: exchange(state, 'MC', 'So:share:6')
    }).updatedState
    expect(sharesOwned(result, 'So', owner)).toBe(8)
    expect(exceedsStockLimits(result, owner, TheOldPrinceStockRules)).toBe(false)
    expect(result.ownershipLimitExemptions).toContainEqual({
        owner,
        companyId: 'So',
        maximumShares: 8
    })
    expect(
        evaluateSharePurchase(
            state,
            { playerId: 'alex', buyer: owner, certificateId: 'So:share:6' },
            TheOldPrinceStockRules
        ).details
    ).toBeUndefined()
})
it.each(Titles)(
    'rejects another owner, an unavailable share, and forced-discard timing in $definition.info.id',
    ({ definition, rules, stocks, privateId, share }) => {
        const { game, engine, state } = example(definition, 'privates')
        expect(() =>
            engine.executeCanonicalAction({
                game,
                state,
                action: exchange(state, privateId, share, 'blair')
            })
        ).toThrow()
        expect(() =>
            engine.executeCanonicalAction({
                game,
                state,
                action: exchange(state, privateId, 'AR:president')
            })
        ).toThrow()
        expect(
            evaluatePrivateExchange(
                { ...state, machineState: 'DiscardingTrains' },
                { playerId: 'alex', privateCompanyId: privateId, certificateId: share },
                rules,
                stocks
            ).details
        ).toBeUndefined()
    }
)
it('1889 exchanges during another stock turn without changing passes, purchases or turn owner', () => {
    const { game, engine, state } = example(Shikoku, 'privates')
    const passed = engine.executeCanonicalAction({
        game,
        state,
        action: action(state, 'FinishStockTurn')
    }).updatedState
    expect(passed.activePlayerIds).toEqual(['blair', 'alex', 'casey'])
    expect(engine.getValidActionTypesForPlayer(game, passed, 'alex')).toEqual([
        'ExchangePrivate',
        'SetStockInstruction'
    ])
    expect(() =>
        engine.executeCanonicalAction({
            game,
            state: passed,
            action: action(passed, 'FinishStockTurn', { playerId: 'alex' })
        })
    ).toThrow()
    const result = engine.executeCanonicalAction({
        game,
        state: passed,
        action: exchange(passed, 'DR', 'IR:share:5', 'alex')
    }).updatedState
    expect(result.stockRound).toEqual(passed.stockRound)
    expect(result.turnManager).toEqual(passed.turnManager)
    expect(result.activePlayerIds).toEqual(['blair', 'casey'])
})
it('1889 Dôgo respects ownership limits and requires an IPO share, but can exchange before Iyo starts', () => {
    const { state } = example(Shikoku, 'privates')
    const owner = { kind: 'player', playerId: 'alex' } as const
    const request = { playerId: 'alex', privateCompanyId: 'DR', certificateId: 'IR:share:5' }
    for (const item of state.certificates)
        if (!item.retired && ['IR:president', 'IR:share:1'].includes(item.id)) item.owner = owner
    getCompany(state, 'IR').president = owner
    expect(
        evaluatePrivateExchange(state, request, Shikoku1889PrivateRules, Shikoku1889StockRules)
            .reason
    ).toContain('ownership limit')
    getCompany(state, 'IR').started = false
    delete getCompany(state, 'IR').president
    const initialOwner = state.certificates.find((item) => item.id === 'IR:share:1')!
    if (!initialOwner.retired) initialOwner.owner = { kind: 'bank' }
    expect(
        evaluatePrivateExchange(state, request, Shikoku1889PrivateRules, Shikoku1889StockRules)
            .details
    ).toBeDefined()
})
it('TOP Ice Boats uses another started railway’s Bank share and closes without exchange at 4+', () => {
    const { game, engine, state } = example(Top, 'privates')
    let current = state
    for (let i = 0; i < 3; i++)
        current = engine.executeCanonicalAction({
            game,
            state: current,
            action: action(current, 'FinishStockTurn')
        }).updatedState
    const offers = privateExchangeOffers(
        current,
        'drew',
        TheOldPrincePrivateRules,
        TheOldPrinceStockRules
    ).filter((offer) => offer.privateCompanyId === 'IB')
    expect(offers.length).toBeGreaterThan(0)
    expect(offers.every((offer) => offer.certificateId.startsWith('A:share:'))).toBe(true)
    const result = engine.executeCanonicalAction({
        game,
        state: current,
        action: exchange(current, 'IB', offers[0].certificateId)
    }).updatedState
    expect(getCompany(result, 'IB').closed).toBe(true)
    expect(result.stockRound.turn).toMatchObject({ acted: true, bought: false })
})
it.each([
    { definition: Top, trains: TheOldPrinceTrainRules, rank: '4+', phase: '4+' },
    { definition: Shikoku, trains: Shikoku1889TrainRules, rank: '5', phase: '5' }
])(
    'applies complete private phase effects before resuming decisions in $definition.info.id',
    ({ definition, trains, rank, phase }) => {
        const { game, engine, state } = example(definition, 'private-events')
        expect(
            state.stations.every(
                (station) => getCompany(state, station.companyId).kind !== 'private'
            )
        ).toBe(true)
        if (definition === Top) {
            for (const [index, playerId] of ['alex', 'alex', 'casey', 'casey', 'drew'].entries()) {
                const certificate = state.certificates.find(
                    (item) => item.id === `So:share:${index + 1}`
                )!
                if (!certificate.retired) {
                    certificate.owner = { kind: 'player', playerId }
                    delete certificate.poolId
                }
            }
        }
        const train = trains.depot.nextTrain(state.trainInventory, rank)!
        const request = {
            companyId: state.trainPurchaseStep!.companyId,
            trainId: train.id,
            definitionId: rank
        }
        const details = new TrainPurchase(state, trains).evaluate(request).details!
        const result = engine.executeCanonicalAction({
            game,
            state,
            action: action(state, 'BuyTrain', { ...request, expectedPrice: details.price })
        })
        const updated = result.updatedState
        const advancement = result.processedActions.find(isAdvancePhase)!
        const changes = historyCompanyChanges(result.processedActions, updated)
        const description = historyDescription(
            advancement,
            updated,
            (id) => id,
            (id) => id,
            changes.get(advancement.id)
        )
        if (definition === Top) {
            for (const id of ['MC', 'SB', 'VR'])
                expect(description.detail).toContain(`${id} exchanged for 1 So`)
            expect(description.detail).toContain('So President: UB → alex')
        } else expect(description.detail).toContain('UTF income $50')
        expect(updated.phaseId).toBe(phase)
        expect(updated.phaseEvents[0].privateEffects.length).toBeGreaterThan(0)
        if (definition === Top) {
            for (const id of ['MC', 'VR', 'SB', 'IB', 'SBC', 'HS', 'MLC', 'SLC'])
                expect(getCompany(updated, id).closed).toBe(true)
            expect(getCompany(updated, 'UB').closed).not.toBe(true)
            expect(getCompany(updated, 'KM').closed).toBe(true)
            expect(updated.phaseEvents[0].privateEffects).toContainEqual({
                kind: 'close',
                privateCompanyId: 'KM'
            })
            expect(
                updated.phaseEvents[0].privateEffects.filter((effect) => effect.kind === 'exchange')
            ).toHaveLength(3)
            expect(getCompany(updated, 'So').president).toEqual({
                kind: 'player',
                playerId: 'alex'
            })
            expect(sharesOwned(updated, 'So', { kind: 'player', playerId: 'casey' })).toBe(3)
            expect(updated.certificates.find((item) => item.id === 'So:share:8')).toMatchObject({
                owner: { kind: 'player', playerId: 'casey' }
            })
        } else {
            const upgrade: TrackRequest = {
                companyId: 'IR',
                locationId: 'K4',
                definitionId: '18xx:12',
                nodeMapping: {},
                rotation: 0
            }
            expect(Shikoku1889TrackRules.restriction(state, upgrade)).toContain(
                'private company blocks'
            )
            expect(Shikoku1889TrackRules.restriction(updated, upgrade)).toBeUndefined()
            expect(getCompany(updated, 'DR').closed).toBe(true)
            expect(getCompany(updated, 'ER').closed).toBe(true)
            expect(getCompany(updated, 'UTF')).toMatchObject({ privateRevenue: 50 })
            expect(getCompany(updated, 'UTF').closed).not.toBe(true)
            expect(privateIncomePayments(updated)).toEqual([
                { from: { kind: 'bank' }, to: { kind: 'player', playerId: 'drew' }, amount: 50 }
            ])
            expect(updated.machineState).toBe('DiscardingTrains')
        }
        let replay = state
        for (const processed of result.processedActions)
            replay = engine.applyProcessedAction({ game, state: replay, action: processed })
        expect(replay).toEqual(updated)
        let undone = updated
        for (const processed of [...result.processedActions].reverse())
            undone = engine.undoProcessedAction({ state: undone, action: processed })
        expect(undone).toEqual(state)
    }
)
it('1889 closes a corporate-owned Uno-Takamatsu Ferry at phase 5', () => {
    const { state } = example(Shikoku, 'private-events')
    const certificate = state.certificates.find((item) => item.companyId === 'UTF')!
    if (!certificate.retired) certificate.owner = { kind: 'company', companyId: 'IR' }
    state.phaseId = '5'
    expect(Shikoku1889PrivateRules.phaseEffects(state)).toContainEqual({
        kind: 'close',
        privateCompanyId: 'UTF'
    })
})
it('1889 out-of-turn exchange transfers the operating presidency and preserves the company’s pending purchases', () => {
    const { game, engine, state } = example(Shikoku, 'private-events')
    expect(state.activePlayerIds).toEqual(['blair', 'alex'])
    const result = engine.executeCanonicalAction({
        game,
        state,
        action: exchange(state, 'DR', 'IR:share:5', 'alex')
    }).updatedState
    expect(result.machineState).toBe('BuyingTrains')
    expect(result.trainPurchaseStep).toEqual(state.trainPurchaseStep)
    expect(result.turnManager).toEqual(state.turnManager)
    expect(getCompany(result, 'IR').president).toEqual({ kind: 'player', playerId: 'alex' })
    expect(result.activePlayerIds).toEqual(['alex'])
    expect(result.stockRound).toEqual(state.stockRound)
})
it('Dôgo exchange can float Iyo and capitalizes it only once through the existing system action', () => {
    const { game, engine, state } = example(Shikoku, 'privates')
    const company = getCompany(state, 'IR')
    company.funded = false
    company.floated = false
    company.operated = false
    for (const item of state.certificates)
        if (!item.retired && ['IR:share:3', 'IR:share:4'].includes(item.id)) {
            item.owner = { kind: 'bank' }
            item.poolId = 'initial-offering'
        }
    const treasury = state.cash.find(
        (entry) => entry.owner.kind === 'company' && entry.owner.companyId === 'IR'
    )!
    treasury.amount = 0
    const result = engine.executeCanonicalAction({
        game,
        state,
        action: exchange(state, 'DR', 'IR:share:5')
    })
    expect(result.processedActions.map((item) => item.type)).toEqual([
        'ExchangePrivate',
        'FloatCompany'
    ])
    expect(getCompany(result.updatedState, 'IR')).toMatchObject({ funded: true, floated: true })
    expect(
        result.updatedState.cash.find(
            (entry) => entry.owner.kind === 'company' && entry.owner.companyId === 'IR'
        )?.amount
    ).toBe(700)
    let replay = state
    for (const processed of result.processedActions)
        replay = engine.applyProcessedAction({ game, state: replay, action: processed })
    expect(replay).toEqual(result.updatedState)
})
it('TOP concessions close on operation and no longer receive private income', () => {
    const { game, engine, state } = example(Top, 'operations')
    state.companies.push({
        id: 'MLC',
        name: 'Mainline Concession',
        kind: 'private',
        privateRevenue: 20
    })
    state.certificates.push({
        id: 'MLC:charter',
        companyId: 'MLC',
        kind: 'private',
        certificateLimitCount: 1,
        retired: false,
        owner: { kind: 'player', playerId: 'alex' }
    })
    let current = state
    for (const type of ['FinishTrack', 'FinishStations', 'RunTrains']) {
        current = engine.executeCanonicalAction({
            game,
            state: current,
            action: action(current, type, {
                companyId: 'ML',
                ...(type === 'RunTrains' ? { routes: [] } : {})
            })
        }).updatedState
    }
    expect(getCompany(current, 'MLC')).toMatchObject({ closed: true, privateRevenue: 0 })
    expect(privateOwner(current, 'MLC')).toBeUndefined()
    expect(TheOldPrincePrivateRules.operationEffects(current, 'ML')).toEqual([])
})
