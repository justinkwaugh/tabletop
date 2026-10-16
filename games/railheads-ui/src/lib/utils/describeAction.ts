import type { GameAction } from '@tabletop/common'
import {
    ActionSpaceId,
    PlacementKind,
    ShareAuctionKind,
    isChooseAction,
    isConsolidate,
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

export function winVerb(winnerIds: readonly string[], myPlayerId: string | undefined): string {
    if (winnerIds.length > 1) {
        return 'share the win'
    }
    return winnerIds[0] === myPlayerId ? 'win' : 'wins'
}

function plural(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function trackDescription(effects: readonly PlacementEffect[]): Description {
    const companies = [...new Set(effects.map((effect) => effect.companyId))]
    return companies.flatMap((companyId, index): Description => {
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
        return [
            index === 0 ? 'laid ' : '; ',
            pieces,
            ' for the ',
            { companyId },
            ` · $${cost}${gain > 0 ? `, revenue +${gain}` : ''}`
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
        return [
            { playerId: metadata.sale.buyerId },
            ' bought the ',
            { industry: metadata.industry },
            ` token for $${metadata.sale.price}`
        ]
    }
    if (isLayTrack(action)) {
        const effects = action.metadata?.effects ?? []
        return effects.length === 0 ? ['laid no track'] : trackDescription(effects)
    }
    if (isEndRound(action)) {
        return [
            action.metadata?.final ? 'Final payout' : `Round ${action.metadata?.round ?? ''} payout`
        ]
    }
    if (isScoreGame(action)) {
        return ['Railroad and industry bonuses paid']
    }
    return [action.type]
}

export function actionSale(action: GameAction): ShareSale | undefined {
    if (isPlaceBid(action) || isPassBid(action) || isIssueShare(action)) {
        return action.metadata?.sale
    }
    return undefined
}

// Every sealed bid once the auction resolves, in seat order. A seat that never bid stood at the
// minimum (the investor) or at $0.
export function revealedBids(action: GameAction): Description[] {
    if (!isResolveIndustryAuction(action) || !action.metadata) {
        return []
    }
    return action.metadata.sale.bids.map((bid) => {
        const note = bid.submitted ? '' : bid.amount > 0 ? ' (minimum)' : ' (no bid)'
        return [{ playerId: bid.playerId }, ` bid $${bid.amount}${note}`]
    })
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
    return { terms: spaceTerms(space, rules), rules: spaceRules(space, rules) }
}
