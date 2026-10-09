import type { TitleComponents } from './titleComponents.js'
import {
    GameState,
    Visibility,
    type Color,
    type GameResult,
    HydratableGameState,
    assert,
    type HydratedGameState,
    type PlayerState
} from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { OfferPileFields } from '../auctions/offerPileAuction.js'
import { SelectionAuctionFields } from '../auctions/selectionAuction.js'
import { AuctionFields } from '../auctions/waterfallAuction.js'
import { CompanyFields, CompanyTranche, OwnershipLimitExemption } from '../company/companyState.js'
import { PendingParFields } from '../company/pendingPar.js'
import { TrackStep, validateTrackStep } from '../construction/trackConstruction.js'
import { EarningsFields, validateEarningsDistribution } from '../earnings/earningsDistribution.js'
import { EndingFields, validateFinalResults } from '../ending/finalWealth.js'
import { GameEnding } from '../ending/gameEnding.js'
import {
    FinanceFields,
    OrdinaryCertificate,
    OrdinaryCompany,
    validateFinances
} from '../finance/finance.js'
import { CashCrisisFields } from '../funding/cashCrisis.js'
import { FundingFields, validateTrainFunding } from '../funding/trainFunding.js'
import { LoanFields } from '../loans/loans.js'
import { LocationMarkerFields } from '../map/locationMarkers.js'
import type { RailwayMap } from '../map/map.js'
import { MapFields, RailwayMapState } from '../map/mapState.js'
import { validateStations } from '../map/station.js'
import { OperatingSet, validateOperatingSet } from '../operating/operatingSet.js'
import { PhaseFields, validatePhaseChange } from '../phases/phaseChange.js'
import type { PhaseTable } from '../phases/phaseTable.js'
import {
    CompanyDecisionFields,
    CompanyAcquisitionOfferFields,
    PurchaseOfferFields,
    validateCompanyDecisions
} from '../privates/companyDecision.js'
import { RouteFields, validateRouteStep } from '../routes/route.js'
import { StationStep, validateStationStep } from '../stations/stationPlacement.js'
import { CompanyAuctionFields } from '../stock/companyAuction.js'
import { StockMarket, validateStockMarket } from '../stock/stockMarket.js'
import { StockRound, validateStockRound } from '../stock/stockRound.js'
import { StockTurnPurchaseFields } from '../stock/turnPurchases.js'
import type { TileSet } from '../tiles/inventory.js'
import { TrainFields, validateTrainPurchaseStep } from '../trains/train.js'
import type { TrainDepot } from '../trains/trainDepot.js'

export const RailwayMachineStates = [
    'StockRound',
    'StartingOperatingSet',
    'OperatingSet',
    'LayingTrack',
    'PlacingStation',
    'StationsComplete',
    'BuyingTrains',
    'FundingTrain',
    'Bankrupt',
    'GameOver',
    'AdvancingPhase',
    'DiscardingTrains',
    'RustingTrains',
    'RunningTrains',
    'DistributingEarnings'
] as const
export const OfferAuctionMachineStates = ['OfferingLot', 'OfferBidding'] as const
export const WaterfallAuctionMachineStates = ['WaterfallAuction', 'AuctionBidding'] as const
export const SelectionAuctionMachineStates = ['SelectionAuction'] as const
export const LoanMachineStates = ['RepayingLoans'] as const
export const CashCrisisMachineStates = ['RaisingCash'] as const
export type EighteenXXMachineState =
    | (typeof RailwayMachineStates)[number]
    | (typeof OfferAuctionMachineStates)[number]
    | (typeof WaterfallAuctionMachineStates)[number]
    | (typeof SelectionAuctionMachineStates)[number]
    | (typeof LoanMachineStates)[number]
    | (typeof CashCrisisMachineStates)[number]

export const RailwayFields = {
    // Retained for saved games created before the runtime left the examples folder.
    example: Type.Literal('finances'),
    stockRound: StockRound,
    operatingSet: Type.Optional(OperatingSet),
    trackStep: Type.Optional(TrackStep),
    stationStep: Type.Optional(StationStep),
    stockMarket: StockMarket,
    ...FinanceFields,
    companies: Type.Array(OrdinaryCompany),
    certificates: Type.Array(OrdinaryCertificate),
    ...EndingFields,
    gameEnding: Type.Optional(GameEnding),
    ...FundingFields,
    ...CompanyFields,
    ...MapFields,
    ...TrainFields,
    ...PhaseFields,
    ...EarningsFields,
    ...PurchaseOfferFields,
    ...RouteFields
}
type RuntimeFields = Omit<
    typeof RailwayFields,
    'companies' | 'certificates' | 'example' | 'purchaseOffer'
> &
    typeof FinanceFields &
    Omit<typeof CompanyDecisionFields, 'purchaseOffer'> &
    typeof CompanyAcquisitionOfferFields &
    typeof StockTurnPurchaseFields &
    typeof PendingParFields &
    typeof AuctionFields &
    typeof SelectionAuctionFields &
    typeof OfferPileFields &
    typeof LocationMarkerFields &
    typeof CompanyAuctionFields &
    typeof LoanFields &
    typeof CashCrisisFields & {
        example: Type.TOptional<typeof RailwayFields.example>
        tranches: Type.TOptional<Type.TArray<typeof CompanyTranche>>
        ownershipLimitExemptions: Type.TOptional<Type.TArray<typeof OwnershipLimitExemption>>
    }
