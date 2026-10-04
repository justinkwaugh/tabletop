import { assertExists } from '@tabletop/common'
import {
    evaluateCompanyStart,
    evaluateSharePurchase,
    evaluateShareSale,
    mustSellShares,
    allSharesHeld,
    companyMarketSpace,
    createRectangularStockMarket,
    getCompany,
    marketSaleTerms,
    playersAfterPresident,
    priorityOrder,
    sameOwner,
    sharesOwned,
    stockMarketSpace,
    type CompanyRules,
    type StockRules
} from '@tabletop/18xx'
import { Corporations } from './catalog.js'
import type { HydratedEighteenFortySixState } from './state.js'

export function createMarket() {
    const market = createRectangularStockMarket(
        [
            [
                0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 112, 124, 137, 150, 165, 180, 195, 212,
                230, 250, 270, 295, 320, 345, 375, 405, 440, 475, 510, 550
            ]
        ],
        (_, column) => (column >= 4 && column <= 14 ? 'par' : 'ordinary')
    )
    for (const space of market.spaces) {
        if (space.moves.right) space.moves.up = space.moves.right
        if (space.moves.left) space.moves.down = space.moves.left
    }
    return market
}

export const StockRules1846: StockRules = {
    round: {
        passing: 'consecutive',
        nextPlayerOrder: (state) => priorityOrder(state, StockRules1846.round),
        soldOut: (state, id) => allSharesHeld(state, id, (share) => share.owner.kind === 'player'),
        poolDrop: (state, id) =>
            state.certificates.some(
                (certificate) =>
                    !certificate.retired &&
                    certificate.companyId === id &&
                    certificate.poolId === 'open-market'
            )
                ? 1
                : 0
    },
    buyers: (_, playerId) => [{ kind: 'player', playerId }],
    sellers: (_, playerId) => [{ kind: 'player', playerId }],
    purchaseTerms(state, certificate, buyer) {
        const company = getCompany(state, certificate.companyId)
        if (company.kind !== 'major' || !company.started || company.closed || certificate.president)
            return 'Choose an available ordinary share of a launched corporation.'
        if (
            !(certificate.owner.kind === 'company' && certificate.owner.companyId === company.id) &&
            !(certificate.owner.kind === 'bank' && certificate.poolId === 'open-market')
        )
            return 'This share is not in the treasury or market.'
        return {
            price: companyMarketSpace(state.stockMarket, company.id).price * certificate.shares,
            recipient: certificate.owner,
            payers: [buyer]
        }
    },
    saleTerms(state, companyId, _shares, seller) {
        const company = getCompany(state, companyId)
        if (company.kind !== 'major' || !company.started || company.closed || !company.president)
            return 'This corporation has no saleable stock.'
        const president = sameOwner(company.president, seller)
        if (!company.operated && !president)
            return 'Only the president may sell before the corporation operates.'
        return marketSaleTerms(state, companyId, {
            destinationPoolId: 'open-market',
            marketLimit: 50,
            maximumShares: 10,
            movement: president ? 1 : 0
        })
    },
    certificateLimit(state) {
        const corporations = state.companies.filter(
            (company) => company.kind === 'major' && !company.closed
        ).length
        if (state.players.length === 3) return corporations >= 5 ? 14 : 11
        if (state.players.length === 4) return corporations >= 6 ? 12 : corporations === 5 ? 10 : 8
        return corporations >= 7 ? 11 : corporations === 6 ? 10 : corporations === 5 ? 8 : 6
    },
    certificateWeight: () => 1,
    ownershipLimit: (state, id) => (getCompany(state, id).kind === 'minor' ? 100 : 60),
    presidencyCandidates: (state, id) =>
        playersAfterPresident(state, id, state.turnManager.turnOrder),
    turnOrder: 'sell-buy'
}

export const CompanyRules1846: CompanyRules = {
    startMarketSpaces: (state, id) =>
        getCompany(state, id).kind === 'major'
            ? state.stockMarket.spaces
                  .filter((space) => space.color === 'par')
                  .map((space) => space.id)
            : [],
    startTerms: (state, companyId, buyer, spaceId) => ({
        price: stockMarketSpace(state.stockMarket, spaceId).price * 2,
        recipient: { kind: 'company', companyId },
        payers: [buyer]
    }),
    flotationPayments(state, companyId) {
        const company = getCompany(state, companyId)
        if (company.kind !== 'major') return undefined
        assertExists(company.parPrice, 'A launched corporation has an initial stock price')
        return companyId === 'IC'
            ? [
                  {
                      from: { kind: 'bank' },
                      to: { kind: 'company', companyId },
                      amount: company.parPrice
                  }
              ]
            : []
    },
    onFloat(state, id) {
        const corporation = Corporations.find((company) => company.id === id)
        assertExists(corporation, 'A corporation requires its home')
        const station = state.stations.find(
            (station) => station.companyId === id && station.status === 'available'
        )
        assertExists(station, 'A corporation requires a home station')
        state.stations[state.stations.indexOf(station)] = {
            id: station.id,
            companyId: id,
            status: 'placed',
            position: { locationId: corporation.home, nodeId: 'city', slot: 0 }
        }
        state.stationReservations = state.stationReservations.filter(
            (reservation) =>
                reservation.companyId !== id || reservation.locationId !== corporation.home
        )
        getCompany(state, id).funded = true
    }
}

export function stockChoices(state: HydratedEighteenFortySixState, playerId: string) {
    const buyer = { kind: 'player' as const, playerId }
    const starts = state.companies.flatMap((company) =>
        CompanyRules1846.startMarketSpaces(state, company.id).flatMap((marketSpaceId) => {
            const request = { playerId, buyer, companyId: company.id, marketSpaceId }
            const details = evaluateCompanyStart(
                state,
                request,
                StockRules1846,
                CompanyRules1846
            ).details
            return details ? [{ ...request, expectedPrice: details.price }] : []
        })
    )
    const buys = state.certificates
        .flatMap((certificate) => {
            const request = { playerId, buyer, certificateId: certificate.id }
            const details = evaluateSharePurchase(state, request, StockRules1846).details
            return details
                ? [
                      {
                          ...request,
                          companyId: certificate.companyId,
                          source: details.seller.kind,
                          expectedPrice: details.price
                      }
                  ]
                : []
        })
        .filter(
            (choice, index, choices) =>
                choices.findIndex(
                    (other) =>
                        other.companyId === choice.companyId && other.source === choice.source
                ) === index
        )
    const sells = state.companies.flatMap((company) =>
        Array.from(
            { length: sharesOwned(state, company.id, buyer) },
            (_, index) => index + 1
        ).flatMap((shares) => {
            const request = { playerId, seller: buyer, sales: [{ companyId: company.id, shares }] }
            const details = evaluateShareSale(state, request, StockRules1846).details
            return details ? [{ ...request, expectedProceeds: details.proceeds }] : []
        })
    )
    return { starts, buys, sells, mayFinish: !mustSellShares(state, playerId, StockRules1846) }
}
