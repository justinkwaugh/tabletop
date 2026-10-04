import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameState, HydratableGameState, Visibility, type PlayerState } from '@tabletop/common'
import {
    FinanceFields,
    MapFields,
    OperatingSet,
    TrackStep,
    StockMarket,
    StockRound,
    StockCompanyFields,
    OrdinaryCompany,
    OrdinaryCertificate,
    StationFields,
    TrainInventory,
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
export const EighteenFortySixState = Type.Object(
    {
        ...GameState.properties,
        ...FinanceFields,
        ...MapFields,
        operatingSet: Type.Optional(OperatingSet),
        trackStep: Type.Optional(TrackStep),
        ...StockCompanyFields,
        stockMarket: StockMarket,
        stockRound: StockRound,
        companies: Type.Array(OrdinaryCompany),
        certificates: Type.Array(OrdinaryCertificate),
        ...StationFields,
        trainInventory: TrainInventory,
        machineState: Type.Union([
            Type.Literal('Drafting'),
            Type.Literal('RevealingDraft'),
            Type.Literal('StockRound'),
            Type.Literal('PreparingOperatingSet'),
            Type.Literal('StartingOperatingRound'),
            Type.Literal('StartingOperatingTurn'),
            Type.Literal('LayingTrack'),
            Type.Literal('ReadyForRoutes')
        ]),
        priorityDealPlayerId: Id,
        removedPrivateIds: Type.Array(Id, { uniqueItems: true }),
        removedCorporationIds: Type.Array(Id, { uniqueItems: true }),
        draft: Type.Object(
            {
                deck: Visibility.protect(Type.Array(Id), { policy: Visibility.Policy.HostOnly }),
                participants: Type.Array(Participant),
                remainingCount: Type.Integer({ minimum: 0 }),
                finalOffer: Type.Optional(Selection)
            },
            { additionalProperties: false }
        ),
        purchases: Type.Array(Purchase)
    },
    { additionalProperties: false }
)
export type EighteenFortySixState = Type.Static<typeof EighteenFortySixState>
export const CanonicalValidator = Compile(EighteenFortySixState)
export const EighteenFortySixProjectedState =
    Visibility.createProjectionSchema(EighteenFortySixState)
export type EighteenFortySixProjectedState = Type.Static<typeof EighteenFortySixProjectedState>
const ProjectedValidator = Compile(EighteenFortySixProjectedState)
export class HydratedEighteenFortySixState
    extends HydratableGameState<typeof EighteenFortySixProjectedState, PlayerState>
    implements EighteenFortySixProjectedState
{
    declare tileInventory: EighteenFortySixProjectedState['tileInventory']
    declare operatingSet?: EighteenFortySixProjectedState['operatingSet']
    declare trackStep?: EighteenFortySixProjectedState['trackStep']
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
