import {
    allSharesHeld,
    certificatesInPool,
    certificatesOwnedBy,
    finiteCashOwnedBy,
    getCompany,
    leadingLotIds,
    committedCash,
    closePrivate,
    playersAfterPresident,
    privateOwner,
    reorderPendingOperatingCompanies,
    settleCashPayments,
    sharesStillToFloat,
    soldThisStockRound,
    stockCertificateCount,
    treasuryPoolId,
    type BidBoxRules,
    type CompanyRules,
    type FormationState,
    type Owner,
    type StockRules,
    type StockState
} from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'
import {
    Charters1822,
    MajorIds1822,
    MajorShareCount1822,
    concessionId,
    directorShares1822,
    major1822
} from './companies.js'
import { BidBoxSettlementRules1822, lotKind1822 } from './lots.js'
import { playerLoan1822 } from './loans.js'
import { MarketPoolId1822 } from './names.js'
import { operatingOrder1822 } from './order.js'
import { DoubleCashPrivateId, TaxHavenPrivateId } from './privates.js'
import { BidIncrement1822, BiddingTokens1822, FaceValues1822 } from './setup.js'
import { setupOf1822 } from './scenarios.js'
import { requireState1822 } from './state.js'
import { MajorParSpaceIds1822, Market1822, NoLimitSpaceIds1822 } from './stockMarket.js'
import { Phases1822 } from './trains.js'

const taxHaven: Owner = { kind: 'company', companyId: TaxHavenPrivateId }
const player = (playerId: string): Owner => ({ kind: 'player', playerId })

/** The bids a player may place or raise in one stock turn (§4.9.1). */
export const BidsPerTurn1822 = 3
/** The share of a company a player may hold and still buy more of it (§4.7.6). */
const OwnershipLimit = 60
/** A concession's face value, taken off the cost of the director's certificate it converts to (§4.8.3). */
const ConcessionCredit = FaceValues1822.concession

function isTaxHaven(owner: Owner): boolean {
    return owner.kind === 'company' && owner.companyId === TaxHavenPrivateId
}

/** The player who owns the tax haven, which buys and holds a share for them (Table 3, P16). */
export function taxHavenPlayerId(state: StockState): string | undefined {
    const owner = privateOwner(state, TaxHavenPrivateId)
    return owner?.kind === 'player' && !getCompany(state, TaxHavenPrivateId).closed
        ? owner.playerId
        : undefined
}

function playerCertificateLimit(state: StockState): number {
    const limit = setupOf1822(requireState1822(state)).certificateLimits[state.players.length]
    assertExists(limit, '1822 is played by three to seven players')
    return limit
}

/** Cash a player may spend this turn: what their highest bids do not commit (§4.9.3). */
export function spendableCash1822(state: StockState, playerId: string): number {
    const cash = finiteCashOwnedBy(state, player(playerId))
    return cash - committedCash(requireState1822(state), playerId)
}

/** Players by cash, most first, one of them counting double; those level keep their order (§4.10.5). */
function orderByCash(state: StockState, doubledPlayerId: string | undefined): string[] {
    const order = state.turnManager.turnOrder
    const counted = (playerId: string) =>
        finiteCashOwnedBy(state, player(playerId)) * (doubledPlayerId === playerId ? 2 : 1)
    return [...order].sort((a, b) => counted(b) - counted(a) || order.indexOf(a) - order.indexOf(b))
}

/**
 * The order of the next stock round: most cash first, P9's holder counting double if they
 * declared it this round (§4.10.5, §3.1.9).
 */
function nextPlayerOrder(stateObject: StockState): string[] {
    const state = requireState1822(stateObject)
    return orderByCash(
        state,
        state.cashDeclaration?.doubled ? state.cashDeclaration.playerId : undefined
    )
}

/** The order the next stock round would take with or without P9's declaration. */
export function playerOrderWithDeclaration1822(
    state: StockState,
    doubledCashPlayerId: string | undefined
): string[] {
    return orderByCash(state, doubledCashPlayerId)
}

/** The player who may declare double cash with P9, while they hold it (§3.1.9). */
export function doubleCashPlayerId1822(state: StockState): string | undefined {
    const owner = privateOwner(state, DoubleCashPrivateId)
    return owner?.kind === 'player' && !getCompany(state, DoubleCashPrivateId).closed
        ? owner.playerId
        : undefined
}

