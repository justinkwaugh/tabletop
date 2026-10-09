import {
    type EighteenFortySixProjectedState,
    EighteenFortySixStateDefinition,
    type HydratedEighteenFortySixState,
    StockRules1846,
    CompanyRules1846,
    OperatingRules1846,
    StationRules1846,
    TrackRules1846,
    RouteRules1846,
    EarningsRules1846,
    TrainRules1846,
    Phases1846,
    PhaseRules1846,
    TransferRules1846,
    EndingRules1846,
    Names1846
} from '@tabletop/1846'
import type { EighteenXXSessionRules } from '@tabletop/18xx-ui'
import { CompanyDescriptions } from './companyDescriptions.js'

export const SessionRules1846: EighteenXXSessionRules<
    typeof EighteenFortySixProjectedState,
    HydratedEighteenFortySixState
> = {
    state: EighteenFortySixStateDefinition,
    names: Names1846,
    stockRules: StockRules1846,
    companyRules: CompanyRules1846,
    operatingRules: OperatingRules1846,
    stationRules: StationRules1846,
    trackRules: TrackRules1846,
    routeRules: RouteRules1846,
    earningsRules: EarningsRules1846,
    trainRules: TrainRules1846,
    phases: Phases1846,
    phaseRules: PhaseRules1846,
    transferRules: TransferRules1846,
    endingRules: EndingRules1846,
    privateRules: {
        exchangeTerms: () => undefined,
        phaseEffects: () => [],
        operationEffects: () => [],
        description: (_state, id) => CompanyDescriptions[id] ?? ''
    },
    privatePowerRules: {
        trackTerms: () => undefined,
        earlyTrainCompany: () => undefined
    }
}
