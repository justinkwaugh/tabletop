import type { GameAction } from '@tabletop/common'
import {
    GameEndReason,
    isCapitalize,
    isDeterminePlayerOrder,
    isAwardShare,
    isBuildTrack,
    isCompleteExpansion,
    isEndExpansion,
    isPassBid,
    isPassTurn,
    isPayDividends,
    isPlaceBid,
    mapSpace,
    SpaceKind,
    type RailroadId,
    type ShareSale
} from '@tabletop/preussische-ostbahn'

export type DescriptionSegment = string | { playerId: string } | { railroadId: RailroadId }
export type Description = DescriptionSegment[]

export function spaceName(spaceId: string): string {
    const space = mapSpace(spaceId)
    return (
        space.city?.name ??
        (space.kind === SpaceKind.Approach ? 'a Berlin Approach' : 'open country')
    )
}

export function saleDescription(sale: ShareSale): Description {
    return sale.price === 0
        ? [
              { playerId: sale.buyerId },
              ' took a share of ',
              { railroadId: sale.railroadId },
              ' for nothing'
          ]
        : [
              { playerId: sale.buyerId },
              ' won a share of ',
              { railroadId: sale.railroadId },
              ` for $${sale.price}`
          ]
}

export function actionSale(action: GameAction): ShareSale | undefined {
    if (isPlaceBid(action) || isPassBid(action) || isCapitalize(action) || isAwardShare(action)) {
        return action.metadata?.sale
    }
    return undefined
}

export const END_REASONS: Record<GameEndReason, string> = {
    [GameEndReason.Connected]: 'Every railroad connects directly to two others',
    [GameEndReason.Impossible]: 'A railroad can no longer connect to two others'
}

export function expansionDescription(action: GameAction): Description | undefined {
    if (isBuildTrack(action)) {
        const charge = action.metadata ? ` for $${action.metadata.charge}` : ''
        return [
            { playerId: action.playerId },
            ' built ',
            { railroadId: action.railroadId },
            ` track in ${spaceName(action.spaceId)}${charge}`
        ]
    }
    if (!isEndExpansion(action) && !isCompleteExpansion(action)) {
        return undefined
    }
    const result = action.metadata
    if (!result) {
        return ['Finished building']
    }
    return [
        `Built ${result.built.length} `,
        { railroadId: result.railroadId },
        ` track for $${result.spent}`,
        ...(expansionFacts(action) ? [` · ${expansionFacts(action)}`] : [])
    ]
}

export function expansionFacts(action: GameAction, incomeBefore?: number): string | undefined {
    if (!(isEndExpansion(action) || isCompleteExpansion(action)) || !action.metadata) {
        return undefined
    }
    const result = action.metadata
    const cities = result.built.filter(
        (spaceId) => mapSpace(spaceId).kind === SpaceKind.City
    ).length
    const gain = incomeBefore === undefined ? 0 : result.incomeAfter - incomeBefore
    const text = [
        ...(cities > 0 ? [`${cities} ${cities === 1 ? 'city' : 'cities'}`] : []),
        `income $${result.incomeAfter}${gain > 0 ? ` (+$${gain})` : ''}`
    ].join(' · ')
    return text.charAt(0).toUpperCase() + text.slice(1)
}

export function describeAction(action: GameAction): Description {
    if (isPlaceBid(action)) {
        const sale = action.metadata?.sale
        return sale
            ? saleDescription(sale)
            : [{ playerId: action.playerId }, ` bid $${action.amount}`]
    }
    if (isPassBid(action)) {
        const sale = action.metadata?.sale
        return sale
            ? [{ playerId: action.playerId }, ' passed; ', ...saleDescription(sale)]
            : [{ playerId: action.playerId }, ' passed']
    }
    if (isAwardShare(action)) {
        const sale = action.metadata?.sale
        return sale ? saleDescription(sale) : ['Nobody could bid on the share']
    }
    if (isCapitalize(action)) {
        return [
            { playerId: action.playerId },
            ' offered a share of ',
            { railroadId: action.railroadId }
        ]
    }
    const expansion = expansionDescription(action)
    if (expansion) {
        return expansion
    }
    if (isPassTurn(action)) {
        return [{ playerId: action.playerId }, ' passed']
    }
    if (isPayDividends(action) && action.metadata) {
        return ['Dividends paid, double for ', { railroadId: action.metadata.railroadId }]
    }
    if (isDeterminePlayerOrder(action)) {
        const reason = action.metadata?.endReason
        if (reason) {
            return [`Game over: ${END_REASONS[reason]}`]
        }
        return action.playerId
            ? [{ playerId: action.playerId }, ' drew the turn order']
            : ['New turn order drawn']
    }
    return [action.type]
}

export function withoutSubject(description: Description, playerId: string): Description {
    const [first, second, ...rest] = description
    if (typeof first !== 'object' || !('playerId' in first) || first.playerId !== playerId) {
        return description
    }
    if (typeof second !== 'string') {
        return description
    }
    const text = second.trimStart()
    return [text.charAt(0).toUpperCase() + text.slice(1), ...rest]
}
