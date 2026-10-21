import { EighteenNinetyFourNames } from './names.js'
import { EighteenNinetyFourMarket, EndingSpaceId } from './stockMarket.js'
import { EighteenNinetyFourPrivateCatalog } from './privates.js'
import {
    certificateWealthItem,
    getCompany,
    marketShareValue,
    type EndingRules,
    type EndingState
} from '@tabletop/18xx'

/** The operating set the purple phase makes the last, once it has begun (§15.7). */
export function finalOperatingSet(state: EndingState): number | undefined {
    return state.gameEnding?.finalOperatingSet
}

/** Whether the current operating set is the game's last, in which nothing is built (§15.7). */
export function inFinalOperatingSet(state: EndingState): boolean {
    const final = finalOperatingSet(state)
    return final !== undefined && state.operatingSet?.number === final
}

// The game ends at once on a bankruptcy or a share price of F450; otherwise after the first
// complete operating set in the purple phase (§8.1). Unparred shares are worth nothing and
// privates their face value (§8.2).
export const EighteenNinetyFourEndingRules: EndingRules = {
    trigger(state) {
        if (state.bankruptcy) return { reason: 'Bankruptcy' }
        if (state.stockMarket.stacks.some((stack) => stack.spaceId === EndingSpaceId))
            return { reason: 'Share price of F450' }
        if (state.phaseId === 'purple')
            return {
                reason: 'Purple phase',
                finalOperatingSet: (state.operatingSet?.number ?? 0) + 1
            }
        return undefined
    },
    certificateItems(state, certificate) {
        const company = getCompany(state, certificate.companyId)
        const value =
            company.closed || (certificate.kind === 'share' && !company.started)
                ? 0
                : certificate.kind === 'share'
                  ? marketShareValue(EighteenNinetyFourMarket, state, certificate)
                  : EighteenNinetyFourPrivateCatalog.faceValue(company.id)
        return [certificateWealthItem(EighteenNinetyFourNames, certificate, value)]
    }
}
