import { privateOwner, type PrivateRules, type PrivateEffect } from '@tabletop/18xx'
import { Shikoku1889Phases } from './trains.js'
export const Shikoku1889PrivateRules: PrivateRules = {
    exchangeTerms(state, privateCompanyId) {
        if (
            privateCompanyId !== 'DR' ||
            Shikoku1889Phases.indexOf(state.phaseId) >= Shikoku1889Phases.indexOf('5')
        )
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
    phaseEffects(state) {
        if (Shikoku1889Phases.indexOf(state.phaseId) < Shikoku1889Phases.indexOf('5')) return []
        return state.companies
            .filter((company) => company.kind === 'private' && !company.closed)
            .flatMap((company): PrivateEffect[] => {
                if (company.id === 'UTF' && privateOwner(state, company.id)?.kind === 'player')
                    return company.privateRevenue === 50
                        ? []
                        : [{ kind: 'income', privateCompanyId: company.id, revenue: 50 }]
                return [{ kind: 'close', privateCompanyId: company.id }]
            })
    },
    operationEffects: () => [],
    description(state, id) {
        if (id === 'MF')
            return 'Player owner may place the port once on an eligible coastal town, outside a rival railway’s operation. Stays open after use; closes at phase 5.'
        if (id === 'ER')
            return 'Blocks Ohzu while player-owned. On sale to a railway, the seller may immediately upgrade Ohzu in addition to ordinary construction. Closes at phase 5.'
        if (id === 'SRR')
            return 'The owning railway ignores mountain-only terrain costs. Combined river and mountain costs still apply. Closes at phase 5.'
        if (id === 'DR')
            return 'The owning player may exchange for a 10% Iyo IPO share, including during another player’s turn. Does not consume a purchase or change passes. Closes at phase 5.'
        if (id === 'UTF')
            return Shikoku1889Phases.indexOf(state.phaseId) >= Shikoku1889Phases.indexOf('5')
                ? 'Player-owned ferry remains open, pays ¥50, and cannot be sold to a company.'
                : 'At phase 5: stays open and pays ¥50 if player-owned; otherwise closes.'
        return 'Closes at phase 5.'
    }
}
