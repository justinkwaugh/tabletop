import type { GameAction } from '@tabletop/common'
import {
    BoardNodeKind,
    LeftoverChoice,
    PROMONTORY,
    TOWN_TILE_KINDS,
    TownEventKind,
    isBuyShare,
    isEndTurn,
    isPayRepairs,
    isPlaceTrack,
    isRevealHand,
    isScrapTrack,
    isSellShare,
    sharePriceAt,
    type DistressSale,
    type PlaceTrack,
    type RailroadId,
    type TownEffectOutcome
} from '@tabletop/promontory-point'
import { RAILROAD_TAGS } from '$lib/model/railroadTags.js'

// A description is words, railroad tags and seat names, so the panel can colour and name them.
export type DescriptionPart =
    | { kind: 'text'; text: string }
    | { kind: 'railroad'; railroadId: RailroadId }
    | { kind: 'player'; playerId: string }

function text(value: string): DescriptionPart {
    return { kind: 'text', text: value }
}

function railroad(railroadId: RailroadId): DescriptionPart {
    return { kind: 'railroad', railroadId }
}

function player(playerId: string): DescriptionPart {
    return { kind: 'player', playerId }
}

function dollars(amount: number): string {
    return `$${amount}`
}

// Joins groups of parts with commas, as in "CP, UP, KP" or "Mara $2, Theo $8".
function listed(groups: DescriptionPart[][]): DescriptionPart[] {
    return groups.flatMap((group, index) => (index === 0 ? group : [text(', '), ...group]))
}

function railroads(railroadIds: readonly RailroadId[]): DescriptionPart[] {
    return listed(railroadIds.map((railroadId) => [railroad(railroadId)]))
}

// R-2.2 step 1, R-5: the turn pieces turned face up for every seat.
function revealed(pieces: readonly RailroadId[]): DescriptionPart[] {
    return pieces.length > 0
        ? [text('revealed '), ...railroads(pieces)]
        : [text('revealed nothing')]
}

// R-3.3, R-4.2: where the piece went, then what its town did.
function placed(action: PlaceTrack): DescriptionPart[] {
    const metadata = action.metadata
    const piece = [text('placed '), railroad(action.railroadId)]
    if (metadata === undefined) {
        return piece
    }
    if (metadata.spaceKind === BoardNodeKind.Empty) {
        return [...piece, text(' in open country')]
    }
    const where =
        metadata.townEffectId === PROMONTORY.spaceId ||
        metadata.spaceKind === BoardNodeKind.Promontory
            ? text(' at Promontory')
            : metadata.townEffectId !== undefined
              ? text(` on a ${TOWN_TILE_KINDS[metadata.townEffectId].name} town`)
              : text(' on a town')
    return metadata.outcome === undefined
        ? [...piece, where]
        : [...piece, where, text(': '), ...townOutcome(metadata.outcome)]
}

// R-4.2, R-1.2, R-4.3, R-4.3-H1: a price move, a Dividend or a Repairs bill, as recorded.
function townOutcome(outcome: TownEffectOutcome): DescriptionPart[] {
    switch (outcome.kind) {
        case TownEventKind.PriceChange: {
            const before = sharePriceAt(outcome.priceIndexBefore)
            const after = sharePriceAt(outcome.priceIndexAfter)
            return [
                railroad(outcome.railroadId),
                text(` ${dollars(before)} → ${dollars(after)}${outcome.capped ? ' (capped)' : ''}`)
            ]
        }
        case TownEventKind.Dividend:
            return outcome.payments.length === 0
                ? [text('Dividend pays no one')]
                : [
                      text('Dividend pays '),
                      ...listed(
                          outcome.payments.map((payment) => [
                              player(payment.playerId),
                              text(` ${dollars(payment.amount)}`)
                          ])
                      )
                  ]
        case TownEventKind.Repairs: {
            if (outcome.bills.length === 0) {
                return [text('bills no one')]
            }
            const bills = listed(
                outcome.bills.map((bill) => [player(bill.playerId), text(` ${dollars(bill.owed)}`)])
            )
            const debtors = outcome.debtors.map((debtor) => debtor.playerId)
            if (debtors.length === 0) {
                return [text('bills '), ...bills, text(', all paid')]
            }
            const short = debtors.flatMap((playerId, index) => [
                ...(index === 0 ? [] : [text(index === debtors.length - 1 ? ' and ' : ', ')]),
                player(playerId)
            ])
            return [text('bills '), ...bills, text('; '), ...short, text(' short')]
        }
    }
}

