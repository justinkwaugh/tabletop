import { theOldPrinceRole } from './companies.js'
import { TheOldPrinceTileSet } from './tiles.js'
import { assertExists } from '@tabletop/common'
import { getCompany, type PrivateRules, type PrivateEffect, type FinancialState } from '@tabletop/18xx'
import { TheOldPrincePhases } from './trains.js'
import { TheOldPrincePrivateCatalog } from './privates.js'
const ShortlineExchanges: Record<string, number> = { MC: 6, SB: 7, VR: 8 }
function shortlineExchange(state: FinancialState, id: string) {
    return ShortlineExchanges[id]
        ? `${theOldPrinceRole(state, 'shortline')}:share:${ShortlineExchanges[id]}`
        : undefined
}
export const TheOldPrincePrivateRules: PrivateRules = {
    exchangeTerms(state, privateCompanyId) {
        if (TheOldPrincePhases.isAtLeast(state.phaseId, '4+'))
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
        const due = TheOldPrincePrivateCatalog.closureEffects(state)
        return [
            ...['MC', 'VR', 'SB'].flatMap((id) =>
                due.filter((effect) => effect.privateCompanyId === id)
            ),
            ...due.filter((effect) => !ShortlineExchanges[effect.privateCompanyId])
        ].map((effect): PrivateEffect => {
            const company = { id: effect.privateCompanyId }
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
        if (ShortlineExchanges[id]) {
            const company = getCompany(state, theOldPrinceRole(state, 'shortline'))
            return (
                `**Includes one reserved share of ${company.name}.**\n\n` +
                (id === 'VR'
                    ? 'The owner’s permission is required to build on N18 while this private is open.\n\n'
                    : '') +
                'Exchange for a reserved Shortline share during your stock turn, in addition to selling and buying. Cancels your pass. Ownership limit exemption applies.\n\nForced exchange at 4+.'
            )
        }
        if (id === 'RA' || id === 'RF') {
            const company = getCompany(state, theOldPrinceRole(state, 'mainline'))
            return `**Includes one share of ${company.name}.**\n\nCloses at 4+.`
        }
        if (id === 'MLC' || id === 'SLC') {
            const company = getCompany(state, theOldPrinceRole(state, id === 'MLC' ? 'mainline' : 'shortline'))
            return `**Includes the president's cert for ${company.name}.**\n\nCloses when its railway first operates, or at 4+.`
        }
        return TheOldPrincePrivateCatalog.definition(id).description ?? 'Closes at 4+.'
    }
}
