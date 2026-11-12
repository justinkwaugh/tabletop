import { assertExists } from '@tabletop/common'
import {
    getCompany,
    isStartStockRound,
    placeReservedHome,
    settleCashPayments,
    treasuryShareCompanyRules,
    treasuryShareStockRules,
    type CompanyRules,
    type EighteenXXStateHandler,
    type FormationState,
    type MapStateData,
    type StockRules,
    type StockState
} from '@tabletop/18xx'
import { Charters1849, GaribaldiId, Homes1849, ShareCount1849, TokenFees1849 } from './companies.js'
import { CertificateLimits1849 } from './setup.js'
import { requireState1849 } from './state.js'
import { Market1849, MarketBeforeBlueZone1849, parSpaceIds1849 } from './stockMarket.js'
import { BlueZonePhaseId, Phases1849 } from './trains.js'
import { garibaldiHomes } from './stations.js'

export const MarketPoolId1849 = 'open-market'

/** The market as share prices move now: without its blue zone before phase 16 (§5). */
export function marketInForce1849(state: { phaseId: string }) {
    return Phases1849.isAtLeast(state.phaseId, BlueZonePhaseId)
        ? Market1849
        : MarketBeforeBlueZone1849
}

/** The corporations in play, five or six (§2.2). */
export function corporationCount1849(state: object): 5 | 6 {
    return requireState1849(state).removedCorporationId ? 5 : 6
}

function certificateLimit(state: StockState): number {
    const limit = CertificateLimits1849[corporationCount1849(state)][state.players.length]
    assertExists(limit, 'Unsupported 1849 player and corporation count')
    return limit
}

const SharedTrading = treasuryShareStockRules({
    market: Market1849,
    charters: Charters1849,
    marketPoolId: MarketPoolId1849,
    launchColor: 'yellow',
    certificateLimit,
    // Players may own up to 60% of a corporation (§7.2).
    ownershipLimit: () => 60
})

/** Whether a certificate is the two-share last certificate (§9.6). */
function isLastCertificate(certificate: { kind: string; shares?: number; president?: true }) {
    return certificate.kind === 'share' && !certificate.president && certificate.shares === 2
}

export const StockRules1849: StockRules = {
    ...SharedTrading,
    round: {
        ...SharedTrading.round,
        // A price at L. 230 cannot rise into the blue zone before phase 16 (§5, §9.7).
        soldOutRises(state, companyId) {
            const market = marketInForce1849(state)
            const from = market.companySpace(state.stockMarket, companyId)
            return from.moves.up ? 1 : 0
        }
    },
    // The last certificate is bought only once no other certificate of its corporation is left
    // where it is, and costs twice the price (§9.3, §9.6).
    purchaseTerms(state, certificate, buyer) {
        if (
            isLastCertificate(certificate) &&
            state.certificates.some(
                (other) =>
                    other.id !== certificate.id &&
                    other.companyId === certificate.companyId &&
                    other.kind === 'share' &&
                    other.poolId === certificate.poolId
            )
        )
            return 'The last certificate is bought once no other is left with it.'
        return SharedTrading.purchaseTerms(state, certificate, buyer)
    },
    // No one sells a corporation's shares before it has operated; each share sold drops the
    // price a row (§9.2).
    saleTerms(state, companyId, shares, _seller) {
        const company = getCompany(state, companyId)
        if (company.kind !== 'major' || !company.started || !company.president)
            return 'This corporation has no saleable stock.'
        if (!company.operated) return 'Shares cannot be sold before the corporation operates.'
        return {
            payer: { kind: 'bank' },
            price: Market1849.companySpace(state.stockMarket, companyId).price,
            direction: 'down',
            destinationPoolId: MarketPoolId1849,
            marketLimit: 50,
            maximumShares: ShareCount1849,
            movement: shares
        }
    },
    // Private companies count toward the certificate limit (§7.1, §9.1).
    certificateWeight: () => 1,
    repeatSales: undefined
}

/**
 * The next corporation a player may start: the first unstarted one in order that is not waiting
 * out the round it closed in, passing over a Garibaldi set aside or without room (§9.4, §9.4.1,
 * §11).
 */
export function nextCorporation1849(state: FormationState & MapStateData): string | undefined {
    const title = requireState1849(state)
    return startOrder1849(state).find((companyId) => {
        if (getCompany(state, companyId).started) return false
        const restart = title.restarts.find((entry) => entry.companyId === companyId)
        if (restart && state.stockRound.number < restart.stockRound) return false
        return companyId !== GaribaldiId || (!title.garibaldiAside && garibaldiHasRoom(state))
    })
}

/**
 * The order corporations start in, with an unstarted Garibaldi that has lost its room already
 * last, as it will be set aside when the next stock round begins (§9.4.1).
 */
export function startOrder1849(state: FormationState & MapStateData): readonly string[] {
    const title = requireState1849(state)
    const order = title.corporationOrder
    return order.includes(GaribaldiId) &&
        !title.garibaldiAside &&
        !getCompany(state, GaribaldiId).started &&
        !garibaldiHasRoom(state)
        ? [...order.filter((companyId) => companyId !== GaribaldiId), GaribaldiId]
        : order
}

