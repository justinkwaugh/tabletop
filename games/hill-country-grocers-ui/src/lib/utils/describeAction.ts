import type { AxialCoordinates, GameAction } from '@tabletop/common'
import {
    ActionSpace,
    AuctionKind,
    city,
    cityAt,
    companyDefinition,
    isBuildNetwork,
    isChooseAction,
    isDevelop,
    isOpenAuction,
    isPassBid,
    isPayDividends,
    isPlaceBid,
    isSkipBonusCube,
    isTakeDevelopmentCash,
    type CompanyId,
    type ShareSale
} from '@tabletop/hill-country-grocers'

export type DescriptionSegment = string | { playerId: string } | { companyId: CompanyId }
export type Description = DescriptionSegment[]

export const SPACE_NAMES: Record<ActionSpace, string> = {
    [ActionSpace.BuildNetwork]: 'Build Stores',
    [ActionSpace.DevelopTowns]: 'Develop Cities',
    [ActionSpace.AuctionShare]: 'Auction Share'
}

export function hexName(coords: AxialCoordinates): string {
    return cityAt(coords)?.name ?? 'the countryside'
}

function placesDescription(hexes: readonly AxialCoordinates[]): string {
    const cities = hexes.flatMap((coords) => cityAt(coords)?.name ?? [])
    const countryside = hexes.length - cities.length
    const open =
        countryside === 0 ? [] : [`${countryside} countryside hex${countryside === 1 ? '' : 'es'}`]
    return [...cities, ...open].join(' and ')
}

export function saleDescription(sale: ShareSale): Description {
    return [
        { playerId: sale.buyerId },
        ' bought the ',
        { companyId: sale.companyId },
        ` share for $${sale.price}`
    ]
}

// "You" is plural in form, so a lone winner who is the viewer takes "win".
export function winVerb(winnerIds: readonly string[], myPlayerId: string | undefined): string {
    if (winnerIds.length > 1) {
        return 'share the win'
    }
    return winnerIds[0] === myPlayerId ? 'win' : 'wins'
}

export function describeAction(action: GameAction): Description {
    if (isPlaceBid(action)) {
        return [`bid $${action.amount}`]
    }
    if (isPassBid(action)) {
        return ['passed']
    }
    if (isChooseAction(action)) {
        const idle = action.metadata?.nothingToDo ? ' with nothing to do' : ''
        return [`chose ${SPACE_NAMES[action.space]}${idle}`]
    }
    if (isBuildNetwork(action)) {
        const places = placesDescription(action.hexes)
        const metadata = action.metadata
        const stores = action.hexes.length === 1 ? 'a store' : `${action.hexes.length} stores`
        if (!metadata) {
            return ['placed ', stores, ' for ', { companyId: action.companyId }, ` in ${places}`]
        }
        const fees = metadata.fees
            .map((fee) => `$${fee.amount} to ${companyDefinition(fee.companyId).shortName}`)
            .join(', ')
        const waived = metadata.waived > 0 ? `, $${metadata.waived} in fees waived` : ''
        return [
            `placed ${stores} for `,
            { companyId: action.companyId },
            ` in ${places} · $${metadata.bank} to the bank${fees ? `, ${fees}` : ''}${waived}`
        ]
    }
    if (isSkipBonusCube(action)) {
        return ['placed no bonus store']
    }
    if (isDevelop(action)) {
        const paid = action.metadata?.paidCompanyIds ?? []
        const payments =
            paid.length > 0
                ? ` · Balcones pays $1 to ${paid.map((id) => companyDefinition(id).shortName).join(', ')}`
                : ''
        return [`developed ${city(action.cityId).name}${payments}`]
    }
    if (isTakeDevelopmentCash(action)) {
        return ['took $1 instead of a second development']
    }
    if (isOpenAuction(action)) {
        return [
            'put a ',
            { companyId: action.companyId },
            ` share up for auction at $${action.amount}`
        ]
    }
    if (isPayDividends(action)) {
        const metadata = action.metadata
        if (!metadata) {
            return ['Dividends paid']
        }
        const rates = metadata.dividends
            .filter((dividend) => dividend.perShare > 0)
            .map(
                (dividend) =>
                    `${companyDefinition(dividend.companyId).shortName} $${dividend.perShare}`
            )
            .join(', ')
        const label = metadata.final
            ? 'Final dividends'
            : `Dividends, round ${metadata.dividendNumber}`
        return [`${label} per share: ${rates || 'nothing'}`]
    }
    return [action.type]
}

export function actionSale(action: GameAction): ShareSale | undefined {
    if (isPlaceBid(action) || isPassBid(action) || isOpenAuction(action)) {
        return action.metadata?.sale
    }
    return undefined
}

export function withdrawnBidders(action: GameAction): string[] {
    if (isPlaceBid(action) || isOpenAuction(action)) {
        return action.metadata?.withdrawnPlayerIds ?? []
    }
    return []
}

export function isInitialSale(sale: ShareSale): boolean {
    return sale.kind === AuctionKind.Initial
}