// Enum member ordering is not part of the state contract. Declaration emit and
// visibility projection may reorder it while preserving the same value type.
type TitleGameFields = {
    players: Type.TArray<
        Type.TObject<{
            playerId: Type.TString
            color: Type.TEnum<Color[]>
        }>
    >
    result: Type.TOptional<Type.TEnum<GameResult[]>>
    machineState: Type.TString | Type.TUnsafe<string> | Type.TUnion<Type.TLiteral<string>[]>
}
type ProjectedGameStateSchema = ReturnType<
    typeof Visibility.createProjectionSchema<typeof GameState>
>
export type TitleStateSchema =
    | Type.TObject<Omit<typeof GameState.properties, keyof TitleGameFields> & TitleGameFields>
    | Type.TObject<
          Omit<ProjectedGameStateSchema['properties'], keyof TitleGameFields> & TitleGameFields
      >
export type EighteenXXRuntimeSchema = Type.TObject<typeof GameState.properties & RuntimeFields>
export type EighteenXXState<Schema extends TitleStateSchema = EighteenXXRuntimeSchema> =
    Type.Static<Schema>
export type HydratedEighteenXXState<Schema extends TitleStateSchema = EighteenXXRuntimeSchema> =
    HydratedGameState<Type.Static<Schema>> & Type.Static<Schema>

export type ComposedStateSchema<
    Fields extends Type.TProperties,
    Machine extends string
> = Type.TObject<
    Omit<typeof GameState.properties, 'machineState'> &
        Fields & { machineState: Type.TUnsafe<Machine> }
>

export function composeEighteenXXState<
    Fields extends Type.TProperties,
    const States extends readonly string[]
>(fields: Fields, machineStates: States): ComposedStateSchema<Fields, States[number]> {
    for (const name of Object.keys(fields))
        assert(!(name in GameState.properties), `${name} already belongs to the game state`)
    assert(new Set(machineStates).size === machineStates.length, 'Duplicate machine state')
    return Type.Object(
        {
            ...GameState.properties,
            ...fields,
            machineState: Type.Unsafe<States[number]>(
                Type.Union(machineStates.map((name) => Type.Literal(name)))
            )
        },
        { additionalProperties: false }
    )
}

class StateHydrator<Schema extends TitleStateSchema> extends HydratableGameState<
    Schema,
    PlayerState
> {}

export type EighteenXXStateDefinition<
    Schema extends TitleStateSchema = EighteenXXRuntimeSchema,
    State extends HydratedEighteenXXState<Schema> = HydratedEighteenXXState<Schema>
> = {
    schema: Schema
    read(data: unknown): unknown
    hydrate(data: unknown, map: RailwayMap, tileSet: TileSet, depot: TrainDepot): State
}

export function defineEighteenXXState<Schema extends TitleStateSchema>(
    schema: Schema,
    validations: readonly StateValidation<HydratedEighteenXXState<Schema>>[]
): EighteenXXStateDefinition<Schema> {
    const validator = Compile(schema)
    function read(data: unknown): unknown {
        return data instanceof StateHydrator ? data.dehydrate() : data
    }
    return {
        schema,
        read,
        hydrate(data, map, tileSet, depot) {
            const stored = read(data)
            if (!validator.Check(stored)) throw new Error(JSON.stringify(validator.Errors(stored)))
            const core = new StateHydrator(stored, validator)
            const state = Object.assign(core, core.dehydrate(), { turnManager: core.turnManager })
            assert(
                new Set(state.players.map((player) => player.playerId)).size ===
                    state.players.length,
                'Duplicate player identity'
            )
            for (const validate of validations) validate(state, { map, tileSet, depot })
            return state
        }
    }
}

export type StateValidation<State> = (state: State, components: TitleComponents) => void

export const validateRailwayState: StateValidation<EighteenXXState> = (
    state,
    { map, tileSet, depot }
) => {
    validateStockRound(state)
    validateOperatingSet(state)
    validateTrackStep(state)
    validateStationStep(state)
    validateTrainFunding(state)
    validateFinalResults(state)
    validateCompanyDecisions(state)
    validateRouteStep(state)
    validatePhaseChange(state)
    validateEarningsDistribution(state)
    validateTrainPurchaseStep(state)
    new RailwayMapState(map, tileSet, state.tileInventory).validateStations(state)
    const companyIds = state.companies.map((company) => company.id)
    depot.validateInventory(
        state.trainInventory,
        companyIds,
        state.players.map((player) => player.playerId)
    )
    validateStations(state, companyIds)
    validateStockMarket(state.stockMarket, companyIds)
    validateFinances(
        state,
        state.players.map((player) => player.playerId)
    )
}

export function inKnownPhase<State extends HydratedEighteenXXState>(
    state: State,
    phases: PhaseTable
): State {
    assert(phases.has(state.phaseId), `Unknown phase ${state.phaseId}`)
    return state
}
