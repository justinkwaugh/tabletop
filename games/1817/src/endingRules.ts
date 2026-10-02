import {
    certificateWealthItem,
    getCompany,
    marketShareValue,
    type EndingRules
} from '@tabletop/18xx'
import { EighteenSeventeenPrivateCatalog } from './privates.js'
export const EighteenSeventeenEndingRules: EndingRules = {
    // The first 8-train, bought or exported, makes the next set the last: 3 rounds after an 8
    // in a set's second round, 2 otherwise.
    trigger(state) {
        const firstEight = state.trainInventory.trains.some(
            (train) => train.definitionId === '8' && train.status !== 'depot'
        )
        const set = state.operatingSet
        if (!firstEight || !set) return undefined
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
