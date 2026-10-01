import type { PrivateRules } from '@tabletop/18xx'
import { EighteenThirtyPrivateCatalog } from './privates.js'
export const EighteenThirtyPrivateRules: PrivateRules = {
    // M&H's owner may exchange it for a single NYC share from the IPO or the market, at any time.
    exchangeTerms(state, privateCompanyId) {
        if (privateCompanyId !== 'MH') return undefined
        return {
            certificateIds: state.certificates
                .filter(
                    (item) =>
                        !item.retired &&
                        item.kind === 'share' &&
                        item.companyId === 'NYC' &&
                        !item.president &&
                        item.shares === 1 &&
                        item.owner.kind === 'bank' &&
                        (item.poolId === 'initial-offering' || item.poolId === 'open-market')
                )
                .map((item) => item.id),
            timing: 'any-turn',
            stockAction: 'none',
            ownershipLimit: 'ordinary'
        }
    },
    phaseEffects: (state) => EighteenThirtyPrivateCatalog.closureEffects(state),
    operationEffects: () => [],
    description: (_state, id) => EighteenThirtyPrivateCatalog.definition(id).description ?? ''
}
