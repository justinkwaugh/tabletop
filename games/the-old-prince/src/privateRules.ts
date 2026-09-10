import { assertExists } from '@tabletop/common'
import { type PrivateRules, type PrivateEffect } from '@tabletop/18xx'
import { TheOldPrincePhases } from './trains.js'
export const ShortlineExchanges: Record<string, string> = {
    MC: 'So:share:6',
    SB: 'So:share:7',
    VR: 'So:share:8'
}
export const TheOldPrincePrivateRules: PrivateRules = {
    exchangeTerms(state, privateCompanyId) {
        if (TheOldPrincePhases.indexOf(state.phaseId) >= TheOldPrincePhases.indexOf('4+'))
            return undefined
        const reservedId = ShortlineExchanges[privateCompanyId]
        if (reservedId)
            return {
                certificateIds: state.certificates
                    .filter(
                        (item) =>
                            !item.retired &&
                            item.id === reservedId &&
                            item.owner.kind === 'bank' &&
                            item.poolId === 'reserved'
                    )
                    .map((item) => item.id),
                timing: 'own-stock-turn',
                stockAction: 'additional',
                ownershipLimit: 'exempt'
            }
        if (privateCompanyId !== 'IB' || state.players.length !== 4) return undefined
        return {
            certificateIds: state.certificates
                .filter(
                    (item) =>
                        !item.retired &&
                        item.kind === 'share' &&
                        !item.president &&
                        item.shares === 1 &&
                        item.owner.kind === 'bank' &&
                        item.poolId === 'market' &&
                        !['ML', 'So', 'PEIR'].includes(item.companyId) &&
                        state.companies.some(
                            (company) =>
                                company.id === item.companyId && company.started && !company.closed
                        )
                )
                .map((item) => item.id),
            timing: 'own-stock-turn',
            stockAction: 'additional',
            ownershipLimit: 'ordinary'
        }
    },
    phaseEffects(state) {
        if (TheOldPrincePhases.indexOf(state.phaseId) < TheOldPrincePhases.indexOf('4+')) return []
        const open = state.companies.filter(
            (company) =>
                company.kind === 'private' && !company.closed && !['UB', 'KM'].includes(company.id)
        )
        return [
            ...['MC', 'VR', 'SB'].flatMap((id) => open.filter((company) => company.id === id)),
            ...open.filter((company) => !ShortlineExchanges[company.id])
        ].map((company): PrivateEffect => {
            const certificateId = ShortlineExchanges[company.id]
            if (!certificateId) return { kind: 'close', privateCompanyId: company.id }
            const share = state.certificates.find(
                (item) =>
                    item.id === certificateId &&
                    !item.retired &&
                    item.owner.kind === 'bank' &&
                    item.poolId === 'reserved'
            )
            assertExists(share, 'Open Shortline exchange requires its reserved share')
            return {
                kind: 'exchange',
                privateCompanyId: company.id,
                certificateId,
                exemptOwnershipLimit: true
            }
        })
    },
    operationEffects(state, companyId) {
        const id = companyId === 'ML' ? 'MLC' : companyId === 'So' ? 'SLC' : undefined
        return state.companies
            .filter((company) => company.id === id && !company.closed)
            .map((company) => ({ kind: 'close', privateCompanyId: company.id }))
    },
    description(_state, id) {
        if (ShortlineExchanges[id])
            return 'Exchange for a reserved Shortline share during your stock turn, in addition to selling and buying. Cancels your pass. Forced exchange at 4+; ownership limit exemption applies.'
        if (id === 'IB')
            return 'Exchange during your stock turn for a Bank share in another started railway. Closes unused at 4+.'
        if (id === 'UB') return 'Remains open throughout the game.'
        if (id === 'KM') return 'Pays PEIR each operating round; closes when PEIR closes.'
        if (id === 'MLC' || id === 'SLC') return 'Closes when its railway first operates, or at 4+.'
        return 'Closes at 4+.'
    }
}
