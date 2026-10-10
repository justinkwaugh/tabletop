import { TheOldPrinceMarket } from './stockMarket.js'
import {
    applyPresidencyChange,
    applyStationPlacement,
    availableCompanyTranche,
    closePrivate,
    evaluatePresidency,
    exchangeCertificate,
    fullCapitalizationPayments,
    getCompany,
    grantOwnershipLimitExemption,
    homeStationId,
    presidentCertificate,
    releaseTrains,
    replaceStation,
    sameOwner,
    sharesStillToFloat,
    trainsOwnedBy,
    type CompanyRules,
    type FormationState,
    type StockState
} from '@tabletop/18xx'
import { assert, assertExists } from '@tabletop/common'
import { peirCompanies } from './companies.js'
import { peirPresident } from './peir.js'
import { TheOldPrinceStockRules, theOldPrincePurchasePayers } from './stockRules.js'
import { TheOldPrincePhases } from './trains.js'

export function availableTheOldPrinceTranche(state: FormationState) {
    assertExists(state.tranches, 'TOP company formation requires tranches')
    return availableCompanyTranche(state.tranches, (companyId) => {
        const company = getCompany(state, companyId)
        return (
            !!company.operated ||
            state.certificates.every(
                (certificate) =>
                    certificate.kind !== 'share' ||
                    certificate.companyId !== companyId ||
                    certificate.poolId === 'reserved' ||
                    certificate.owner.kind === 'player' ||
                    (certificate.owner.kind === 'company' && certificate.owner.companyId === 'UB')
            )
        )
    })
}
export function theOldPrinceStartMarketSpaces(state: StockState): string[] {
    const reached = (phaseId: string) => TheOldPrincePhases.isAtLeast(state.phaseId, phaseId)
    const minimumRow = reached('7') ? 6 : reached('3+') ? 5 : reached('5H') ? 4 : 3
    return TheOldPrinceMarket.spaces
        .filter((space) => space.column === 1 && space.row >= minimumRow)
        .map((space) => space.id)
}
export const TheOldPrinceCompanyRules: CompanyRules = {
    startMarketSpaces(state, companyId) {
        if (!peirCompanies(state).some((item) => item.companyId === companyId)) return []
        return theOldPrinceStartMarketSpaces(state)
    },
    startTerms(state, companyId, buyer, marketSpaceId) {
        if (!availableTheOldPrinceTranche(state)) return 'No company tranche is available.'
        const association = peirCompanies(state).find((item) => item.companyId === companyId)
        if (!association) return 'This company requires a different formation procedure.'
        const peir = state.certificates.find(
            (certificate) => certificate.id === association.peirCertificateId
        )
        if (!peir || peir.owner.kind !== 'player')
            return 'The associated PEIR share must be owned by a player.'
        const certificate = presidentCertificate(state, companyId)
        if (!certificate || certificate.owner.kind !== 'bank' || certificate.poolId !== 'market')
            return 'The president’s certificate must be available from the Bank.'
        return {
            price: TheOldPrinceMarket.space(marketSpaceId).price * 2,
            recipient: { kind: 'bank' },
            payers: theOldPrincePurchasePayers(state, buyer)
        }
    },
    onStart(state, details) {
        const tranche = availableTheOldPrinceTranche(state)
        assertExists(tranche, 'Company start requires a tranche space')
        tranche.companyIds.push(details.companyId)
    },
    sharesToFloat: (state, companyId) =>
        sharesStillToFloat(
            state,
            companyId,
            60,
            (certificate) => certificate.owner.kind === 'bank' && certificate.poolId !== 'reserved'
        ),
    flotationPayments: (state, companyId) =>
        fullCapitalizationPayments(
            state,
            companyId,
            TheOldPrinceCompanyRules.sharesToFloat?.(state, companyId)
        ),
    onFloat(state, companyId) {
        const association = peirCompanies(state).find((item) => item.companyId === companyId)
        if (!association) {
            if (getCompany(state, companyId).role === 'shortline') {
                const reservation = state.stationReservations.find((r) => r.companyId === companyId)
                assertExists(reservation, 'Shortline requires its reserved home')
                applyStationPlacement(state, {
                    stationId: homeStationId(companyId),
                    companyId,
                    position: {
                        locationId: reservation.locationId,
                        nodeId: reservation.nodeId,
                        slot: 0
                    },
                    cost: 0
                })
            }
            return
        }
        const replacement = state.certificates.find(
            (certificate) =>
                certificate.kind === 'share' &&
                certificate.companyId === companyId &&
                !certificate.president &&
                certificate.shares === 1 &&
                certificate.owner.kind === 'bank' &&
                certificate.poolId === 'market'
        )
        assertExists(replacement, 'PEIR exchange requires an ordinary Bank share')
        const exchange = exchangeCertificate(state, association.peirCertificateId, replacement.id)
        grantOwnershipLimitExemption(state, companyId, exchange.owner)
        const presidency = evaluatePresidency(
            state,
            companyId,
            TheOldPrinceStockRules.presidencyCandidates(state, companyId)
        )
        assert(!presidency.reason, presidency.reason ?? 'Invalid presidency exchange')
        if (presidency.change) applyPresidencyChange(state, presidency.change)
        replaceStation(state, `PEIR:${companyId}`, homeStationId(companyId))
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
            releaseTrains(
                state.trainInventory,
                trainsOwnedBy(state, cash.owner).map((train) => train.id),
                'removed'
            )
            closePrivate(state, 'KM')
        }
        return [exchange]
    }
}