export const StockRules1822: StockRules = {
    market: Market1822,
    charters: Charters1822,
    round: {
        passing: 'consecutive',
        nextPlayerOrder,
        // A share in the tax haven counts as in a player's hands; a minor company's embedded
        // half is never sold (§4.11.1, §4.11.3, Table 3).
        soldOut: (state, companyId) =>
            getCompany(state, companyId).kind === 'major' &&
            allSharesHeld(
                state,
                companyId,
                (share) => share.owner.kind === 'player' || isTaxHaven(share.owner)
            )
    },
    sellers: (_state, playerId) => [player(playerId)],
    // The tax haven buys a share for the player who owns it (Table 3, P16).
    buyers: (state, playerId) => [
        player(playerId),
        ...(taxHavenPlayerId(state) === playerId ? [taxHaven] : [])
    ],
    purchaseTerms(state, certificate, buyer) {
        const company = getCompany(state, certificate.companyId)
        if (company.kind !== 'major' || !company.started || company.closed || certificate.president)
            return 'Only the ordinary shares of a started major company are bought.'
        const fromTreasury = certificate.poolId === treasuryPoolId(company.id)
        if (!fromTreasury && certificate.poolId !== MarketPoolId1822)
            return 'This share is not with the company or in the bank pool.'
        const buyingPlayerId = buyer.kind === 'player' ? buyer.playerId : taxHavenPlayerId(state)
        if (!buyingPlayerId) return 'This owner buys no shares.'
        if (playerLoan1822(state, buyingPlayerId))
            return 'A player with a loan may not buy shares (§4.2.1).'
        const price =
            Market1822.companySpace(state.stockMarket, company.id).price * certificate.shares
        const recipient: Owner = fromTreasury
            ? { kind: 'company', companyId: company.id }
            : { kind: 'bank' }
        if (isTaxHaven(buyer)) {
            // Never a share of a company its player sold this round (§3.1.15).
            if (soldThisStockRound(state.stockRound, player(buyingPlayerId), company.id))
                return 'The tax haven buys no share of a company its player sold this round.'
            const held = certificatesOwnedBy(state, taxHaven)
            // Its first share is bought with its player's money; under the variant its own
            // money buys the rest, one a stock round and one of a company (§6.1.2).
            if (held.length) {
                const title = requireState1822(state)
                if (!title.variants.taxHavenShares) return 'The tax haven holds a single share.'
                if (title.taxHavenBought) return 'The tax haven buys one share each stock round.'
                if (held.some((entry) => entry.companyId === company.id))
                    return 'The tax haven holds one certificate of a company.'
                if (price > finiteCashOwnedBy(state, taxHaven))
                    return 'The tax haven’s money does not cover this share.'
                return { price, recipient, payers: [taxHaven] }
            }
        }
        if (price > spendableCash1822(state, buyingPlayerId))
            return 'The cash left after the highest bids does not cover this share.'
        return { price, recipient, payers: [player(buyingPlayerId)] }
    },
    afterSharePurchase(state, details) {
        if (isTaxHaven(details.buyer)) requireState1822(state).taxHavenBought = true
    },
    // Only ordinary shares of a major company that has completed an operating round are sold, a
    // space down for each share, half the company at most in the bank pool (§4.6).
    saleTerms(state, companyId, shares) {
        const company = getCompany(state, companyId)
        if (company.kind !== 'major' || !company.started || company.closed)
            return 'Only shares in major companies are sold.'
        if (!company.operated)
            return 'Shares cannot be sold before the company has completed an operating round.'
        return {
            payer: { kind: 'bank' },
            price: Market1822.companySpace(state.stockMarket, companyId).price,
            direction: 'down',
            destinationPoolId: MarketPoolId1822,
            marketLimit: 50,
            maximumShares: MajorShareCount1822,
            movement: shares
        }
    },
    // A highest bid counts as a certificate held (§4.9.4). The tax haven holds a single share,
    // or under the variant one of each company (§6.1.2).
    certificateLimit(state, buyer) {
        if (buyer.kind !== 'player')
            return requireState1822(state).variants.taxHavenShares ? MajorIds1822.length : 1
        return (
            playerCertificateLimit(state) -
            leadingLotIds(requireState1822(state), buyer.playerId).length
        )
    },
    // Certificates of companies valued in the yellow zone do not count, nor does the tax haven
    // (§4.4.2, §3.1.11).
    certificateWeight(state, certificate) {
        if (certificate.kind !== 'share') return certificate.companyId === TaxHavenPrivateId ? 0 : 1
        const company = getCompany(state, certificate.companyId)
        if (!company.started) return 1
        return NoLimitSpaceIds1822.includes(
            Market1822.companySpace(state.stockMarket, company.id).id
        )
            ? 0
            : 1
    },
    ownershipLimit: () => OwnershipLimit,
    presidencyCandidates: (state, companyId) =>
        playersAfterPresident(state, companyId, state.turnManager.turnOrder),
    turnOrder: 'sell-buy',
    repeatSales: 'separate',
    // A sale during an operating round may change the order of the companies still to run (§5.2.2).
    afterSale(stateObject) {
        const state = requireState1822(stateObject)
        if (state.operatingSet && !state.operatingSet.completed)
            reorderPendingOperatingCompanies(state, operatingOrder1822(state))
    }
}

