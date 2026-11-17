import { LoanSettlements, PhaseNationalisation, nextOperatingCompany } from '@tabletop/18xx'
import { RsrId } from './companies.js'
import { LoanRules1861 } from './loans.js'
import { MoscowLocationId, StPetersburgLocationId } from './map.js'
import { RsrStations, nationalise1861, placeRsrHome, rsrOperates } from './national.js'
import { EndingRules1861, OperatingRules1861, PhaseRules1861 } from './operating.js'
import { PrivateCatalog1861, PrivateIds1861 } from './privates.js'
import { requireState1861, type HydratedState1861, type StateHandler1861 } from './state.js'
import { MoscowGreyTileId } from './tiles.js'
import {
    MajorStartPhaseId,
    MinorAuctionEndPhaseId,
    MinorNationalisationPhaseId,
    PrivateNationalisationPhaseId,
    TrainlessNationalisationPhaseIds
} from './trains.js'

/**
 * Phase 4 starts the RSR, phase 5 withdraws the unsold minors, phase 6 nationalises the
 * privates, phase 8 every minor; phases 4, 6 and 8 nationalise trainless minors that have
 * operated and let trainless public companies' directors choose (§8, §11).
 */
export const PhaseNationalisation1861 = new PhaseNationalisation({
    nationalId: RsrId,
    phases: {
        nationalStart: MajorStartPhaseId,
        minorAuctionEnd: MinorAuctionEndPhaseId,
        privateNationalisation: PrivateNationalisationPhaseId,
        final: MinorNationalisationPhaseId,
        trainlessNationalisation: TrainlessNationalisationPhaseIds
    },
    operatingRules: OperatingRules1861,
    phaseRules: PhaseRules1861,
    endingRules: EndingRules1861,
    privateIds: PrivateIds1861,
    privateFaceValue: (privateId) => PrivateCatalog1861.definition(privateId).faceValue,
    nationalise: (state, companyId, operatingCompanyId) =>
        nationalise1861(requireState1861(state), companyId, operatingCompanyId),
    // The RSR operates from the round in which the first 4-train is bought (§7.4).
    nationalStarted(state) {
        const set = state.operatingSet
        if (set && !set.completed && !set.companyOrder.includes(RsrId) && rsrOperates(state))
            set.companyOrder = [...set.companyOrder, RsrId]
    },
    // The RSR no longer operates once the first 8-train is bought (§7.4).
    finalPhaseBegins(state) {
        const set = state.operatingSet
        if (set && nextOperatingCompany(state) !== RsrId)
            set.companyOrder = set.companyOrder.filter(
                (id) => id !== RsrId || set.completedCompanyIds.includes(id)
            )
    },
    // The RSR places its St. Petersburg station if it never operated (GTG §11). Its Moscow
    // station comes only with the grey tile, not at phase 8 as GTG §8.13 adds: the designer rules
    // the All-Aboard text definitive (§7.4).
    placeReservedStations: (state) =>
        placeRsrHome(requireState1861(state)) ? [StPetersburgLocationId] : []
})

/** Interest and repayments as a company comes to buy trains; unpaid interest nationalises (§10.8). */
export const LoanSettlements1861 = new LoanSettlements(LoanRules1861, (state, companyId) =>
    nationalise1861(requireState1861(state), companyId)
)

/** The RSR's first operation puts its St. Petersburg station down (§7.4). */
function rsrHomeDue(state: HydratedState1861): boolean {
    return (
        nextOperatingCompany(state) === RsrId &&
        !state.trackStep &&
        !RsrStations.placedIn(state, StPetersburgLocationId)
    )
}

export const NationalActions1861 = RsrStations.actions()

/** Between companies: a trainless finisher is nationalised, and the RSR's home placed (§7.4, §10.10). */
export function nationalisesBetweenCompanies(handler: StateHandler1861): StateHandler1861 {
    return PhaseNationalisation1861.nationalisesTrainlessFinishers(
        RsrStations.placesKeptStation(handler, (state) =>
            rsrHomeDue(state) ? StPetersburgLocationId : undefined
        )
    )
}

/** A Moscow upgrade to grey gives the RSR its station there at once (§7.4). */
export function placesMoscowStation(handler: StateHandler1861): StateHandler1861 {
    return RsrStations.placesKeptStation(handler, (state) =>
        RsrStations.keptStationDue(state, MoscowLocationId, MoscowGreyTileId)
            ? MoscowLocationId
            : undefined
    )
}
