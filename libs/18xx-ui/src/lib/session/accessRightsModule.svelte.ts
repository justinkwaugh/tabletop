import { assert } from '@tabletop/common'
import {
    BuyAccessRight,
    holdsAccessRight,
    purchasableAccessRights,
    type EighteenXXState,
    type EighteenXXTitleRules
} from '@tabletop/18xx'
import type { ModuleSession } from './moduleSession.js'

export type AccessRightsSession = ModuleSession<
    EighteenXXState,
    Pick<EighteenXXTitleRules, 'accessRightRules'>
>

/** Rights the operating company may buy during its turn, such as 1894's ferry markers. */
export class AccessRightsModule {
    constructor(private readonly session: AccessRightsSession) {}

    rules = $derived.by(() => this.session.rules.accessRightRules)
    offers = $derived.by(() => {
        const { rules } = this
        const playerId = this.session.state.activePlayerIds[0]
        if (
            !rules ||
            !playerId ||
            !this.session.interactive ||
            !this.session.validActionTypes.includes('BuyAccessRight')
        )
            return []
        return purchasableAccessRights(this.session.state, rules, playerId).map((offer) => ({
            ...offer,
            name: rules.rights.find((right) => right.id === offer.rightId)?.name ?? offer.rightId
        }))
    })
    /** The rights a company holds, by name. */
    held(companyId: string): string[] {
        const rules = this.rules
        if (!rules) return []
        return rules.rights
            .filter((right) => holdsAccessRight(this.session.state, companyId, right.id))
            .map((right) => right.name)
    }
    async buy(offer: { rightId: string; companyId: string; price: number }) {
        assert(
            this.offers.some(
                (listed) => listed.rightId === offer.rightId && listed.companyId === offer.companyId
            ),
            'This right cannot be bought now'
        )
        await this.session.applyAction(
            this.session.createPlayerAction(BuyAccessRight, {
                companyId: offer.companyId,
                rightId: offer.rightId,
                expectedPrice: offer.price
            })
        )
    }
}