// R-3.3-H1, R-5: the scrapped piece and its replacement are public.
function scrapped(
    railroadId: RailroadId,
    replacement: RailroadId | undefined,
    bagEmpty: boolean
): DescriptionPart[] {
    const piece = [text('set aside '), railroad(railroadId)]
    if (replacement !== undefined) {
        return [...piece, text(' and drew '), railroad(replacement)]
    }
    return bagEmpty ? [...piece, text('; the bag is empty, one placement fewer')] : piece
}

function counted(sales: readonly DistressSale[]): DescriptionPart[] {
    const shares = new Map<RailroadId, number>()
    for (const sale of sales) shares.set(sale.railroadId, (shares.get(sale.railroadId) ?? 0) + 1)
    return listed(
        [...shares].map(([railroadId, count]) => [text(`${count} `), railroad(railroadId)])
    )
}

// R-4.3, R-4.3-H2, R-4.3-H3: the distress sales, the payment and anything forgiven.
function paidRepairs(
    sales: readonly DistressSale[],
    paid: number,
    forgiven: number
): DescriptionPart[] {
    const raised = sales.reduce((sum, sale) => sum + sale.proceeds, 0)
    if (forgiven > 0) {
        const sold =
            sales.length === 0
                ? [text('had no share to sell')]
                : [text(`sold all ${sales.length} for ${dollars(raised)}`)]
        return [...sold, text(`, paid ${dollars(paid)}, ${dollars(forgiven)} forgiven`)]
    }
    if (sales.length === 0) {
        return [text(`paid ${dollars(paid)}`)]
    }
    return [
        text('sold '),
        ...counted(sales),
        text(` at half price (${dollars(raised)}) and paid ${dollars(paid)}`)
    ]
}

// R-2.2 step 4, R-5, R-6.3: the drawer alone reads the drawn pieces; others read the count.
function endedTurn(action: GameAction, viewerId: string | undefined): DescriptionPart[] {
    if (!isEndTurn(action) || action.metadata === undefined) {
        return [text('ended the turn')]
    }
    const { drawn, drawnCount, leftover, leftoverPiece } = action.metadata
    // R-6.3-H2: the leftover piece was face up, so every seat reads its railroad.
    const piece: DescriptionPart[] =
        leftoverPiece === undefined ? [text('a piece')] : [railroad(leftoverPiece)]
    const kept =
        leftover === LeftoverChoice.Kept
            ? [text(', kept '), ...piece]
            : leftover === LeftoverChoice.Returned
              ? [text(', returned '), ...piece, text(' to the bag')]
              : []
    const draw: DescriptionPart[] =
        drawnCount === 0
            ? [text(' and drew nothing: the bag is empty')]
            : viewerId === action.playerId && drawn !== undefined && drawn.length === drawnCount
              ? [text(' and drew '), ...railroads(drawn)]
              : [text(` and drew ${drawnCount}`)]
    return [text('ended the turn'), ...kept, ...draw]
}

// R-5: each action as the seat viewing it may read it; a spectator passes no viewer.
// Built from input and metadata alone, never from an action's patches.
export function describeAction(
    action: GameAction,
    viewerId: string | undefined
): DescriptionPart[] | undefined {
    if (isRevealHand(action)) {
        return revealed(action.metadata?.pieces ?? [])
    }
    if (isBuyShare(action)) {
        const price = action.metadata ? ` for ${dollars(action.metadata.price)}` : ''
        return [text('bought a '), railroad(action.railroadId), text(` share${price}`)]
    }
    if (isSellShare(action)) {
        const price = action.metadata ? ` for ${dollars(action.metadata.price)}` : ''
        return [text('sold a '), railroad(action.railroadId), text(` share${price}`)]
    }
    if (isPlaceTrack(action)) {
        return placed(action)
    }
    if (isScrapTrack(action)) {
        return scrapped(
            action.railroadId,
            action.metadata?.replacement,
            action.metadata?.bagEmpty ?? false
        )
    }
    if (isPayRepairs(action)) {
        return action.metadata
            ? paidRepairs(action.metadata.sales, action.metadata.paid, action.metadata.forgiven)
            : [text('paid Repairs')]
    }
    if (isEndTurn(action)) {
        return endedTurn(action, viewerId)
    }
    return undefined
}

// Plain text for a description, with each seat named by the caller.
export function descriptionText(
    parts: readonly DescriptionPart[],
    nameOf: (playerId: string) => string
): string {
    return parts
        .map((part) =>
            part.kind === 'text'
                ? part.text
                : part.kind === 'railroad'
                  ? RAILROAD_TAGS[part.railroadId]
                  : nameOf(part.playerId)
        )
        .join('')
}
