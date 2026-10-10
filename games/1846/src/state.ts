import { BankruptcyFields } from './bankruptcy.js'
import { EmergencyFundingFields } from './emergencyFunding.js'
import { AcquisitionFields } from './acquisitions.js'
import { RevenueMarkerFields } from './revenueMarkers.js'
import { SteamboatFields } from './steamboat.js'
import { FinanceStep } from './corporateFinance.js'
import { EighteenFortySixMap } from './map.js'
import { EighteenFortySixTileSet } from './tiles.js'
import { TrainDepot1846 } from './trains.js'
import { Market1846 } from './stock.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Visibility } from '@tabletop/common'
import {
    composeEighteenXXState,
    defineEighteenXXState,
    type HydratedEighteenXXState,
    EndingFields,
    GameEnding,
    PhaseFields,
    PrivatePowerFields,
    CompanyAcquisitionOfferFields,
    FinanceFields,
    EarningsFields,
    MapFields,
    RouteFields,
    OperatingSet,
    TrackStep,
    StationStep,
    StockMarket,
    StockRound,
    StockCompanyFields,
    OrdinaryCompany,
    OrdinaryCertificate,
    StationFields,
    TrainInventory,
    TrainPurchaseStep,
    validateCompanyDecisions,
    validateFinalResults,
    validateOperatingSet,
    validatePhaseChange,
    validateRailwayComponents,
    validateRouteStep,
    validateStockRound,
    validateTrainPurchaseStep,
    type TitleComponents
} from '@tabletop/18xx'

const Id = Type.String({ minLength: 1 })
export const Selection = Type.Object(
    { cardId: Id, price: Type.Integer({ minimum: 0 }) },
    { additionalProperties: false }
)
export const Purchase = Type.Object(
    { ...Selection.properties, playerId: Id },
    { additionalProperties: false }
)
const Participant = Type.Object(
    {
        playerId: Id,
        packet: Visibility.protect(Type.Array(Id), { policy: Visibility.Policy.Owner }),
        selections: Visibility.protect(Type.Array(Selection), { policy: Visibility.Policy.Owner })
    },
    { additionalProperties: false }
)
const HiddenDistribution = Type.Object(
    {
        kind: Type.Literal('hidden'),
        deck: Visibility.protect(Type.Array(Id), { policy: Visibility.Policy.HostOnly }),
        participants: Type.Array(Participant),
        remainingCount: Type.Integer({ minimum: 0 }),
        finalOffer: Type.Optional(Selection)
    },
    { additionalProperties: false }
)
const PublicDistribution = Type.Union([
    Type.Object(
        {
            kind: Type.Literal('public'),
            stage: Type.Literal('buying'),
            passedPlayerIds: Type.Array(Id, { uniqueItems: true }),
            finalOffer: Type.Optional(Selection)
        },
        { additionalProperties: false }
    ),
    Type.Object(
        {
            kind: Type.Literal('public'),
            stage: Type.Union([Type.Literal('operating'), Type.Literal('complete')])
        },
        { additionalProperties: false }
    )
])
export const EighteenFortySixState = composeEighteenXXState(
    {
        ...FinanceFields,
        ...EndingFields,
        gameEnding: Type.Optional(GameEnding),
        ...BankruptcyFields,
        ...PhaseFields,
        ...AcquisitionFields,
        ...EmergencyFundingFields,
        ...RevenueMarkerFields,
        ...PrivatePowerFields,
        ...CompanyAcquisitionOfferFields,
        ...EarningsFields,
        ...MapFields,
        ...RouteFields,
        ...SteamboatFields,
        operatingSet: Type.Optional(OperatingSet),
        trackStep: Type.Optional(TrackStep),
        stationStep: Type.Optional(StationStep),
        financeStep: Type.Optional(FinanceStep),
        ...StockCompanyFields,
        stockMarket: StockMarket,
        stockRound: StockRound,
        companies: Type.Array(OrdinaryCompany),
        certificates: Type.Array(OrdinaryCertificate),
        ...StationFields,
        trainInventory: TrainInventory,
        trainPurchaseStep: Type.Optional(TrainPurchaseStep),
        removedCorporationIds: Type.Array(Id, { uniqueItems: true }),
        draft: Type.Union([HiddenDistribution, PublicDistribution]),
        purchases: Type.Array(Purchase)
    },
    [
        'Drafting',
        'RevealingDraft',
        'BuyingOpeningCompanies',
        'StockRound',
        'PreparingOperatingSet',
        'StartingOperatingRound',
        'StartingOperatingTurn',
        'LayingTrack',
        'AssigningSteamboat',
        'RunningTrains',
        'SettlingIndependent',
        'DistributingEarnings',
        'ClosingOperatingCorporation',
        'BuyingTrains',
        'FundingTrain',
        'RunningReceiver',
        'SettlingReceiver',
        'BuyingReceiverTrain',
        'FinishingReceiverTurn',
        'GameOver',
        'ClosingFundingCorporation',
        'AdvancingPhase',
        'DiscardingTrains',
        'RustingTrains',
        'OperatingSet'
    ]
)
export type EighteenFortySixState = Type.Static<typeof EighteenFortySixState>
export const CanonicalValidator = Compile(EighteenFortySixState)
export const EighteenFortySixProjectedState =
    Visibility.createProjectionSchema(EighteenFortySixState)
export type EighteenFortySixProjectedState = Type.Static<typeof EighteenFortySixProjectedState>
export type HydratedEighteenFortySixState = HydratedEighteenXXState<
    typeof EighteenFortySixProjectedState
>
export const EighteenFortySixStateDefinition = defineEighteenXXState(
    EighteenFortySixProjectedState,
    [validate1846State]
)

function validate1846State(state: HydratedEighteenFortySixState, components: TitleComponents) {
    validateStockRound(state)
    validateOperatingSet(state)
    validateFinalResults(state)
    validateCompanyDecisions(state)
    validateRouteStep(state)
    validatePhaseChange(state)
    validateTrainPurchaseStep(state)
    validateRailwayComponents(state, components)
}

export function hydrateEighteenFortySixState(data: unknown): HydratedEighteenFortySixState {
    return EighteenFortySixStateDefinition.hydrate(data, {
        map: EighteenFortySixMap,
        tileSet: EighteenFortySixTileSet,
        depot: TrainDepot1846,
        market: Market1846
    })
}
