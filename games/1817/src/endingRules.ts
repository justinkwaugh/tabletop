import {
    certificateWealthItem,
    getCompany,
    marketShareValue,
    solventPlayerCount,
    type EndingRules
} from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'
import { EighteenSeventeenPrivateCatalog } from './privates.js'
export const EighteenSeventeenEndingRules: EndingRules = {
    // The game ends at once when one player is left solvent. Otherwise the first 8-train,
    // bought or exported, makes the next set the last: 3 rounds after an 8 in a set's second
    // round, 2 otherwise.
    trigger(state) {
        if (solventPlayerCount(state) <= 1) return { reason: 'Bankruptcy' }
        const eightLeftDepot = state.trainInventory.trains.some(
            (train) => train.definitionId === '8' && train.status !== 'depot'
        )
        if (!eightLeftDepot) return undefined
        const set = state.operatingSet
        assertExists(set, 'An 8-train leaves the depot during an operating set')
        return {
            reason: 'First 8-train',
            finalOperatingSet: set.number + 1,
            finalOperatingRounds: set.roundNumber === 2 ? 3 : 2
        }
    },
    certificateItems(state, certificate) {
        const company = getCompany(state, certificate.companyId)
        let value = 0
        if (!company.closed) {
            value =
                certificate.kind === 'share'
                    ? marketShareValue(state, certificate)
                    : EighteenSeventeenPrivateCatalog.faceValue(company.id)
        }
        return [certificateWealthItem(state, certificate, value)]
    }
}
