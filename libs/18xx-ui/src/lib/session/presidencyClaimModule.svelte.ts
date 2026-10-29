import { assert } from '@tabletop/common'
import {
    ClaimPresidency,
    presidencyClaims,
    type EighteenXXTitleRules,
    type PresidencyClaimOffer
} from '@tabletop/18xx'
import type { ModuleSession } from './moduleSession.js'

export type PresidencyClaimSession = ModuleSession<
    Parameters<typeof presidencyClaims>[0],
    Pick<EighteenXXTitleRules, 'stockRules' | 'receivershipRules'>
>

/** Taking a company out of receivership by buying into its presidency, as a stock turn's purchase. */
export class PresidencyClaimModule {
    constructor(private readonly session: PresidencyClaimSession) {}

    offers = $derived.by((): readonly PresidencyClaimOffer[] => {
        const { state, rules, playerId } = this.session
        const receivershipRules = rules.receivershipRules
        return playerId && receivershipRules?.presidencyClaim
            ? presidencyClaims(state, { stockRules: rules.stockRules, receivershipRules }, playerId)
            : []
    })
    canClaim = $derived.by(
        () => this.session.interactive && this.session.validActionTypes.includes('ClaimPresidency')
    )

    async claim(offer: PresidencyClaimOffer) {
        assert(this.canClaim, 'No presidency can be claimed now')
        await this.session.applyAction(
            this.session.createPlayerAction(ClaimPresidency, {
                companyId: offer.companyId,
                expectedPrice: offer.price
            })
        )
    }
}
