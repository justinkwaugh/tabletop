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

/** Whether the current operating set is the game's last, in which nothing is built (§15.7). */
export function inFinalOperatingSet(
    state: Pick<EndingState, 'operatingSet' | 'gameEnding'>
): boolean {
    const final = state.gameEnding?.finalOperatingSet
    return final !== undefined && state.operatingSet?.number === final
}

// The game ends at once on a bankruptcy or a share price of F450; otherwise after the first
// complete operating set in phase D (§8.1). Unparred shares are worth nothing and
// privates their face value (§8.2).
export const EighteenNinetyFourEndingRules: EndingRules = {
    trigger(state) {
        if (state.bankruptcy) return { reason: 'Bankruptcy' }
        if (state.stockMarket.stacks.some((stack) => stack.spaceId === EndingSpaceId))
            return { reason: 'Share price of ₣450' }
        if (state.phaseId === 'D')
            return {
                reason: 'Phase D',
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
