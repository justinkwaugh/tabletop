import type { GameAction } from '@tabletop/common'
import {
    ActionSpaceId,
    HexKind,
    InvestmentItem,
    PlacementKind,
    ShareAuctionKind,
    isChooseAction,
    isClaimInvestment,
    isConsolidate,
    isDeclineInvestment,
    isEndRound,
    isInvestInIndustry,
    isIssueShare,
    isLayTrack,
    isPassBid,
    isPlaceBid,
    isPlaceSealedBid,
    isResolveIndustryAuction,
    isScoreGame,
    isLayTrackSpace,
    type CompanyId,
    type HydratedRailheadsGameState,
    type Industry,
    type LayTrackRules,
    type PlacementEffect,
    type ShareSale
} from '@tabletop/railheads'
import { INDUSTRY_STYLE } from './companyStyle.js'

export type DescriptionSegment =
    string | { playerId: string } | { companyId: CompanyId } | { industry: Industry }
export type Description = DescriptionSegment[]

export const SPACE_NAMES: Record<ActionSpaceId, string> = {
    [ActionSpaceId.IssueShare]: 'Issue Share',
    [ActionSpaceId.IndustryInvestment]: 'Industry Investment',
    [ActionSpaceId.LayTrackIII]: 'Lay Track III',
    [ActionSpaceId.LayTrackII]: 'Lay Track II',
    [ActionSpaceId.LayTrackI]: 'Lay Track I'
}

export const SPACE_DISPLAY_ORDER = [
    ActionSpaceId.IssueShare,
    ActionSpaceId.IndustryInvestment,
    ActionSpaceId.LayTrackI,
    ActionSpaceId.LayTrackII,
    ActionSpaceId.LayTrackIII
] as const

export const SPACE_SHORT_NAMES: Record<ActionSpaceId, string> = {
    [ActionSpaceId.IssueShare]: 'Share',
    [ActionSpaceId.IndustryInvestment]: 'Industry',
    [ActionSpaceId.LayTrackIII]: 'Track III',
    [ActionSpaceId.LayTrackII]: 'Track II',
    [ActionSpaceId.LayTrackI]: 'Track I'
}

export function industryName(industry: Industry): string {
    return INDUSTRY_STYLE[industry].name
}

export function saleDescription(sale: ShareSale): Description {
    const company = { companyId: sale.companyId }
    const extras = [
        sale.industry ? ` with a ${industryName(sale.industry)} token` : '',
        sale.bond ? ', a Government Bond' : '',
        sale.startPlayer ? ' and the Start Player token' : ''
    ].join('')
    if (sale.price === 0 && sale.kind === ShareAuctionKind.Initial) {
        return [{ playerId: sale.buyerId }, ' took the ', company, ` share free${extras}`]
    }
    return [
        { playerId: sale.buyerId },
        ' bought the ',
        company,
        ` share for $${sale.price}${extras}`
    ]
}

export const ITEM_NAMES: Record<InvestmentItem, string> = {
    [InvestmentItem.Industry]: 'industry token',
    [InvestmentItem.CreditSuisse]: 'Credit Suisse share',
    [InvestmentItem.Bond]: 'Government Bond'
}

export function winVerb(winnerIds: readonly string[], myPlayerId: string | undefined): string {
    if (winnerIds.length > 1) {
        return 'share the win'
    }
    return winnerIds[0] === myPlayerId ? 'win' : 'wins'
}

