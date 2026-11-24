import {
    type Good,
    Goods,
    GuildById,
    type GuildId,
    type HydratedFeudumGameState,
    knightTradeOffer,
    MerchantTradeGoods,
    nobleTradeOffer,
    plural,
    type VesselType,
    VesselTypes
} from '@tabletop/feudum'
import { paymentTotal, type BenchChoice, type BenchItem, type BenchOffer } from './benchOffer.js'
import type { GhostPiece } from './benchView.js'
import { seatRowId } from './knightLanes.js'

/** Contract, Guild and Feast: the trade picker restates no rule and decides nothing. */

export interface TradeCard {
    readonly item: BenchItem
    readonly name: string
    readonly words?: string
    readonly price?: number
    readonly gain: readonly GhostPiece[]
    readonly gainWords?: string
    readonly label: string
    readonly stock?: string
    readonly press?: BenchChoice
}

export interface TradeBasket {
    readonly picks: readonly GhostPiece[]
    readonly total: number
    readonly most: number
}

export interface TradePicker {
    readonly guild: GuildId
    readonly title: string
    readonly line: string
    readonly purse: number
    readonly cards: readonly TradeCard[]
    readonly basket?: TradeBasket
    readonly sends: 'each' | 'one'
}

/** R-4.6.3 Which trades the picker reads: the Farmer's goes to the map, so it keeps the bench. */
export function takesTradePicker(bench: BenchOffer): boolean {
    return bench.fn === 'trade' && bench.guild !== 'farmer' && bench.collapsed === undefined
}

const MostDrawn = 6

function shillings(price: number | undefined): string {
    return price === undefined ? '' : `${price}s`
}

function costToGain(name: string, price: number | undefined, gain: string): string {
    return price === undefined ? `${name} → ${gain}` : `${name}: ${shillings(price)} → ${gain}`
}

function idOf(item: BenchItem): string {
    return item.id.slice(item.id.indexOf(':') + 1)
}

function goodOf(id: string): Good | undefined {
    return Goods.find((good) => `good:${good}` === id)
}

function vesselOf(id: string): VesselType | undefined {
    return VesselTypes.find((vessel) => `vessel:${vessel}` === id)
}

function pressOf(item: BenchItem, label: string, shown?: string): BenchChoice | undefined {
    if (!item.press && !item.spent) {
        return undefined
    }
    return {
        label,
        ...(shown ? { shown } : {}),
        picked: item.picked,
        ...(item.press ? { press: item.press } : {}),
        ...(item.spent ? { spent: true } : {})
    }
}

function buy(item: BenchItem, gain: string): BenchChoice | undefined {
    return pressOf(item, `Buy ${gain} · ${shillings(item.price)}`, 'Buy')
}

function alchemistCards(bench: BenchOffer): readonly TradeCard[] {
    return bench.items.flatMap((item): TradeCard[] => {
        const vessel = vesselOf(item.id)
        if (!vessel) {
            return []
        }
        const gain = item.label.toLowerCase()
        const press = buy(item, gain)
        return [
            {
                item,
                name: item.label,
                ...(item.price !== undefined ? { price: item.price } : {}),
                gain: [{ kind: 'vessel', vessel }],
                label: costToGain(item.label, item.price, gain),
                ...(press ? { press } : {})
            }
        ]
    })
}

function knightCards(
    bench: BenchOffer,
    state: HydratedFeudumGameState,
    playerId: string
): readonly TradeCard[] {
    const item = bench.items.find(({ id }) => id === 'row:seat')
    if (!item) {
        return []
    }
    const { markers } = knightTradeOffer(state, playerId)
    const row = seatRowId(state, playerId)
    if (!row) {
        return []
    }
    const gain = plural(markers, 'marker')
    const press = buy(item, gain)
    return [
        {
            item,
            name: 'Your row',
            words: `take ${markers}`,
            ...(item.price !== undefined ? { price: item.price } : {}),
            gain: Array.from({ length: Math.min(markers, MostDrawn) }, () => ({
                kind: 'marker' as const,
                row
            })),
            label: costToGain("Your row's markers", item.price, gain),
            ...(press ? { press } : {})
        }
    ]
}

function boughtOf(bench: BenchOffer, item: BenchItem): number {
    return bench.ghosts.filter((ghost) => ghost.item === item.id).length
}