function garibaldiHasRoom(state: FormationState & MapStateData): boolean {
    return garibaldiHomes(state, 0).length > 0
}

/** Whether an unstarted Garibaldi is set aside, or has lost its room and will be (§9.4.1). */
export function garibaldiWaiting1849(state: FormationState & MapStateData): boolean {
    const title = requireState1849(state)
    return (
        title.corporationOrder.includes(GaribaldiId) &&
        !getCompany(state, GaribaldiId).started &&
        (!!title.garibaldiAside || !garibaldiHasRoom(state))
    )
}

/**
 * As a stock round begins, an unstarted Garibaldi with no room in any of its cities is set aside
 * last in order, and one set aside comes back once a stock round begins with room: room that
 * opens during a round waits for the next (§9.4.1).
 */
export function reviewGaribaldi1849(state: FormationState & MapStateData): void {
    const title = requireState1849(state)
    if (!title.corporationOrder.includes(GaribaldiId) || getCompany(state, GaribaldiId).started) {
        delete title.garibaldiAside
        return
    }
    if (garibaldiHasRoom(state)) {
        delete title.garibaldiAside
        return
    }
    title.corporationOrder = startOrder1849(state).slice()
    title.garibaldiAside = true
}

/** Reviews the Garibaldi as each stock round begins, after an operating set (§9.4.1). */
export function reviewsGaribaldi1849(handler: EighteenXXStateHandler): EighteenXXStateHandler {
    return {
        isValidAction: (action, context) => handler.isValidAction(action, context),
        validActionsForPlayer: (playerId, context) =>
            handler.validActionsForPlayer(playerId, context),
        enter: (context) => handler.enter(context),
        onAction(action, context) {
            const next = handler.onAction(action, context)
            if (isStartStockRound(action)) reviewGaribaldi1849(context.gameState)
            return next
        }
    }
}

const SharedCompanyRules = treasuryShareCompanyRules(
    { market: Market1849, launchColor: 'yellow' },
    (companyId) => {
        const [home] = Homes1849[companyId]
        assertExists(home, 'A corporation has a home')
        return home
    }
)

/** Pays a starting corporation's token fee to the bank (§9.4, §8.1). */
function payTokenFee(state: FormationState, companyId: string): void {
    settleCashPayments(state, [
        {
            from: { kind: 'company', companyId },
            to: { kind: 'bank' },
            amount: TokenFees1849[companyId]
        }
    ])
}

export const CompanyRules1849: CompanyRules = {
    ...SharedCompanyRules,
    // Only the next corporation in order starts, at a value its phase offers (§9.4).
    startMarketSpaces(state: FormationState & MapStateData, companyId) {
        return nextCorporation1849(state) === companyId ? parSpaceIds1849(state.phaseId) : []
    },
    // The president may buy one or two more certificates with the president's (§9.4).
    additionalStartCertificates: () => 2,
    // The Garibaldi chooses a city with room as it starts, paying its fee for it (§9.4.1).
    startHomes(state: FormationState & MapStateData, companyId) {
        return companyId === GaribaldiId
            ? garibaldiHomes(state, TokenFees1849[GaribaldiId])
            : undefined
    },
    // A corporation floats as its president's certificate is sold; the one that came with the
    // Reale Società d'Affari is funded by the bank with that certificate's value (§8.1, §9.4).
    flotationPayments(state, companyId) {
        const company = getCompany(state, companyId)
        if (company.kind !== 'major' || !company.president) return undefined
        if (requireState1849(state).royalFunding !== companyId) return []
        assertExists(company.parPrice, 'A started corporation has a value')
        return [
            {
                from: { kind: 'bank' },
                to: { kind: 'company', companyId },
                amount: company.parPrice * 2
            }
        ]
    },
    // It then pays for its tokens and places its home (§8.1, §9.4).
    onFloat(state, companyId) {
        const title = requireState1849(state)
        const company = getCompany(state, companyId)
        if (title.royalFunding === companyId) delete title.royalFunding
        company.funded = true
        // Its first operating round follows this stock round; it issues nothing in it (§10.8).
        title.floats = [
            ...title.floats.filter((entry) => entry.companyId !== companyId),
            { companyId, stockRound: state.stockRound.number }
        ]
        if (companyId === GaribaldiId) {
            // A Garibaldi started at a price pays its fee with its home; one from the Reale
            // Società d'Affari chooses its home as it first operates.
            const placed = state.stations.some(
                (station) => station.companyId === companyId && station.status === 'placed'
            )
            if (!placed) payTokenFee(state, companyId)
            return
        }
        payTokenFee(state, companyId)
        const [home] = Homes1849[companyId]
        placeReservedHome(state, companyId, home)
    },
    parAfterAward: true,
    // The Reale Società d'Affari's corporation starts at L. 68 or L. 100 (§8.1).
    awardParSpaces: () => parSpaceIds1849('4H')
}
