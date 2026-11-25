import { LoanSettlements, PhaseNationalisation } from '@tabletop/18xx'
import { CnId } from './companies.js'
import { LoanRules1867 } from './loans.js'
import { MontrealLocationId } from './map.js'
import { CnStations, cnMontrealStationDue, nationalise1867 } from './national.js'
import { EndingRules1867, OperatingRules1867, PhaseRules1867 } from './operating.js'
import { PrivateCatalog1867, PrivateIds1867 } from './privates.js'
import { requireState1867, type StateHandler1867 } from './state.js'
import {
    MajorStartPhaseId,
    MinorAuctionEndPhaseId,
    MinorNationalisationPhaseId,
    PrivateNationalisationPhaseId,
    TrainlessNationalisationPhaseIds
} from './trains.js'

/**
 * Phase 4 starts the CN's exports, phase 5 withdraws the unsold minors, phase 6 nationalises the
 * privates, phase 8 every minor; phases 4, 6 and 8 nationalise trainless minors that have
 * operated and let trainless majors' presidents choose (GTG §10, §11).
 */
export const PhaseNationalisation1867 = new PhaseNationalisation({
    nationalId: CnId,
    phases: {
        nationalStart: MajorStartPhaseId,
        minorAuctionEnd: MinorAuctionEndPhaseId,
        privateNationalisation: PrivateNationalisationPhaseId,
        final: MinorNationalisationPhaseId,
        trainlessNationalisation: TrainlessNationalisationPhaseIds
    },
    operatingRules: OperatingRules1867,
    phaseRules: PhaseRules1867,
    endingRules: EndingRules1867,
    privateIds: PrivateIds1867,
    privateFaceValue: (privateId) => PrivateCatalog1867.definition(privateId).faceValue,
    nationalise: (state, companyId, operatingCompanyId) =>
        nationalise1867(requireState1867(state), companyId, operatingCompanyId)
    // The CN's Montreal station comes only with the grey tile, not at phase 8 as GTG §8.13 adds:
    // the designer rules his Rules of Play definitive (RoP §7.4).
})

/** Interest and repayments as a company comes to buy trains; unpaid interest nationalises (GTG §8.10). */
export const LoanSettlements1867 = new LoanSettlements(LoanRules1867, (state, companyId) =>
    nationalise1867(requireState1867(state), companyId)
)

export const NationalActions1867 = CnStations.actions()

/** Montreal's grey tile gives the CN its station there at once (RoP §7.4). */
export function placesMontrealStation(handler: StateHandler1867): StateHandler1867 {
    return CnStations.placesKeptStation(handler, (state) =>
        cnMontrealStationDue(state) ? MontrealLocationId : undefined
    )
}
