import type { BeadValue, Good, VesselType } from '@tabletop/feudum'
import type {
    SeatCardFace,
    SeatPanelView,
    SeatPlayedCard,
    SeatPouch,
    SeatTile,
    SeatWrits
} from './seatPanel.js'

/**
 * Contract, Seat panel: the panel's three lines under its ribbon, read from the one derivation of
 * the seat. Cards first, then what the seat spends, then what it holds. An optional piece the seat
 * has none of is not on a line; the five goods always are, so a missing good reads as 0.
 */
export type SeatCardsItem =
    | { readonly item: 'backs'; readonly count: number }
    | { readonly item: 'in-hand'; readonly count: number }
    | { readonly item: 'face'; readonly card: SeatCardFace }
    | { readonly item: 'played'; readonly card: SeatPlayedCard }
    | { readonly item: 'choosing' }

export type SeatSupplyItem =
    | { readonly item: 'good'; readonly good: Good; readonly count: number }
    | { readonly item: 'shillings'; readonly count: number }
    | { readonly item: 'seals'; readonly count: number }
    | { readonly item: 'bead'; readonly value: BeadValue }

export type SeatHoldingsItem =
    | { readonly item: 'markers'; readonly count: number }
    | { readonly item: 'discs'; readonly free: number; readonly of: number }
    | { readonly item: 'barrel'; readonly sulfur: number; readonly capacity: number }
    | { readonly item: 'writs'; readonly writs: SeatWrits; readonly count: number }
    | { readonly item: 'tile'; readonly tile: SeatTile }
    | { readonly item: 'vessel'; readonly vessel: VesselType; readonly count: number }
    | {
          readonly item: 'pouch'
          readonly pouch: Exclude<SeatPouch, { status: 'empty' | 'choosing' }>
      }

export interface SeatLines {
    readonly cards: readonly SeatCardsItem[]
    readonly supply: readonly SeatSupplyItem[]
    readonly holdings: readonly SeatHoldingsItem[]
}

/** R-3.1, R-3.2, R-3.3 The backs or the count, then the played cards; "choosing" before a pouch. */
function cardsLine({ cards, pouch }: SeatPanelView): readonly SeatCardsItem[] {
    const choosing = pouch.status === 'choosing' || pouch.status === 'drafted'
    const hand: SeatCardsItem[] = cards.handOnDesk
        ? choosing && cards.handCount === 0
            ? []
            : [{ item: 'in-hand', count: cards.handCount }]
        : [
              ...(cards.handBacks > 0 ? [{ item: 'backs' as const, count: cards.handBacks }] : []),
              ...cards.handFaces.map((card) => ({ item: 'face' as const, card }))
          ]
    return [
        ...(choosing ? [{ item: 'choosing' as const }] : []),
        ...hand,
        ...cards.played.map((card) => ({ item: 'played' as const, card }))
    ]
}

/** R-5.3, R-5-H1, R-3.11.1 Goods and shillings always; seals and beads only when held. */
function supplyLine({ supply }: SeatPanelView): readonly SeatSupplyItem[] {
    return [
        ...supply.goods.map(({ good, count }) => ({ item: 'good' as const, good, count })),
        { item: 'shillings', count: supply.shillings },
        ...(supply.seals > 0 ? [{ item: 'seals' as const, count: supply.seals }] : []),
        ...supply.beads.map((value) => ({ item: 'bead' as const, value }))
    ]
}

/** R-1.1, R-4.10.2, R-4.4.4 Markers, discs, barrel and writs always; the rest only when held. */
function holdingsLine({
    supply,
    barrel,
    writs,
    pouch
}: SeatPanelView): readonly SeatHoldingsItem[] {
    const count = writs.backs + writs.sealedBacks + writs.faces.length + writs.sealedFaces.length
    return [
        { item: 'markers', count: supply.markers },
        { item: 'discs', free: supply.freeDiscs, of: supply.discsOf },
        { item: 'barrel', ...barrel },
        { item: 'writs', writs, count },
        ...supply.tiles.map((tile) => ({ item: 'tile' as const, tile })),
        ...supply.vessels
            .filter(({ count }) => count > 0)
            .map(({ vessel, count }) => ({ item: 'vessel' as const, vessel, count })),
        ...(pouch.status === 'finalised' ||
        pouch.status === 'drafted' ||
        pouch.status === 'committed'
            ? [{ item: 'pouch' as const, pouch }]
            : [])
    ]
}

export function seatLinesOf(view: SeatPanelView): SeatLines {
    return { cards: cardsLine(view), supply: supplyLine(view), holdings: holdingsLine(view) }
}

/**
 * R-3.7.5, R-4.9.2 The ribbon's shield, when the seat has served or is a vassal: what the board's
 * service and voyage tracks say of this seat, as its tooltip. Absent otherwise.
 */
export function serviceShieldOf({ service, voyage }: SeatPanelView): string | undefined {
    if (service.covered === 0 && !service.vassal) {
        return undefined
    }
    return [
        `Service ${service.covered}/${service.of}`,
        ...(service.vassal ? ['vassal'] : []),
        ...(voyage === undefined ? [] : [`voyage ${voyage}`])
    ].join(' · ')
}

/** R-1.1 The panel's tooltip names the pawns in supply, which the board cannot show. */
export function pawnsNoteOf({ pawnsInSupply }: SeatPanelView): string | undefined {
    return pawnsInSupply > 0
        ? `${pawnsInSupply} ${pawnsInSupply === 1 ? 'pawn' : 'pawns'} in supply`
        : undefined
}