/** Whether a concession's holder may convert it, which begins in phase 2 (§4.8.1). */
function concessionHolder(state: FormationState, companyId: string): Owner | undefined {
    const concession = concessionId(companyId)
    if (getCompany(state, concession).closed) return undefined
    return privateOwner(state, concession)
}

/** Whether a major company starts by converting its concession, as before phase 5 (§3.4.3, §3.4.4). */
function startsByConcession(state: { phaseId: string }): boolean {
    return !Phases1822.isAtLeast(state.phaseId, '5')
}

export const CompanyRules1822: CompanyRules = {
    // A major company starts at £60 to £100: from phase 2 by converting its concession, from
    // phase 5 by buying its director's certificate (§3.4.3, §3.4.4, §3.4.8, §4.8.1).
    startMarketSpaces(state, companyId) {
        if (!major1822(companyId) || !Phases1822.isAtLeast(state.phaseId, '2')) return []
        if (startsByConcession(state) && concessionHolder(state, companyId)?.kind !== 'player')
            return []
        return [...MajorParSpaceIds1822]
    },
    startTerms(state, companyId, buyer, marketSpaceId) {
        if (buyer.kind !== 'player') return 'A player starts a major company.'
        if (playerLoan1822(state, buyer.playerId))
            return 'A player with a loan may not start a company (§4.2.1).'
        const cost = Market1822.space(marketSpaceId).price * directorShares1822(companyId)
        const converting = startsByConcession(state)
        if (converting) {
            const holder = concessionHolder(state, companyId)
            if (holder?.kind !== 'player' || holder.playerId !== buyer.playerId)
                return 'Only the holder of its concession starts this company.'
        }
        const price = converting ? Math.max(0, cost - ConcessionCredit) : cost
        if (price > spendableCash1822(state, buyer.playerId))
            return 'The cash left after the highest bids does not cover the director’s certificate.'
        return { price, recipient: { kind: 'company', companyId }, payers: [buyer] }
    },
    // Converting a concession floats the company at once: the bank adds the concession's £100,
    // or for the LNWR the whole starting price, and the concession is gone (§4.8.3–§4.8.5).
    onStart(state, details) {
        if (!startsByConcession(state)) return
        const company = getCompany(state, details.companyId)
        const cost = details.parPrice * directorShares1822(details.companyId)
        settleCashPayments(state, [
            {
                from: { kind: 'bank' },
                to: { kind: 'company', companyId: details.companyId },
                amount: Math.min(ConcessionCredit, cost)
            }
        ])
        closePrivate(state, concessionId(details.companyId))
        company.floated = true
        company.funded = true
    },
    // From phase 5 a company floats once half its shares are sold; from phase 6 the bank then
    // pays it for the shares it still holds, which go to the bank pool (§3.4.5–§3.4.7).
    flotationPayments(state, companyId) {
        const company = getCompany(state, companyId)
        if (company.kind !== 'major') return undefined
        const unsold = sharesStillToFloat(
            state,
            Charters1822,
            companyId,
            50,
            (certificate) => certificate.poolId === treasuryPoolId(companyId)
        )
        if (unsold !== 0) return undefined
        if (!Phases1822.isAtLeast(state.phaseId, '6')) return []
        assertExists(company.parPrice, 'A started company has a starting price')
        const held = certificatesInPool(state, treasuryPoolId(companyId)).reduce(
            (sum, certificate) => sum + (certificate.kind === 'share' ? certificate.shares : 0),
            0
        )
        return held
            ? [
                  {
                      from: { kind: 'bank' },
                      to: { kind: 'company', companyId },
                      amount: held * company.parPrice
                  }
              ]
            : []
    },
    onFloat(state, companyId) {
        getCompany(state, companyId).funded = true
        if (!Phases1822.isAtLeast(state.phaseId, '6')) return
        for (const certificate of certificatesInPool(state, treasuryPoolId(companyId))) {
            certificate.owner = { kind: 'bank' }
            certificate.poolId = MarketPoolId1822
        }
    }
}

export const BidBoxRules1822: BidBoxRules = {
    increment: BidIncrement1822,
    bidsPerTurn: BidsPerTurn1822,
    tokens(state) {
        const tokens = BiddingTokens1822[state.players.length]
        assertExists(tokens, '1822 is played by three to seven players')
        return tokens
    },
    openingBid: (_state, lotId) => FaceValues1822[lotKind1822(lotId)],
    // No bids with a loan outstanding, nor at the certificate limit, highest bids counting
    // (§4.2.1, §4.9.4).
    restriction(state, playerId) {
        if (playerLoan1822(state, playerId)) return 'A player with a loan may not bid (§4.2.1).'
        const owner = player(playerId)
        return stockCertificateCount(state, owner, StockRules1822) >=
            StockRules1822.certificateLimit(state, owner)
            ? 'A player at the certificate limit may not bid (§4.9.4).'
            : undefined
    },
    round: StockRules1822.round,
    settlement: BidBoxSettlementRules1822
}
