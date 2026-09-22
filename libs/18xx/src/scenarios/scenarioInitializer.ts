import { assert, type Game, type PlayerState, type UninitializedGameState } from '@tabletop/common'
import { Compile } from 'typebox/compile'
import { EighteenXXInitializer } from '../game/eighteenXXInitializer.js'
import type { HydratedEighteenXXState } from '../game/eighteenXXState.js'
import type { EighteenXXTitleRules } from '../game/eighteenXXTitleRules.js'
import type { InitialPosition } from '../game/opening.js'
import { StationPlacement, applyStationPlacement } from '../stations/stationPlacement.js'
import { controllingOwner } from '../finance/finance.js'
import { privateIncomePayments } from '../operating/startOperatingRound.js'
import { settleCashPayments } from '../finance/cashPayments.js'
import type { StockMarket } from '../stock/stockMarket.js'
import { ScenarioPosition } from './scenarioPosition.js'

export type PreparedPosition = Exclude<ScenarioPosition, 'opening' | 'ending'>
export interface ScenarioFixtures {
    createMarket(position: PreparedPosition): StockMarket
    createFinances(
        players: readonly PlayerState[],
        position: PreparedPosition
    ): Omit<InitialPosition, 'stockMarket'>
    prepareEnding(state: HydratedEighteenXXState): void
}

const PositionValidator = Compile(ScenarioPosition)
const OperatingPositions: readonly ScenarioPosition[] = [
    'construction',
    'stations',
    'trains',
    'routes',
    'operations',
    'phases',
    'diesel',
    'private-events',
    'transfers',
    'powers',
    'funding',
    'funding-chain',
    'bankruptcy'
]
const TrainBuyingPositions: readonly ScenarioPosition[] = [
    'trains',
    'phases',
    'diesel',
    'private-events',
    'transfers',
    'funding',
    'funding-chain',
    'bankruptcy'
]

export class ScenarioInitializer extends EighteenXXInitializer {
    constructor(
        private readonly titleRules: EighteenXXTitleRules,
        private readonly fixtures: ScenarioFixtures
    ) {
        super(titleRules)
    }
    override initializeGameState(
        game: Game,
        state: UninitializedGameState
    ): HydratedEighteenXXState {
        const requested = game.config?.examplePosition ?? 'opening'
        assert(PositionValidator.Check(requested), 'Unknown scenario position')
        if (requested === 'opening') return super.initializeGameState(game, state)
        const position: PreparedPosition = requested === 'ending' ? 'trains' : requested
        assert(
            game.players.length === 3 || game.players.length === 4,
            'Prepared scenarios support three or four players'
        )
        const initialized = this.createInitialState(game, state, {
            stockRoundNumber: 2,
            position: {
                ...this.fixtures.createFinances(this.playerStates(game), position),
                stockMarket: this.fixtures.createMarket(position)
            }
        })
        this.applyPhaseEffects(initialized)
        if (OperatingPositions.includes(position)) this.enterOperatingStep(initialized, position)
        if (requested === 'ending') {
            this.fixtures.prepareEnding(initialized)
            this.applyPhaseEffects(initialized)
        }
        return initialized
    }
    private enterOperatingStep(state: HydratedEighteenXXState, position: PreparedPosition): void {
        const { operatingRules, stationRules } = this.titleRules
        const companyOrder = operatingRules.companyOrder(state)
        const companyId = companyOrder[0]
        const owner = controllingOwner(state, companyId)
        assert(owner, 'Operating scenarios require a controlling owner')
        state.stockRound.completed = true
        state.operatingSet = {
            number: 1,
            roundNumber: 1,
            roundCount: operatingRules.roundCount(state),
            companyOrder,
            completedCompanyIds: [],
            privateIncomePaid: true,
            completed: false
        }
        state.trackStep = { companyId, lays: [], completed: false }
        state.machineState = 'LayingTrack'
        for (const home of new StationPlacement(state, stationRules).homePlacements())
            applyStationPlacement(state, home)
        if (position === 'stations') {
            state.trackStep.completed = true
            state.stationStep = { companyId, placedStationIds: [], completed: false }
            state.machineState = 'PlacingStation'
        }
        if (TrainBuyingPositions.includes(position)) {
            delete state.trackStep
            state.trainPurchaseStep = { companyId, purchasedTrainIds: [] }
            state.machineState = 'BuyingTrains'
        }
        if (position === 'routes') {
            delete state.trackStep
            state.routeStep = { companyId }
            state.machineState = 'RunningTrains'
        }
        if (position === 'operations') settleCashPayments(state, privateIncomePayments(state))
        state.activePlayerIds = [owner.playerId]
        state.turnManager.series = [{ type: 'turn', playerId: owner.playerId, start: 0 }]
    }
}
