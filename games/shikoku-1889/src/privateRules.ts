import type { PrivateRules } from '@tabletop/18xx'
import { Shikoku1889PrivateCatalog } from './privates.js'
import { Shikoku1889Phases } from './trains.js'
export const Shikoku1889PrivateRules: PrivateRules = {
    exchangeTerms(state, privateCompanyId) {
        if (privateCompanyId !== 'DR' || Shikoku1889Phases.isAtLeast(state.phaseId, '5'))
            return undefined
        return {
            certificateIds: state.certificates
                .filter(
                    (item) =>
                        !item.retired &&
                        item.kind === 'share' &&
                        item.companyId === 'IR' &&
                        !item.president &&
                        item.shares === 1 &&
                        item.owner.kind === 'bank' &&
                        item.poolId === 'initial-offering'
                )
                .map((item) => item.id),
            timing: 'any-turn',
            stockAction: 'none',
            ownershipLimit: 'ordinary'
        }
    },
    phaseEffects: (state) => Shikoku1889PrivateCatalog.closureEffects(state),
    operationEffects: () => [],
    description(state, id) {
        if (id === 'UTF')
            return Shikoku1889Phases.isAtLeast(state.phaseId, '5')
                ? 'Player-owned ferry remains open, pays ¥50, and cannot be sold to a company.'
                : 'At phase 5: stays open and pays ¥50 if player-owned; otherwise closes.'
        return Shikoku1889PrivateCatalog.definition(id).description ?? ''
    }
}