function plural(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? '' : 's'}`
}

export function trackLines(effects: readonly PlacementEffect[]): Description[] {
    const companies = [...new Set(effects.map((effect) => effect.companyId))]
    return companies.map((companyId): Description => {
        const mine = effects.filter((effect) => effect.companyId === companyId)
        const discs = mine.filter((effect) => effect.kind === PlacementKind.Disc).length
        const cubes = mine.length - discs
        const cost = mine.reduce((sum, effect) => sum + effect.cost, 0)
        const gain = mine.reduce((sum, effect) => sum + effect.revenueGain, 0)
        const pieces = [
            discs > 0 ? plural(discs, 'disc') : '',
            cubes > 0 ? plural(cubes, 'cube') : ''
        ]
            .filter((part) => part !== '')
            .join(' and ')
        const tolls = mine.filter((effect) => effect.tollId).length
        const coupled = mine.flatMap((effect) => effect.bonuses ?? [])
        return [
            `laid ${pieces} for the `,
            { companyId },
            ` · $${cost}${gain > 0 ? `, revenue +${gain}` : ''}${tolls > 0 ? ', took the toll chit' : ''}`,
            ...coupled.flatMap((bonus) => [
                '; Underground coupling paid ',
                { companyId: bonus.companyId },
                ` shareholders $${bonus.perShare} a share`
            ])
        ]
    })
}

export function describeAction(action: GameAction): Description {
    if (isPlaceBid(action)) {
        return [`bid $${action.amount}`]
    }
    if (isPassBid(action)) {
        return ['passed']
    }
    if (isChooseAction(action)) {
        const cost = action.metadata ? ` for ${plural(action.metadata.cost, 'coin')}` : ''
        return [`chose ${SPACE_NAMES[action.space]}${cost}`]
    }
    if (isConsolidate(action)) {
        return [`consolidated $${action.metadata?.coins ?? 0} from ${SPACE_NAMES[action.space]}`]
    }
    if (isIssueShare(action)) {
        return [
            'offered a ',
            { companyId: action.companyId },
            ` share, opening at $${action.amount}`
        ]
    }
    if (isInvestInIndustry(action)) {
        const level = action.metadata ? ` (now level ${action.metadata.level})` : ''
        return ['invested in ', { industry: action.industry }, level]
    }
    if (isPlaceSealedBid(action)) {
        return ['placed a sealed bid']
    }
    if (isResolveIndustryAuction(action)) {
        const metadata = action.metadata
        if (!metadata) {
            return ['The industry token was sold']
        }
        if (!metadata.sale) {
            return ['The bids for the ', { industry: metadata.industry }, ' token were revealed']
        }
        return [
            { playerId: metadata.sale.buyerId },
            ' bought the ',
            { industry: metadata.industry },
            ` token for $${metadata.sale.price}`
        ]
    }
    if (isClaimInvestment(action)) {
        const purchase = action.metadata?.purchase
        const price = purchase ? ` for $${purchase.price}` : ''
        const funded = purchase?.fundedCompanyId
            ? [', paying the ', { companyId: purchase.fundedCompanyId }]
            : action.item === InvestmentItem.Bond
              ? [', paying the State Treasury']
              : []
        return [`took the ${ITEM_NAMES[action.item]}${price}`, ...funded]
    }
    if (isDeclineInvestment(action)) {
        return ['passed on the leftover']
    }
    if (isLayTrack(action)) {
        const effects = action.metadata?.effects ?? []
        const loan = action.loan
        const loanLine: Description = loan
            ? [
                  loan.change > 0
                      ? `took ${plural(loan.change, 'loan')} for the `
                      : `repaid ${plural(-loan.change, 'loan')} for the `,
                  { companyId: loan.companyId }
              ]
            : []
        const track: Description =
            effects.length === 0
                ? ['laid no track']
                : trackLines(effects).flatMap((line, index) =>
                      index === 0 ? line : ['; ', ...line]
                  )
        return loan ? [...loanLine, '; ', ...track] : track
    }
    if (isEndRound(action)) {
        const taxed = (action.metadata?.taxes ?? []).reduce((sum, tax) => sum + tax.amount, 0)
        return [
            action.metadata?.final
                ? 'Final payout'
                : `Round ${action.metadata?.round ?? ''} payout`,
            taxed > 0 ? ` after $${taxed} wealth tax` : ''
        ]
    }
    if (isScoreGame(action)) {
        return ['Game-end bonuses paid']
    }
    return [action.type]
}

export function actionSale(action: GameAction): ShareSale | undefined {
    if (isPlaceBid(action) || isPassBid(action) || isIssueShare(action)) {
        return action.metadata?.sale
    }
    return undefined
}

export type BidReveal = { playerId: string; amount: number; note: string }

// Every sealed bid once the auction resolves, in seat order. A seat that never bid stood at the
// minimum (the investor) or at $0.
export function bidReveals(action: GameAction): BidReveal[] {
    if (!isResolveIndustryAuction(action) || !action.metadata) {
        return []
    }
    const bids = action.metadata.sale?.bids ?? action.metadata.bids ?? []
    return bids.map((bid) => {
        const note = bid.submitted ? '' : bid.amount > 0 ? ' (minimum)' : ' (no bid)'
        return { playerId: bid.playerId, amount: bid.amount, note }
    })
}

export function revealedBids(action: GameAction): Description[] {
    return bidReveals(action).map((bid) => [
        { playerId: bid.playerId },
        ` bid $${bid.amount}${bid.note}`
    ])
}

export function withdrawnBidders(action: GameAction): string[] {
    if (isPlaceBid(action) || isIssueShare(action)) {
        return action.metadata?.withdrawnPlayerIds ?? []
    }
    return []
}

export function spaceTerms(space: ActionSpaceId, rules: LayTrackRules | undefined): string[] {
    if (!rules) {
        return [space === ActionSpaceId.IssueShare ? 'Open auction' : 'Sealed bid']
    }
    const pieces = `${rules.placementsPerCompany} ${rules.allowsCrossingCubes ? 'disc/cube' : 'disc'}`
    if (rules.maxCompanies > 1) {
        return [
            `${pieces} × ${rules.maxCompanies} cos`,
            ...(rules.halfPriceWithoutShare ? ['½ unowned'] : [])
        ]
    }
    return rules.requiresShare ? [pieces, 'Shareholder'] : [pieces]
}

export function spaceRules(space: ActionSpaceId, rules: LayTrackRules | undefined): string {
    if (!rules) {
        return space === ActionSpaceId.IssueShare ? 'Open auction' : 'Sealed second-price bid'
    }
    const pieces = rules.allowsCrossingCubes
        ? `${rules.placementsPerCompany} discs or cubes`
        : `${rules.placementsPerCompany} discs`
    if (rules.maxCompanies > 1) {
        return `${pieces} for each of ${rules.maxCompanies} companies${rules.halfPriceWithoutShare ? ', half price for a company you hold no share in' : ''}`
    }
    return rules.requiresShare ? `${pieces} for a company you hold a share in` : pieces
}

export function spaceText(
    state: HydratedRailheadsGameState,
    space: ActionSpaceId
): { terms: string[]; rules: string } {
    const rules = isLayTrackSpace(space) ? state.layTrackRules(space) : undefined
    const definition = state.edition.definition
    const toll = state.edition.map.tolls[0]?.kind === HexKind.Tunnel ? 'tunnel' : 'bridge'
    const terms = spaceTerms(space, rules)
    let text = spaceRules(space, rules)
    if (rules && rules.tolls > 0) {
        terms.push(`1 ${toll}`)
        text += `; may build one ${toll}`
    }
    if (rules?.allowsLoans && definition.loans) {
        terms.push('Loans')
        text += '; may take out or repay loans first'
    }
    if (rules?.discPrice !== undefined) {
        terms.push(`$${rules.discPrice}/disc`)
        text += `; $${rules.discPrice} a disc`
        if (rules.allowsCrossingCubes && rules.cubePrice !== undefined) {
            text += `, $${rules.cubePrice} a cube`
        }
    }
    if (rules?.regionPlacements) {
        terms[0] = terms[0].replace(/^(\d+)/, `$1+${rules.regionPlacements}`)
        text += `; ${rules.regionPlacements} more if every disc stays in the company's region`
    }
    if (rules && rules.maxCompanies === 1 && rules.halfPriceWithoutShare) {
        terms.push('½ unowned')
        text += ', half price for a company you hold no share in'
    }
    const partner = definition.investmentPartner
    if (space === ActionSpaceId.IndustryInvestment && partner) {
        text = `Sealed bids for an industry token and a ${ITEM_NAMES[partner.item]}; bidders pay their own bid`
    }
    return { terms, rules: text }
}
