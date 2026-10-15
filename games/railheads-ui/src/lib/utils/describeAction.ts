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
    type CompanyId,
    type Industry,
    type LayTrackRules,
    type PlacementEffect,
    type ShareSale
} from '@tabletop/railheads'
import { INDUSTRY_STYLE } from './companyStyle.js'

export type DescriptionSegment =
    string | { amount: number } | { playerId: string } | { companyId: CompanyId } | { industry: Industry }
export type Description = DescriptionSegment[]

export const SPACE_NAMES: Record<ActionSpaceId, string> = {
    [ActionSpaceId.IssueShare]: 'Issue Share',
    [ActionSpaceId.IndustryInvestment]: 'Industry Investment',
    [ActionSpaceId.LayTrackIII]: 'Lay Track III',
    [ActionSpaceId.LayTrackII]: 'Lay Track II',
    [ActionSpaceId.LayTrackI]: 'Lay Track I'
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
        ' share for ',
        { amount: sale.price },
        extras
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
            ' · ',
            { amount: cost },
            gain > 0 ? `, revenue +${gain}` : ''
        ]
    })
}

export function describeAction(action: GameAction): Description {
    if (isPlaceBid(action)) {
        return ['bid ', { amount: action.amount }]
    }
    if (isPassBid(action)) {
        return ['passed']
    }
    if (isChooseAction(action)) {
        const chosen = `chose ${SPACE_NAMES[action.space]}`
        return action.metadata
            ? [chosen, ' for ', { amount: action.metadata.cost }]
            : [chosen]
    }
    if (isConsolidate(action)) {
        return ['consolidated ', { amount: action.metadata?.coins ?? 0 }, ` from ${SPACE_NAMES[action.space]}`]
    }
    if (isIssueShare(action)) {
        return [
            'offered a ',
            { companyId: action.companyId },
            ' share, opening at ',
            { amount: action.amount }
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
            ' token for ',
            { amount: metadata.sale.price }
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

export function withdrawnBidders(action: GameAction): string[] {
    if (isPlaceBid(action) || isIssueShare(action)) {
        return action.metadata?.withdrawnPlayerIds ?? []
    }
    return []
}

export function spaceTerms(space: ActionSpaceId, rules: LayTrackRules | undefined): string {
    if (!rules) {
        return space === ActionSpaceId.IssueShare ? 'Open auction' : 'Sealed second-price bid'
    }
    const pieces = rules.allowsCrossingCubes
        ? `${rules.placementsPerCompany} discs or cubes`
        : `${rules.placementsPerCompany} discs`
    if (rules.maxCompanies > 1) {
        return `${pieces} × ${rules.maxCompanies} companies${rules.halfPriceWithoutShare ? ', ½ price unowned' : ''}`
    }
    return rules.requiresShare ? `${pieces}, shareholder` : pieces
}
