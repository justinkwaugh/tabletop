import {
    bankExhaustionAtSetEnd,
    certificateWealthItem,
    getCompany,
    marketShareValue,
    stockMarketSpace,
    type EndingRules,
    type EndingState
} from '@tabletop/18xx'
import { requireEighteenThirtyTwoState } from './state.js'
import { EighteenThirtyTwoPrivateCatalog } from './privates.js'

// Bankruptcy ends the game at once; a broken bank after the operating set (§13). Shares count
// at market value and privates at face value (§14).
const FinishPrice = 400

/**
 * With the $400 finish, a company reaching $400 ends the game once it finishes operating, or at
 * once at the end of a stock round (§17.1).
 */
function reachedFinishPrice(state: EndingState) {
    return (
        requireEighteenThirtyTwoState(state).variants.finish400 &&
        ['OperatingSet', 'StartingOperatingSet'].includes(state.machineState) &&
        state.stockMarket.stacks.some(
            (stack) => stockMarketSpace(state.stockMarket, stack.spaceId).price >= FinishPrice
        )
    )
}

export const EighteenThirtyTwoEndingRules: EndingRules = {
    trigger(state) {
        if (state.bankruptcy) return { reason: 'Bankruptcy' }
        if (reachedFinishPrice(state)) return { reason: '$400 share price' }
        return bankExhaustionAtSetEnd(state)
    },
    certificateItems(state, certificate) {
        const company = getCompany(state, certificate.companyId)
        const value = company.closed
            ? 0
            : certificate.kind === 'share'
              ? marketShareValue(state, certificate)
              : EighteenThirtyTwoPrivateCatalog.faceValue(company.id)
        return [certificateWealthItem(state, certificate, value)]
    }
}
