import type { EighteenSeventeenStateHandler } from './state.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    assert,
    type HydratedGameState
} from '@tabletop/common'
import {
    SizedCompanyStations,
    addCompanyStations,
    closePrivate,
    privateOwningCompany,
    type StationState,
    type StockState,
    SystemActionFirstHandler
} from '@tabletop/18xx'
import { EighteenSeventeenCompanyMarket } from './marketZones.js'
import { StationSubsidyId, companyHolding } from './privateHolders.js'

export const StationsBySize: Readonly<Record<number, number>> = { 2: 1, 5: 2, 10: 4 }
export const StationPrice = 50
export const StationLimit = 8
export const TrainStationId = 'TS'
// The Station Subsidy's company pays $50 less for the stations it buys when it converts.
const StationSubsidy = 50

/** A company needs 1, 2 or 4 stations for its size, at $50 beyond its home, and holds 8 at most. */
export const EighteenSeventeenStations = new SizedCompanyStations(EighteenSeventeenCompanyMarket, {
    bySize: StationsBySize,
    price: StationPrice,
    limit: StationLimit,
    afterStationsBought: grantTrainStation,
    conversionDiscount: (state, companyId) =>
        companyHolding(state, StationSubsidyId) === companyId ? StationSubsidy : 0
})

// The Train Station's free station comes beyond those the company's size needs, so it waits
// until those are bought; its only power used, the private closes.
function grantTrainStation(state: StockState & StationState, companyId: string): void {
    if (
        privateOwningCompany(state, TrainStationId) !== companyId ||
        EighteenSeventeenStations.stationsOwed(state, companyId)
    )
        return
    addCompanyStations(state, companyId, 1)
    closePrivate(state, TrainStationId)
}

const CloseFields = Type.Object({
    type: Type.Literal('CloseTrainStation'),
    companyId: Type.String()
})
export const CloseTrainStation: Type.TObject<
    Omit<typeof GameAction.properties, 'type'> & typeof CloseFields.properties
> = Type.Object(
    { ...GameAction.properties, ...CloseFields.properties },
    { additionalProperties: false }
)
export type CloseTrainStation = Type.Static<typeof CloseTrainStation>
const CloseValidator = Compile(CloseTrainStation)
export function isCloseTrainStation(action: GameAction): action is CloseTrainStation {
    return (
        action instanceof HydratedCloseTrainStation ||
        (action.type === 'CloseTrainStation' && CloseValidator.Check(action))
    )
}
export class HydratedCloseTrainStation
    extends HydratableAction<typeof CloseTrainStation>
    implements CloseTrainStation
{
    declare type: 'CloseTrainStation'
    declare companyId: string
    constructor(data: CloseTrainStation) {
        super(data instanceof HydratedCloseTrainStation ? data.dehydrate() : data, CloseValidator)
    }
    apply(state: HydratedGameState & StockState): void {
        assert(
            this.source === ActionSource.System &&
                privateOwningCompany(state, TrainStationId) === this.companyId,
            'The Train Station closes with its company’s stock round'
        )
        closePrivate(state, TrainStationId)
    }
}

/** A company's Train Station closes as the stock round ends, whether or not it gave a station. */
export function closesTrainStation(
    handler: EighteenSeventeenStateHandler
): EighteenSeventeenStateHandler {
    return new SystemActionFirstHandler(handler, CloseTrainStation, (state) => {
        const companyId = privateOwningCompany(state, TrainStationId)
        return companyId ? { companyId } : undefined
    })
}