function merchantCards(bench: BenchOffer): readonly TradeCard[] {
    return bench.items.flatMap((item): TradeCard[] => {
        const good = goodOf(item.id)
        if (!good) {
            return []
        }
        const bought = boughtOf(bench, item)
        const label = costToGain(item.label, item.price, good)
        const press = pressOf(item, label)
        return [
            {
                item,
                name: item.label,
                ...(item.price !== undefined ? { price: item.price } : {}),
                gain: [{ kind: 'good', good }],
                label,
                stock: bought > 0 ? `${bought} bought` : `${item.count ?? 0} in bin`,
                ...(press ? { press } : {})
            }
        ]
    })
}

function scrollWords(item: BenchItem): string {
    const [, row, column] = /r(\d)c(\d)$/.exec(item.id) ?? []
    return row && column ? `row ${row}, space ${column}` : idOf(item)
}

function nobleCards(bench: BenchOffer): readonly TradeCard[] {
    return bench.items.flatMap((item): TradeCard[] => {
        if (!item.id.startsWith('scroll:')) {
            return []
        }
        const name = `Seal ${scrollWords(item)}`
        const label = costToGain(name, item.price, "king's seal")
        const press = pressOf(item, label)
        return [
            {
                item,
                name,
                ...(item.price !== undefined ? { price: item.price } : {}),
                gain: [{ kind: 'seal' }],
                label,
                ...(press ? { press } : {})
            }
        ]
    })
}

function monkCards(bench: BenchOffer): readonly TradeCard[] {
    const beads = bench.items.filter(({ id }) => id.startsWith('bead:'))
    const [first] = beads
    if (!first) {
        return []
    }
    const values = beads.map(({ label }) => label.replace(/^Bead /, ''))
    const gainWords = `bead ${values.join(' or ')}`
    return [
        {
            item: first,
            name: 'Draw a bead',
            // R-4.6.3, R-4.6-H2 A draw that reveals a bead can't be undone.
            ...(bench.preview?.revealsInfo ? { words: "can't be undone" } : {}),
            ...(first.price !== undefined ? { price: first.price } : {}),
            gain: [],
            gainWords,
            label: costToGain('Draw a bead', first.price, gainWords)
        }
    ]
}

function basketOf(bench: BenchOffer, most: number): TradeBasket {
    const picks = bench.ghosts.flatMap((ghost): GhostPiece[] => {
        const good = goodOf(ghost.item)
        if (good) {
            return [{ kind: 'good', good }]
        }
        return ghost.item.startsWith('scroll:') ? [{ kind: 'seal' }] : []
    })
    const payment = bench.preview?.payment
    const total = payment ? paymentTotal(payment) : 0
    return { picks, total: picks.length > 0 ? total : 0, most }
}

/** R-4.6.2, R-4.6.3 The trade on the bench, as its picker reads it; undefined for any other bench. */
export function tradePickerOf(
    bench: BenchOffer,
    state: HydratedFeudumGameState,
    playerId: string
): TradePicker | undefined {
    if (!takesTradePicker(bench)) {
        return undefined
    }
    const common = {
        guild: bench.guild,
        title: `${GuildById[bench.guild].name} trade`,
        purse: state.getPlayerState(playerId).shillings
    }
    switch (bench.guild) {
        case 'alchemist':
            return { ...common, line: 'Buy 1', cards: alchemistCards(bench), sends: 'each' }
        case 'knight':
            return {
                ...common,
                line: 'Take row',
                cards: knightCards(bench, state, playerId),
                sends: 'each'
            }
        case 'merchant':
            return {
                ...common,
                line: `Buy up to ${MerchantTradeGoods}`,
                cards: merchantCards(bench),
                basket: basketOf(bench, MerchantTradeGoods),
                sends: 'one'
            }
        case 'noble': {
            const { most, price } = nobleTradeOffer(state)
            return {
                ...common,
                line: `Buy up to ${most} · ${shillings(price)} each`,
                cards: nobleCards(bench),
                basket: basketOf(bench, most),
                sends: 'one'
            }
        }
        case 'monk':
            return { ...common, line: 'Draw 1 of 2', cards: monkCards(bench), sends: 'one' }
        case 'farmer':
            return undefined
    }
}
