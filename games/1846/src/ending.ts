import { bankExhaustionAtSetEnd, type EndingRules } from '@tabletop/18xx'
import { TrainDepot1846 } from './trains.js'
import { ValuationRules1846 } from './operating.js'

export const EndingRules1846: EndingRules = {
    ...ValuationRules1846,
    trigger(state) {
        if (state.companies.every((company) => company.closed))
            return { reason: 'All companies closed' }
        const bankEnding = bankExhaustionAtSetEnd(state)
        if (bankEnding) return bankEnding
        if (
            state.trainInventory.depotId === '1846:two-player' &&
            TrainDepot1846.remaining(state.trainInventory, '6') === 0
        )
            return {
                reason: 'Last Phase IV train',
                finalOperatingSet: (state.operatingSet?.number ?? 0) + 1
            }
        return undefined
    }
}
