import { expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import {
    Definition as Top,
    TheOldPrinceTransferRules,
    TheOldPrinceTrainRules,
    TheOldPrinceTrackRules,
    TheOldPrincePrivateRules,
    TheOldPrinceStockRules
} from '@tabletop/the-old-prince'
import {
    Definition as Shikoku,
    Shikoku1889TransferRules,
    Shikoku1889TrainRules,
    Shikoku1889PrivatePowerRules,
    Shikoku1889TrackRules
} from '@tabletop/shikoku-1889'
import {
    purchaseChoices,
    privateOwner,
    cashOwnedBy,
    trainsOwnedBy,
    getCompany,
    evaluatePurchaseOffer,
    TrackConstruction,
    privateTrackConstruction,
    privateTrainPurchase,
    applyPrivateEffects,
    type FinanceExampleState,
    type PurchaseOfferRequest
} from '@tabletop/18xx'
import { example } from './stockTestUtils.js'
function action(state: FinanceExampleState, type: string, fields: object = {}): GameAction {
    return {
        id: `${type}:${state.actionCount}`,
        gameId: state.gameId,
        source: ActionSource.User,
        type,
        playerId: state.activePlayerIds[0],
        ...fields
    }
}
const Titles = [
    { definition: Top, transfers: TheOldPrinceTransferRules, trains: TheOldPrinceTrainRules },
    { definition: Shikoku, transfers: Shikoku1889TransferRules, trains: Shikoku1889TrainRules }
]
it.each(Titles)(
    'negotiates a train without advancing phase or consuming depot allowance: $definition.info.id',
    ({ definition, transfers, trains }) => {
        const { game, engine, state } = example(definition, 'transfers')
        const hydrated = definition.runtime.hydrator.hydrateState(state)
        const choice = purchaseChoices(hydrated, state.activePlayerIds[0], transfers, trains).find(
            (choice) => choice.request.asset.kind === 'train'
        )!
        expect(choice).toBeDefined()
        const request = { ...choice.request, price: 17 }
        const offered = engine.executeCanonicalAction({
            game,
            state,
            action: action(state, 'OfferPurchase', request)
        })
        expect(offered.updatedState.purchaseOffer).toMatchObject(request)
        expect(offered.updatedState.activePlayerIds).toEqual([
            offered.updatedState.purchaseOffer!.sellerPlayerId
        ])
        expect(offered.updatedState.trainInventory).toEqual(state.trainInventory)
        expect(offered.updatedState.cash).toEqual(state.cash)
        expect(
            engine.getValidActionTypesForPlayer(
                game,
                offered.updatedState,
                state.activePlayerIds[0]
            )
        ).toEqual([])
        expect(() =>
            engine.executeCanonicalAction({
                game,
                state: offered.updatedState,
                action: action(offered.updatedState, 'FinishOperatingTurn', {
                    companyId: request.companyId
                })
            })
        ).toThrow()
        const accepted = engine.executeCanonicalAction({
            game,
            state: offered.updatedState,
            action: action(offered.updatedState, 'RespondToPurchaseOffer', {
                offerId: offered.updatedState.purchaseOffer!.id,
                accept: true
            })
        })
        expect(accepted.updatedState.purchaseOffer).toBeUndefined()
        expect(accepted.updatedState.phaseId).toBe(state.phaseId)
        expect(accepted.updatedState.trainPurchaseStep).toEqual(state.trainPurchaseStep)
        expect(accepted.updatedState.operatingSet).toEqual(state.operatingSet)
        expect(accepted.updatedState.turnManager).toEqual(state.turnManager)
        expect(accepted.updatedState.activePlayerIds[0]).toBe(state.activePlayerIds[0])
        expect(
            trainsOwnedBy(accepted.updatedState, { kind: 'company', companyId: request.companyId })
        ).toHaveLength(2)
        expect(cashOwnedBy(accepted.updatedState, request.seller)).toBe(
            Number(cashOwnedBy(state, request.seller)) + 17
        )
        let replay = state
        for (const processed of [...offered.processedActions, ...accepted.processedActions]) {
            expect(JSON.stringify(processed)).not.toContain('priceRange')
            replay = engine.applyProcessedAction({ game, state: replay, action: processed })
        }
        expect(replay).toEqual(accepted.updatedState)
        expect(definition.runtime.hydrator.hydrateState(offered.updatedState).dehydrate()).toEqual(
            offered.updatedState
        )
        for (const processed of [
            ...offered.processedActions,
            ...accepted.processedActions
        ].reverse())
            replay = engine.undoProcessedAction({ state: replay, action: processed })
        expect(replay).toEqual(state)
    }
)
it.each(Titles)(
    'rejects offers and stale acceptance: $definition.info.id',
    ({ definition, transfers, trains }) => {
        const { game, engine, state } = example(definition, 'transfers')
        const choice = purchaseChoices(
            definition.runtime.hydrator.hydrateState(state),
            state.activePlayerIds[0],
            transfers,
            trains
        ).find((choice) => choice.request.asset.kind === 'train')!
        const offered = engine.executeCanonicalAction({
            game,
            state,
            action: action(state, 'OfferPurchase', choice.request)
        }).updatedState
        const response = action(offered, 'RespondToPurchaseOffer', {
            offerId: offered.purchaseOffer!.id,
            accept: true
        })
        expect(() =>
            engine.executeCanonicalAction({
                game,
                state: offered,
                action: { ...response, playerId: state.activePlayerIds[0] }
            })
        ).toThrow()
        expect(() =>
            engine.executeCanonicalAction({
                game,
                state: offered,
                action: action(offered, 'RespondToPurchaseOffer', {
                    offerId: 'stale',
                    accept: true
                })
            })
        ).toThrow()
        const stale = structuredClone(offered)
        const cash = stale.cash.find(
            (cash) =>
                cash.owner.kind === 'company' && cash.owner.companyId === choice.request.companyId
        )!
        cash.amount = 0
        expect(() =>
            engine.executeCanonicalAction({ game, state: stale, action: response })
        ).toThrow()
        const rejected = engine.executeCanonicalAction({
            game,
            state: offered,
            action: action(offered, 'RespondToPurchaseOffer', {
                offerId: offered.purchaseOffer!.id,
                accept: false
            })
        }).updatedState
        expect(rejected.purchaseOffer).toBeUndefined()
        expect(rejected.cash).toEqual(state.cash)
        expect(rejected.trainInventory).toEqual(state.trainInventory)
        expect(rejected.activePlayerIds[0]).toBe(state.activePlayerIds[0])
    }
)
it.each(Titles)(
    'checks price, ownership, rusting and train limits: $definition.info.id',
    ({ definition, transfers, trains }) => {
        const { state } = example(definition, 'transfers')
        const hydrated = definition.runtime.hydrator.hydrateState(state)
        const request = purchaseChoices(hydrated, state.activePlayerIds[0], transfers, trains).find(
            (choice) => choice.request.asset.kind === 'train'
        )!.request
        for (const price of [0, -1, 1.5, 99999])
            expect(
                evaluatePurchaseOffer(hydrated, { ...request, price }, transfers, trains).reason
            ).toBeDefined()
        expect(
            evaluatePurchaseOffer(
                hydrated,
                { ...request, seller: { kind: 'player', playerId: 'alex' } },
                transfers,
                trains
            ).reason
        ).toBeDefined()
        expect(
            evaluatePurchaseOffer(hydrated, request, transfers, { ...trains, trainLimit: () => 1 })
                .reason
        ).toBeDefined()
        const asset = request.asset
        const train = hydrated.trainInventory.trains.find(
            (item) => asset.kind === 'train' && item.id === asset.trainId
        )!
        if (train.status !== 'owned') throw Error('Expected owned train')
        train.rustsAfterOperation = true
        expect(evaluatePurchaseOffer(hydrated, request, transfers, trains).reason).toBeDefined()
    }
)
it('TOP applies one explicit confirmation when the same player controls both companies through Union Bank', () => {
    const { game, engine, state } = example(Top, 'transfers')
    const controller = { kind: 'company', companyId: 'UB' } as const
    getCompany(state, 'So').president = controller
    const certificate = state.certificates.find((item) => item.id === 'So:president')!
    if (certificate.retired) throw Error('Expected presidency')
    certificate.owner = controller
    const request = purchaseChoices(
        Top.runtime.hydrator.hydrateState(state),
        state.activePlayerIds[0],
        TheOldPrinceTransferRules,
        TheOldPrinceTrainRules
    ).find((choice) => choice.request.asset.kind === 'train')!.request
    const result = engine.executeCanonicalAction({
        game,
        state,
        action: action(state, 'OfferPurchase', request)
    })
    expect(result.processedActions).toHaveLength(1)
    expect(result.updatedState.purchaseOffer).toBeUndefined()
    expect(trainsOwnedBy(result.updatedState, { kind: 'company', companyId: 'ML' })).toHaveLength(2)
})
function buyEhime() {
    const { game, engine, state } = example(Shikoku, 'powers')
    const request: PurchaseOfferRequest = {
        companyId: 'IR',
        asset: { kind: 'private', privateCompanyId: 'ER' },
        seller: { kind: 'player', playerId: 'alex' },
        price: 80
    }
    const offered = engine.executeCanonicalAction({
        game,
        state,
        action: action(state, 'OfferPurchase', request)
    }).updatedState
    const bought = engine.executeCanonicalAction({
        game,
        state: offered,
        action: action(offered, 'RespondToPurchaseOffer', {
            offerId: offered.purchaseOffer!.id,
            accept: true
        })
    }).updatedState
    return { game, engine, state, bought }
}
it('1889 gives Ehime’s seller a single optional extra tile lay and resumes the buyer', () => {
    const { game, engine, state, bought } = buyEhime()
    expect(bought.privateTrackLay).toEqual({
        companyId: 'IR',
        privateCompanyId: 'ER',
        playerId: 'alex'
    })
    expect(privateOwner(bought, 'ER')).toEqual({ kind: 'company', companyId: 'IR' })
    expect(bought.activePlayerIds).toEqual(['alex'])
    const hydrated = Shikoku.runtime.hydrator.hydrateState(bought)
    const terms = Shikoku1889PrivatePowerRules.trackTerms(hydrated, 'ER', 'alex')!
    const choices = privateTrackConstruction(hydrated, terms, Shikoku1889TrackRules).choices('C4')
    expect(choices.length).toBeGreaterThan(0)
    const { companyId, locationId, definitionId, rotation, nodeMapping, cost } = choices[0]
    const laid = engine.executeCanonicalAction({
        game,
        state: bought,
        action: action(bought, 'LayPrivateTile', {
            privateCompanyId: 'ER',
            companyId,
            locationId,
            definitionId,
            rotation,
            nodeMapping,
            expectedCost: cost
        })
    }).updatedState
    expect(laid.tileInventory.placements.C4).toMatchObject({ definitionId, rotation })
    expect(laid.trackStep).toEqual(state.trackStep)
    expect(laid.activePlayerIds[0]).toBe('blair')
    expect(laid.privateTrackLay).toBeUndefined()
    expect(laid.usedPrivatePowerIds).toContain('ER')
    expect(getCompany(laid, 'ER').closed).not.toBe(true)
    expect(laid.operatingSet).toEqual(state.operatingSet)
    expect(laid.turnManager).toEqual(state.turnManager)
})
it('1889 can decline Ehime without losing the ordinary track allowance', () => {
    const { game, engine, state, bought } = buyEhime()
    const declined = engine.executeCanonicalAction({
        game,
        state: bought,
        action: action(bought, 'DeclinePrivateTile', { privateCompanyId: 'ER' })
    }).updatedState
    expect(declined.privateTrackLay).toBeUndefined()
    expect(declined.usedPrivatePowerIds).toContain('ER')
    expect(declined.tileInventory).toEqual(state.tileInventory)
    expect(declined.trackStep).toEqual(state.trackStep)
    expect(declined.activePlayerIds[0]).toBe('blair')
})
it('1889 limits private purchases to player ownership, phases 3/4 and half to double face value', () => {
    const { state } = example(Shikoku, 'powers')
    const hydrated = Shikoku.runtime.hydrator.hydrateState(state)
    const request: PurchaseOfferRequest = {
        companyId: 'IR',
        asset: { kind: 'private', privateCompanyId: 'ER' },
        seller: { kind: 'player', playerId: 'alex' },
        price: 20
    }
    for (const price of [20, 80])
        expect(
            evaluatePurchaseOffer(
                hydrated,
                { ...request, price },
                Shikoku1889TransferRules,
                Shikoku1889TrainRules
            ).reason
        ).toBeUndefined()
    for (const price of [19, 81])
        expect(
            evaluatePurchaseOffer(
                hydrated,
                { ...request, price },
                Shikoku1889TransferRules,
                Shikoku1889TrainRules
            ).reason
        ).toBeDefined()
    for (const phaseId of ['2', '5', '6', 'D']) {
        hydrated.phaseId = phaseId
        expect(
            evaluatePurchaseOffer(
                hydrated,
                request,
                Shikoku1889TransferRules,
                Shikoku1889TrainRules
            ).reason
        ).toBeDefined()
    }
    const { bought } = buyEhime()
    expect(
        Shikoku1889TransferRules.priceRange(
            Shikoku.runtime.hydrator.hydrateState(bought),
            'IR',
            request.asset
        )
    ).toBeUndefined()
})
it('Mitsubishi can be used once by a player without a railway, outside a rival’s operation', () => {
    const { game, engine, state } = example(Shikoku, 'privates')
    const hydrated = Shikoku.runtime.hydrator.hydrateState(state)
    const terms = Shikoku1889PrivatePowerRules.trackTerms(hydrated, 'MF', 'casey')!
    expect(terms).toBeDefined()
    const { companyId, locationId, definitionId, rotation, nodeMapping, cost } =
        privateTrackConstruction(hydrated, terms, Shikoku1889TrackRules).choices('B11')[0]
    const result = engine.executeCanonicalAction({
        game,
        state,
        action: action(state, 'LayPrivateTile', {
            playerId: 'casey',
            privateCompanyId: 'MF',
            companyId,
            locationId,
            definitionId,
            rotation,
            nodeMapping,
            expectedCost: cost
        })
    }).updatedState
    expect(result.usedPrivatePowerIds).toContain('MF')
    expect(result.stockRound).toEqual(state.stockRound)
    expect(result.turnManager).toEqual(state.turnManager)
    expect(getCompany(result, 'MF').closed).not.toBe(true)
    expect(
        Shikoku1889PrivatePowerRules.trackTerms(
            Shikoku.runtime.hydrator.hydrateState(result),
            'MF',
            'casey'
        )
    ).toBeUndefined()
    const rival = example(Shikoku, 'transfers').state
    expect(
        Shikoku1889PrivatePowerRules.trackTerms(
            Shikoku.runtime.hydrator.hydrateState(rival),
            'MF',
            'casey'
        )
    ).toBeUndefined()
})
it('Sumitomo relieves the owning company’s mountain cost but preserves combined river terrain', () => {
    const { state } = example(Shikoku, 'powers')
    const hydrated = Shikoku.runtime.hydrator.hydrateState(state)
    const certificate = hydrated.certificates.find((item) => item.companyId === 'SRR')!
    if (certificate.retired) throw Error('Expected private')
    certificate.owner = { kind: 'company', companyId: 'IR' }
    for (const location of Shikoku1889TrackRules.map.definition.locations.filter((item) =>
        item.terrain?.kinds.includes('mountain')
    )) {
        const request = {
            companyId: 'IR',
            locationId: location.id,
            definitionId: '18xx:7',
            rotation: 0,
            nodeMapping: {}
        } as const
        expect(Shikoku1889TrackRules.terrainCost!(hydrated, request, 80)).toBe(
            location.terrain!.kinds.includes('water') ? 80 : 0
        )
        expect(
            Shikoku1889TrackRules.terrainCost!(hydrated, { ...request, companyId: 'AR' }, 80)
        ).toBe(80)
    }
    getCompany(hydrated, 'SRR').closed = true
    expect(
        Shikoku1889TrackRules.terrainCost!(
            hydrated,
            {
                companyId: 'IR',
                locationId: 'D7',
                definitionId: '18xx:7',
                rotation: 0,
                nodeMapping: {}
            },
            80
        )
    ).toBe(80)
})
it('Hunslet buys before track finishes, advances phase and resumes that step', () => {
    const { game, engine, state } = example(Top, 'powers')
    const request: PurchaseOfferRequest = {
        companyId: 'ML',
        asset: { kind: 'private', privateCompanyId: 'HS' },
        seller: { kind: 'player', playerId: 'blair' },
        price: 100
    }
    const offered = engine.executeCanonicalAction({
        game,
        state,
        action: action(state, 'OfferPurchase', request)
    }).updatedState
    const bought = engine.executeCanonicalAction({
        game,
        state: offered,
        action: action(offered, 'RespondToPurchaseOffer', {
            offerId: offered.purchaseOffer!.id,
            accept: true
        })
    }).updatedState
    bought.trainInventory.trains = bought.trainInventory.trains.map((train) =>
        train.status === 'depot' && train.definitionId === '4H'
            ? { id: train.id, definitionId: train.definitionId, status: 'removed' }
            : train
    )
    const hydrated = Top.runtime.hydrator.hydrateState(bought)
    const details = privateTrainPurchase(hydrated, 'ML', TheOldPrinceTrainRules)
        .offers()
        .find((item) => item.evaluation.details)!.evaluation.details!
    const { companyId, trainId, definitionId, price } = details
    const result = engine.executeCanonicalAction({
        game,
        state: bought,
        action: action(bought, 'BuyPrivateTrain', {
            privateCompanyId: 'HS',
            companyId,
            trainId,
            definitionId,
            expectedPrice: price
        })
    })
    expect(result.updatedState.phaseId).toBe('5H')
    expect(result.updatedState.machineState).toBe('LayingTrack')
    expect(result.updatedState.trackStep).toEqual(state.trackStep)
    expect(result.updatedState.trainPurchaseStep).toBeUndefined()
    expect(result.updatedState.operatingSet).toEqual(state.operatingSet)
    expect(getCompany(result.updatedState, 'HS').closed).toBe(true)
    expect(result.processedActions.map((item) => item.type)).toEqual([
        'BuyPrivateTrain',
        'AdvancePhase'
    ])
    let replay = bought
    for (const processed of result.processedActions)
        replay = engine.applyProcessedAction({ game, state: replay, action: processed })
    expect(replay).toEqual(result.updatedState)
})
it('TOP restricts Hunslet’s sale and removes the unused construction tile at 4+', () => {
    const { state } = example(Top, 'powers')
    const hydrated = Top.runtime.hydrator.hydrateState(state)
    expect(
        TheOldPrinceTransferRules.priceRange(hydrated, 'PEIR', {
            kind: 'private',
            privateCompanyId: 'HS'
        })
    ).toBeUndefined()
    expect(
        TheOldPrinceTransferRules.priceRange(hydrated, 'ML', {
            kind: 'private',
            privateCompanyId: 'VR'
        })
    ).toBeUndefined()
    expect(
        TheOldPrinceTransferRules.priceRange(hydrated, 'ML', {
            kind: 'private',
            privateCompanyId: 'HS'
        })
    ).toEqual({ minimum: 1, maximum: 200 })
    hydrated.phaseId = '3H'
    expect(
        TheOldPrinceTransferRules.priceRange(hydrated, 'ML', {
            kind: 'private',
            privateCompanyId: 'HS'
        })
    ).toBeUndefined()
    hydrated.phaseId = '4+'
    const effects = TheOldPrincePrivateRules.phaseEffects(hydrated)
    applyPrivateEffects(hydrated, effects, TheOldPrinceStockRules)
    expect(
        TheOldPrinceTrackRules.tileSet.availablePieces(hydrated.tileInventory, '18xx:9')
    ).toEqual([])
    expect(getCompany(hydrated, 'SBC').closed).toBe(true)
})
it.each([true, false])(
    'Vernon River Bridge permission pauses and resumes track construction, accept=%s',
    (accept) => {
        const { game, engine, state } = example(Top, 'powers')
        const construction = new TrackConstruction(
            Top.runtime.hydrator.hydrateState(state),
            TheOldPrinceTrackRules
        )
        const details = construction.choices('N18')[0]
        expect(details).toBeDefined()
        expect(details.consentPlayerId).toBe('casey')
        const { companyId, locationId, definitionId, rotation, nodeMapping, cost } = details
        const request = {
            companyId,
            locationId,
            definitionId,
            rotation,
            nodeMapping,
            expectedCost: cost
        }
        expect(() =>
            engine.executeCanonicalAction({
                game,
                state,
                action: action(state, 'LayTile', request)
            })
        ).toThrow()
        const pending = engine.executeCanonicalAction({
            game,
            state,
            action: action(state, 'RequestTrackConsent', request)
        })
        expect(pending.updatedState.activePlayerIds).toEqual(['casey'])
        expect(pending.updatedState.tileInventory).toEqual(state.tileInventory)
        expect(pending.updatedState.trackStep).toEqual(state.trackStep)
        const response = action(pending.updatedState, 'RespondToTrackConsent', {
            requestId: pending.updatedState.trackConsent!.id,
            accept
        })
        expect(() =>
            engine.executeCanonicalAction({
                game,
                state: pending.updatedState,
                action: { ...response, playerId: 'alex' }
            })
        ).toThrow()
        const result = engine.executeCanonicalAction({
            game,
            state: pending.updatedState,
            action: response
        })
        expect(result.updatedState.trackConsent).toBeUndefined()
        expect(result.updatedState.activePlayerIds[0]).toBe('alex')
        expect(result.updatedState.trackStep!.lays).toHaveLength(accept ? 1 : 0)
        expect(result.updatedState.tileInventory.placements.N18?.definitionId).toBe(
            accept ? definitionId : undefined
        )
        let undone = result.updatedState
        for (const processed of [...pending.processedActions, ...result.processedActions].reverse())
            undone = engine.undoProcessedAction({ state: undone, action: processed })
        expect(undone).toEqual(state)
    }
)
it('Vernon River Bridge owner can approve through the ordinary lay without an extra turn', () => {
    const { game, engine, state } = example(Top, 'powers')
    const certificate = state.certificates.find((item) => item.companyId === 'VR')!
    if (certificate.retired) throw Error('Expected private')
    certificate.owner = { kind: 'player', playerId: 'alex' }
    const details = new TrackConstruction(
        Top.runtime.hydrator.hydrateState(state),
        TheOldPrinceTrackRules
    ).choices('N18')[0]
    const { companyId, locationId, definitionId, rotation, nodeMapping, cost } = details
    const result = engine.executeCanonicalAction({
        game,
        state,
        action: action(state, 'LayTile', {
            companyId,
            locationId,
            definitionId,
            rotation,
            nodeMapping,
            expectedCost: cost
        })
    })
    expect(result.processedActions).toHaveLength(1)
    expect(result.updatedState.trackConsent).toBeUndefined()
    expect(result.updatedState.tileInventory.placements.N18).toBeDefined()
})
it('construction entitlement stays owner-specific and uses the ordinary allowance', () => {
    const { game, engine, state } = example(Top, 'powers')
    const certificate = state.certificates.find((item) => item.companyId === 'SBC')!
    if (certificate.retired) throw Error('Expected private')
    const construction = () =>
        new TrackConstruction(Top.runtime.hydrator.hydrateState(state), TheOldPrinceTrackRules)
    expect(
        construction()
            .choices('K17')
            .some((choice) => choice.definitionId === '18xx:9')
    ).toBe(false)
    certificate.owner = { kind: 'player', playerId: 'alex' }
    const details = TheOldPrinceTrackRules.map.definition.locations
        .flatMap((location) => construction().choices(location.id))
        .find((choice) => choice.definitionId === '18xx:9' && !choice.consentPlayerId)!
    expect(details).toBeDefined()
    const { companyId, locationId, definitionId, rotation, nodeMapping, cost } = details
    const result = engine.executeCanonicalAction({
        game,
        state,
        action: action(state, 'LayTile', {
            companyId,
            locationId,
            definitionId,
            rotation,
            nodeMapping,
            expectedCost: cost
        })
    }).updatedState
    expect(result.trackStep!.lays).toHaveLength(1)
    expect(
        TheOldPrinceTrackRules.tileSet.availablePieces(result.tileInventory, '18xx:9')
    ).toHaveLength(0)
    const hydrated = Top.runtime.hydrator.hydrateState(result)
    hydrated.phaseId = '4+'
    applyPrivateEffects(
        hydrated,
        TheOldPrincePrivateRules.phaseEffects(hydrated),
        TheOldPrinceStockRules
    )
    expect(hydrated.tileInventory.placements[locationId]).toEqual(
        result.tileInventory.placements[locationId]
    )
    expect(hydrated.tileInventory.retiredPieceIds).not.toContain(details.placement.pieceId)
})
it.each([true, false])(
    'Mitsubishi gets a between-company window and preserves its right when skipped, use=%s',
    (use) => {
        const { game, engine, state } = example(Shikoku, 'transfers')
        const result = engine.executeCanonicalAction({
            game,
            state,
            action: action(state, 'FinishOperatingTurn', { companyId: 'IR' })
        })
        const pending = result.updatedState
        expect(pending.privatePowerWindow).toEqual({ companyId: 'AR', passedPlayerIds: [] })
        expect(pending.activePlayerIds).toEqual(['casey'])
        expect(engine.getValidActionTypesForPlayer(game, pending, 'blair')).toEqual([])
        expect(Shikoku.runtime.hydrator.hydrateState(pending).dehydrate()).toEqual(pending)
        const hydrated = Shikoku.runtime.hydrator.hydrateState(pending)
        const terms = Shikoku1889PrivatePowerRules.trackTerms(hydrated, 'MF', 'casey')!
        const { companyId, locationId, definitionId, rotation, nodeMapping, cost } =
            privateTrackConstruction(hydrated, terms, Shikoku1889TrackRules).choices('B11')[0]
        const choice = use
            ? action(pending, 'LayPrivateTile', {
                  privateCompanyId: 'MF',
                  companyId,
                  locationId,
                  definitionId,
                  rotation,
                  nodeMapping,
                  expectedCost: cost
              })
            : action(pending, 'ContinueOperatingRound', { companyId: 'AR' })
        const resolved = engine.executeCanonicalAction({ game, state: pending, action: choice })
        expect(resolved.updatedState.privatePowerWindow).toBeUndefined()
        expect(resolved.updatedState.machineState).toBe('LayingTrack')
        expect(resolved.updatedState.trackStep?.companyId).toBe('AR')
        expect(resolved.updatedState.usedPrivatePowerIds.includes('MF')).toBe(use)
        let undone = resolved.updatedState
        for (const processed of [...resolved.processedActions].reverse())
            undone = engine.undoProcessedAction({ state: undone, action: processed })
        expect(undone).toEqual(pending)
    }
)
it('Hunslet resolves compulsory discards before returning to construction', () => {
    const { game, engine, state } = example(Top, 'powers')
    state.phaseId = '6H'
    const hunslet = state.certificates.find((item) => item.companyId === 'HS')!
    if (hunslet.retired) throw Error('Expected private')
    hunslet.owner = { kind: 'company', companyId: 'ML' }
    const depot = TheOldPrinceTrainRules.depot
    state.trainInventory = depot.createInventory()
    for (const rank of ['5H', '5H', '6H']) {
        const train = depot.nextTrain(state.trainInventory, rank)!
        depot.purchase(state.trainInventory, train.id, rank, { kind: 'company', companyId: 'ML' })
    }
    const ranks = depot.definition.supply.map((entry) => entry.definitionId)
    state.trainInventory.trains = state.trainInventory.trains.map((train) =>
        train.status === 'depot' && ranks.indexOf(train.definitionId) < ranks.indexOf('2+')
            ? { id: train.id, definitionId: train.definitionId, status: 'removed' }
            : train
    )
    const train = depot.nextTrain(state.trainInventory, '2+')!
    const bought = engine.executeCanonicalAction({
        game,
        state,
        action: action(state, 'BuyPrivateTrain', {
            privateCompanyId: 'HS',
            companyId: 'ML',
            trainId: train.id,
            definitionId: '2+',
            expectedPrice: 220
        })
    }).updatedState
    expect(bought.machineState).toBe('DiscardingTrains')
    expect(bought.phaseChange?.continuation).toEqual({
        machineState: 'LayingTrack',
        companyId: 'ML'
    })
    expect(engine.getValidActionTypesForPlayer(game, bought, 'alex')).toEqual(['DiscardTrain'])
    const discarded = engine.executeCanonicalAction({
        game,
        state: bought,
        action: action(bought, 'DiscardTrain', {
            companyId: 'ML',
            trainId: trainsOwnedBy(bought, { kind: 'company', companyId: 'ML' })[0].id
        })
    }).updatedState
    expect(discarded.machineState).toBe('LayingTrack')
    expect(discarded.trackStep).toEqual(state.trackStep)
    expect(discarded.trainPurchaseStep).toBeUndefined()
    expect(discarded.phaseChange).toBeUndefined()
})
