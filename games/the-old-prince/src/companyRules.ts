import { TheOldPrincePhases } from './trains.js'
import { assert, assertExists } from '@tabletop/common'
import {
    availableCompanyTranche,
    exchangeCertificate,
    grantOwnershipLimitExemption,
    closePrivate,
    evaluatePresidency,
    applyPresidencyChange,
    getCompany,
    replaceStation,
    sameOwner,
    stockMarketSpace,
    type CompanyRules,
    type StockState
} from '@tabletop/18xx'
import { peirPresident } from './finance.js'
import { TheOldPrinceStockRules, theOldPrincePurchasePayers } from './stockRules.js'

export const PeirCompanies = [
    { companyId: 'A', name: 'Alberton', peirCertificateId: 'PEIR:share:1' },
    { companyId: 'MS', name: 'Mount Stewart', peirCertificateId: 'PEIR:share:2' },
    { companyId: 'MR', name: 'Murray River', peirCertificateId: 'PEIR:share:3' },
    { companyId: 'S', name: 'Summerside', peirCertificateId: 'PEIR:share:4' },
    { companyId: 'Gt', name: 'Georgetown', peirCertificateId: 'PEIR:share:5' }
] as const

export function availableTheOldPrinceTranche(state: StockState) {
    return availableCompanyTranche(state.tranches, (companyId) => {
        const company = getCompany(state, companyId)
        return (
            !!company.operated ||
            state.certificates.every(
                (certificate) =>
                    certificate.retired ||
                    certificate.kind !== 'share' ||
                    certificate.companyId !== companyId ||
                    certificate.poolId === 'reserved' ||
                    certificate.owner.kind === 'player' ||
                    (certificate.owner.kind === 'company' && certificate.owner.companyId === 'UB')
            )
        )
    })
}
export const TheOldPrinceCompanyRules: CompanyRules = {
    startMarketSpaces(state, companyId) {
        if (!PeirCompanies.some((item) => item.companyId === companyId)) return []
        const phases = TheOldPrincePhases
        const phase = phases.indexOf(state.phaseId)
        assert(phase >= 0, 'Unknown TOP phase')
        const minimumRow =
            phase >= phases.indexOf('7')
                ? 6
                : phase >= phases.indexOf('3+')
                  ? 5
                  : phase >= phases.indexOf('5H')
                    ? 4
                    : 3
        return state.stockMarket.spaces
            .filter((space) => space.column === 1 && space.row >= minimumRow)
            .map((space) => space.id)
    },
    startTerms(state, companyId, buyer, marketSpaceId) {
        if (!availableTheOldPrinceTranche(state)) return 'No company tranche is available.'
        const association = PeirCompanies.find((item) => item.companyId === companyId)
        if (!association) return 'This company requires a different formation procedure.'
        const peir = state.certificates.find(
            (certificate) => certificate.id === association.peirCertificateId
        )
        if (!peir || peir.retired || peir.owner.kind !== 'player')
            return 'The associated PEIR share must be owned by a player.'
        const certificate = state.certificates.find(
            (certificate) =>
                !certificate.retired &&
                certificate.kind === 'share' &&
                certificate.president &&
                certificate.companyId === companyId
        )
        if (
            !certificate ||
            certificate.retired ||
            certificate.owner.kind !== 'bank' ||
            certificate.poolId !== 'market'
        )
            return 'The president’s certificate must be available from the Bank.'
        return {
            price: stockMarketSpace(state.stockMarket, marketSpaceId).price * 2,
            recipient: { kind: 'bank' },
            payers: theOldPrincePurchasePayers(state, buyer)
        }
    },
    onStart(state, details) {
        const tranche = availableTheOldPrinceTranche(state)
        assertExists(tranche, 'Company start requires a tranche space')
        tranche.companyIds.push(details.companyId)
    },
    flotationPayments(state, companyId) {
        const company = getCompany(state, companyId)
        if (!company.shareCount) return undefined
        const inBank = state.certificates.reduce(
            (sum, certificate) =>
                sum +
                (!certificate.retired &&
                certificate.kind === 'share' &&
                certificate.companyId === companyId &&
                certificate.owner.kind === 'bank' &&
                certificate.poolId !== 'reserved'
                    ? certificate.shares
                    : 0),
            0
        )
        if (inBank * 100 > company.shareCount * 40) return undefined
        assertExists(company.parPrice, 'Started company requires a starting price')
        return company.funded
            ? []
            : [
                  {
                      from: { kind: 'bank' },
                      to: { kind: 'company', companyId },
                      amount: company.parPrice * 10
                  }
              ]
    },
    onFloat(state, companyId) {
        const association = PeirCompanies.find((item) => item.companyId === companyId)
        if (!association) return
        const replacement = state.certificates.find(
            (certificate) =>
                !certificate.retired &&
                certificate.kind === 'share' &&
                certificate.companyId === companyId &&
                !certificate.president &&
                certificate.shares === 1 &&
                certificate.owner.kind === 'bank' &&
                certificate.poolId === 'market'
        )
        assertExists(replacement, 'PEIR exchange requires an ordinary Bank share')
        const owner = exchangeCertificate(state, association.peirCertificateId, replacement.id)
        grantOwnershipLimitExemption(state, companyId, owner)
        const presidency = evaluatePresidency(
            state,
            companyId,
            TheOldPrinceStockRules.presidencyCandidates(state, companyId)
        )
        assert(!presidency.reason, presidency.reason ?? 'Invalid presidency exchange')
        if (presidency.change) applyPresidencyChange(state, presidency.change)
        replaceStation(state, `PEIR:${companyId}`, `${companyId}:home`)
        state.stationReservations = state.stationReservations.filter(
            (reservation) => reservation.companyId !== companyId
        )
        const peir = getCompany(state, 'PEIR')
        const president = peirPresident(state)
        if (president) peir.president = { kind: 'player', playerId: president }
        else {
            peir.closed = true
            delete peir.president
            const cash = state.cash.find((cash) =>
                sameOwner(cash.owner, { kind: 'company', companyId: 'PEIR' })
            )
            assertExists(cash, 'PEIR requires a treasury')
            cash.amount = 0
            closePrivate(state, 'KM')
        }
    }
}
