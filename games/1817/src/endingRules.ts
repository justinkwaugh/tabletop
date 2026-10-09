import { EighteenSeventeenMarket } from './stockMarket.js'
import {
    certificateWealthItem,
    getCompany,
    marketShareValue,
    solventPlayerCount,
    type EndingRules
} from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'
import { acquisitionRoundPending } from './acquisitionRound.js'
import { EighteenSeventeenPrivateCatalog } from './privates.js'
import { EighteenSeventeenPhases } from './trains.js'
export const EighteenSeventeenEndingRules: EndingRules = {
    // The game ends at once when one player is left solvent. Otherwise the first 8-train,
    // bought or exported, makes the next set the last: 3 rounds after an 8 in a set's second
    // round, 2 otherwise. That train starts phase 8.
    trigger(state) {
        if (solventPlayerCount(state) <= 1) return { reason: 'Bankruptcy' }
        if (!EighteenSeventeenPhases.isAtLeast(state.phaseId, '8')) return undefined
        const set = state.operatingSet
        assertExists(set, 'An 8-train leaves the depot during an operating set')
        return {
            reason: 'First 8-train',
            finalOperatingSet: set.number + 1,
            finalOperatingRounds: set.roundNumber === 2 ? 3 : 2
        }
    },
    // The final set ends after its last operating round's merger and acquisition rounds.
    roundPending: acquisitionRoundPending,
    certificateItems(state, certificate) {
        const company = getCompany(state, certificate.companyId)
        let value = 0
        if (!company.closed) {
            value =
                certificate.kind === 'private'
                    ? EighteenSeventeenPrivateCatalog.faceValue(company.id)
                    : marketShareValue(EighteenSeventeenMarket, state, certificate)
        }
        return [certificateWealthItem(state, certificate, value)]
    }
}
