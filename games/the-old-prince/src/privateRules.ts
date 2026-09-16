import { theOldPrinceRole } from './companies.js'
import { TheOldPrinceTileSet } from './tiles.js'
import { assertExists } from '@tabletop/common'
import { getCompany, type PrivateRules, type PrivateEffect, type FinancialState } from '@tabletop/18xx'
import { TheOldPrincePhases } from './trains.js'
const ShortlineExchanges: Record<string, number> = { MC: 6, SB: 7, VR: 8 }
function shortlineExchange(state: FinancialState, id: string) {
    return ShortlineExchanges[id]
        ? `${theOldPrinceRole(state, 'shortline')}:share:${ShortlineExchanges[id]}`
        : undefined
}
export const TheOldPrincePrivateRules: PrivateRules = {
    exchangeTerms(state, privateCompanyId) {
        if (TheOldPrincePhases.indexOf(state.phaseId) >= TheOldPrincePhases.indexOf('4+'))
            return undefined
        const reservedId = shortlineExchange(state, privateCompanyId)
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
                        ![
                            theOldPrinceRole(state, 'mainline'),
                            theOldPrinceRole(state, 'shortline'),
                            'PEIR'
                        ].includes(item.companyId) &&
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
                company.kind === 'private' && !company.closed && company.id !== 'UB'
        )
        return [
            ...['MC', 'VR', 'SB'].flatMap((id) => open.filter((company) => company.id === id)),
            ...open.filter((company) => !ShortlineExchanges[company.id])
        ].map((company): PrivateEffect => {
            const certificateId = shortlineExchange(state, company.id)
            if (!certificateId)
                return {
                    kind: 'close',
                    privateCompanyId: company.id,
                    ...(company.id === 'SBC'
                        ? {
                              retireUnplacedPieceIds: TheOldPrinceTileSet.availablePieces(
                                  state.tileInventory,
                                  '18xx:9'
                              ).map((piece) => piece.id)
                          }
                        : {})
                }
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
        const id =
            companyId === theOldPrinceRole(state, 'mainline')
                ? 'MLC'
                : companyId === theOldPrinceRole(state, 'shortline')
                  ? 'SLC'
                  : undefined
        return state.companies
            .filter((company) => company.id === id && !company.closed)
            .map((company) => ({ kind: 'close', privateCompanyId: company.id }))
    },
    description(state, id) {
        if (id === 'HS')
            return 'From 4H, may be sold to a railway other than PEIR for $1–200. Its railway may close it to buy one depot train during its turn, paying the normal price. Closes unused at 4+.'
        if (id === 'SBC')
            return 'The owning player’s railways may lay the single straight yellow tile using ordinary track rules and costs. Closes at 4+; the unused tile is removed.'
        if (ShortlineExchanges[id])
            return (
                (id === 'VR'
                    ? 'The owner’s permission is required to build on N18 while this private is open. '
                    : '') +
                'Exchange for a reserved Shortline share during your stock turn, in addition to selling and buying. Cancels your pass. Forced exchange at 4+; ownership limit exemption applies.'
            )
        if (id === 'IB')
            return 'Exchange during your stock turn for a Bank share in another started railway. Closes unused at 4+.'
        if (id === 'UB')
            return 'Union Bank holds its own cash and shares, controlled by the player who owns it. Once per stock round, that player may use a buying or company-starting action for Union Bank instead of themselves. Spend Union Bank’s cash first; its owner may contribute any shortfall. Dividends on its shares go to Union Bank. It may hold presidencies, with its owner making the company’s decisions. It cannot voluntarily sell shares. If one of its companies must buy a train, Union Bank contributes before its owner, with emergency share sales as required. It remains open throughout the game, and its cash and share value count toward its owner’s final wealth.'
        if (id === 'KM') return 'Pays PEIR each operating round; closes at 4+ or when PEIR closes.'
        if (id === 'MLC' || id === 'SLC') {
            const company = getCompany(state, theOldPrinceRole(state, id === 'MLC' ? 'mainline' : 'shortline'))
            return `Comes with the president’s certificate for ${company.name}. Closes when its railway first operates, or at 4+.`
        }
        return 'Closes at 4+.'
    }
}
