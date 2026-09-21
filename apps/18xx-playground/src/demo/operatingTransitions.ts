import { expect, it } from 'vitest'
import { ActionSource, GameEngine, PlayerStatus, type GameDefinition } from '@tabletop/common'
import {
    LayingTrackHandler,
    evaluatePurchaseOffer,
    nextOperatingCompany,
    type FinishTrack,
    type FinishStations,
    type CompanyDecisionState,
    type TrackRules,
    type TransferRules,
    type TrainRules
} from '@tabletop/18xx'
import { type EighteenXXState, type HydratedEighteenXXState } from '@tabletop/18xx'

export function operatingTransitionTests(
    definition: GameDefinition<EighteenXXState, HydratedEighteenXXState>,
    trackRules: TrackRules,
    transferRules: TransferRules,
    trainRules: TrainRules
) {
    function fixture() {
        const runtime = definition.runtime
        const engine = new GameEngine(runtime)
        const game = runtime.initializer.initializeGame(
            {
                id: 'transitions',
                typeId: definition.info.id,
                ownerId: 'alex',
                seed: 1889,
                config: { examplePosition: 'construction' },
                players: ['alex', 'blair', 'casey'].map((id) => ({
                    id,
                    name: id,
                    isHuman: true,
                    status: PlayerStatus.Joined
                }))
            },
            definition
        )
        const state = engine.startGame(game).initialState

        return { runtime, engine, game, state }
    }
    it('initializes destination steps and preserves canonical undo/replay across automatic empty runs', async () => {
        const { engine, game, state: initialState } = fixture()
        let state = initialState
        const companyId = state.trackStep!.companyId
        state.trainInventory.trains = state.trainInventory.trains.map((train) =>
            train.status === 'owned' &&
            train.owner.kind === 'company' &&
            train.owner.companyId === companyId
                ? { id: train.id, definitionId: train.definitionId, status: 'removed' }
                : train
        )
        const types: string[] = []
        for (let index = 0; index < 2; index++) {
            const type = index === 0 ? 'FinishTrack' : 'FinishStations'
            if (index === 1 && state.machineState !== 'PlacingStation') break
            const before = structuredClone(state)
            const action: FinishTrack | FinishStations = {
                id: `step-${index}`,
                gameId: game.id,
                type,
                source: ActionSource.User,
                playerId: state.activePlayerIds[0],
                companyId
            }
            const result = engine.executeCanonicalAction({ game, state, action })
            types.push(...result.processedActions.map((action) => action.type))
            let undone = result.updatedState
            for (const action of result.processedActions.toReversed())
                undone = engine.undoProcessedAction({ state: undone, action })
            expect(undone).toEqual(before)
            let replayed = before
            for (const action of result.processedActions)
                replayed = engine.applyProcessedAction({ game, state: replayed, action })
            expect(replayed).toEqual(result.updatedState)
            state = result.updatedState
            if (state.machineState === 'PlacingStation')
                expect(state.stationStep).toEqual({
                    companyId,
                    placedStationIds: [],
                    completed: false
                })
        }
        expect(types).toContain('FinishStations')
        expect(types).toContain('RunTrains')
        expect(types).toContain('DistributeEarnings')
        expect(state.routeStep?.result?.revenue).toBe(0)
        expect(state.earningsDistribution?.choice).toBe('withhold')
        expect(state.trainPurchaseStep).toEqual({ companyId, purchasedTrainIds: [] })
        expect(state.machineState).toBe('BuyingTrains')
    })
    it('allows a composed sequence to enter train running directly after track', () => {
        const { runtime, game, state } = fixture()
        const engine = new GameEngine({
            ...runtime,
            stateHandlers: {
                ...runtime.stateHandlers,
                LayingTrack: new LayingTrackHandler(trackRules, 'RunningTrains')
            }
        })
        const companyId = state.trackStep!.companyId
        const action: FinishTrack = {
            id: 'direct-run',
            gameId: game.id,
            type: 'FinishTrack',
            source: ActionSource.User,
            playerId: state.activePlayerIds[0],
            companyId
        }
        const result = engine.executeCanonicalAction({ game, state, action })
        expect(result.updatedState.stationStep).toBeUndefined()
        expect(result.processedActions.map((action) => action.type)).not.toContain('FinishStations')
        expect(result.updatedState.routeStep?.companyId).toBe(companyId)
    })

    it('lets title transfer policy authorize a differently named operating window', () => {
        const { state } = fixture()
        const companyId = nextOperatingCompany(state)!
        const seller = state.companies.find(
            (company) => company.id !== companyId && company.president
        )!
        const train = state.trainInventory.trains.find((item) => item.status === 'depot')!
        state.trainInventory.trains = state.trainInventory.trains.map((item) =>
            item.id === train.id
                ? {
                      id: item.id,
                      definitionId: item.definitionId,
                      status: 'owned',
                      owner: { kind: 'company', companyId: seller.id }
                  }
                : item
        )
        const alternateState: CompanyDecisionState = state
        alternateState.machineState = 'PurchasingAssets'
        delete state.trainPurchaseStep
        const request = {
            companyId,
            asset: { kind: 'train' as const, trainId: train.id },
            seller: { kind: 'company' as const, companyId: seller.id },
            price: 1
        }
        const alternate: TransferRules = {
            ...transferRules,
            operatingCompany: () => companyId,
            canPurchase: (current) => current.machineState === 'PurchasingAssets'
        }
        expect(evaluatePurchaseOffer(state, request, alternate, trainRules).reason).toBeUndefined()
        expect(
            evaluatePurchaseOffer(state, request, transferRules, trainRules).reason
        ).toBeDefined()
    })
}
