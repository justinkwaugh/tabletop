import { BankruptcyFields } from './bankruptcy.js'
import { EmergencyFundingFields } from './emergencyFunding.js'
import { AcquisitionFields } from './acquisitions.js'
import { RevenueMarkerFields } from './revenueMarkers.js'
import { SteamboatFields } from './steamboat.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameState, HydratableGameState, Visibility, type PlayerState } from '@tabletop/common'
import {
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
    validateFinances
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
export const EighteenFortySixState = Type.Object(
    {
        ...GameState.properties,
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
        ...StockCompanyFields,
        stockMarket: StockMarket,
        stockRound: StockRound,
        companies: Type.Array(OrdinaryCompany),
        certificates: Type.Array(OrdinaryCertificate),
        ...StationFields,
        trainInventory: TrainInventory,
        trainPurchaseStep: Type.Optional(TrainPurchaseStep),
        machineState: Type.Union([
            Type.Literal('Drafting'),
            Type.Literal('RevealingDraft'),
            Type.Literal('BuyingOpeningCompanies'),
            Type.Literal('StockRound'),
            Type.Literal('PreparingOperatingSet'),
            Type.Literal('StartingOperatingRound'),
            Type.Literal('StartingOperatingTurn'),
            Type.Literal('LayingTrack'),
            Type.Literal('AssigningSteamboat'),
            Type.Literal('RunningTrains'),
            Type.Literal('SettlingIndependent'),
            Type.Literal('CorporateFinance'),
            Type.Literal('DistributingEarnings'),
            Type.Literal('ClosingOperatingCorporation'),
            Type.Literal('BuyingTrains'),
            Type.Literal('FundingTrain'),
            Type.Literal('RunningReceiver'),
            Type.Literal('SettlingReceiver'),
            Type.Literal('BuyingReceiverTrain'),
            Type.Literal('FinishingReceiverTurn'),
            Type.Literal('GameOver'),
            Type.Literal('ClosingFundingCorporation'),
            Type.Literal('AdvancingPhase'),
            Type.Literal('DiscardingTrains'),
            Type.Literal('RustingTrains'),
            Type.Literal('OperatingSet')
        ]),
        priorityDealPlayerId: Id,
        removedPrivateIds: Type.Array(Id, { uniqueItems: true }),
        removedCorporationIds: Type.Array(Id, { uniqueItems: true }),
        draft: Type.Union([HiddenDistribution, PublicDistribution]),
        purchases: Type.Array(Purchase)
    },
    { additionalProperties: false }
)
export type EighteenFortySixState = Type.Static<typeof EighteenFortySixState>
export const CanonicalValidator = Compile(EighteenFortySixState)
export const EighteenFortySixProjectedState =
    Visibility.createProjectionSchema(EighteenFortySixState)
export type EighteenFortySixProjectedState = Type.Static<typeof EighteenFortySixProjectedState>
export const ProjectedValidator = Compile(EighteenFortySixProjectedState)
export class HydratedEighteenFortySixState
    extends HydratableGameState<typeof EighteenFortySixProjectedState, PlayerState>
    implements EighteenFortySixProjectedState
{
    declare bankruptPlayerIds: string[]
    declare finalWealth?: EighteenFortySixProjectedState['finalWealth']
    declare gameEnding?: EighteenFortySixProjectedState['gameEnding']
    declare emergencyFunding?: EighteenFortySixProjectedState['emergencyFunding']
    declare earningsDistribution?: EighteenFortySixProjectedState['earningsDistribution']
    declare steamboat?: EighteenFortySixProjectedState['steamboat']
    declare routeStep?: EighteenFortySixProjectedState['routeStep']
    declare tileInventory: EighteenFortySixProjectedState['tileInventory']
    declare operatingSet?: EighteenFortySixProjectedState['operatingSet']
    declare stationStep?: EighteenFortySixProjectedState['stationStep']
    declare trackStep?: EighteenFortySixProjectedState['trackStep']
    declare phaseEvents: EighteenFortySixProjectedState['phaseEvents']
    declare phaseChange?: EighteenFortySixProjectedState['phaseChange']
    declare purchaseOffer?: EighteenFortySixProjectedState['purchaseOffer']
    declare independentAcquisitions: EighteenFortySixProjectedState['independentAcquisitions']
    declare revenueMarkers: EighteenFortySixProjectedState['revenueMarkers']
    declare usedPrivatePowerIds: string[]
    declare pendingRevenueMarker?: EighteenFortySixProjectedState['pendingRevenueMarker']
    declare phaseId: string
    declare stockMarket: EighteenFortySixProjectedState['stockMarket']
    declare stockRound: EighteenFortySixProjectedState['stockRound']
    declare machineState: EighteenFortySixProjectedState['machineState']
    declare companies: EighteenFortySixProjectedState['companies']
    declare bank: EighteenFortySixProjectedState['bank']
    declare certificatePools: EighteenFortySixProjectedState['certificatePools']
    declare certificates: EighteenFortySixProjectedState['certificates']
    declare cash: EighteenFortySixProjectedState['cash']
    declare stations: EighteenFortySixProjectedState['stations']
    declare stationReservations: EighteenFortySixProjectedState['stationReservations']
    declare trainPurchaseStep?: EighteenFortySixProjectedState['trainPurchaseStep']
    declare trainInventory: EighteenFortySixProjectedState['trainInventory']
    declare priorityDealPlayerId: string
    declare removedPrivateIds: string[]
    declare removedCorporationIds: string[]
    declare draft: EighteenFortySixProjectedState['draft']
    declare purchases: EighteenFortySixProjectedState['purchases']
    constructor(data: EighteenFortySixProjectedState) {
        super(data, ProjectedValidator)
        validateFinances(
            this,
            this.players.map((player) => player.playerId)
        )
    }
}
