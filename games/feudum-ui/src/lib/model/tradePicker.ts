import {
    GuildById,
    knightTradeOffer,
    MerchantTradeGoods,
    nobleTradeOffer,
    type Good,
    type GuildId,
    type HydratedFeudumGameState,
    type VesselType
} from '@tabletop/feudum'
import type { BenchChoice, BenchItem, BenchOffer } from './benchOffer.js'
import type { GhostPiece } from './benchView.js'

/**
 * Contract, Guild and Feast, The trade picker: a guild's trade read as choice cards beside its board
 * turned upright. It reads the bench offer, whose prices, limits and presses are the logic's; it
 * restates no rule and decides nothing.
 */

/** One offer of the trade: its art, name, a few words, and cost → gain. */
export interface TradeCard {
    readonly item: BenchItem
    readonly name: string
    readonly words?: string
    readonly price?: number
    /** What a Buy brings, in art. */
    readonly gain: readonly GhostPiece[]
    /** What a Buy brings, in words, where art can't say it: the beads a draw chooses between. */
    readonly gainWords?: string
    /** The card's accessible name: "Ship: 3s → ship". */
    readonly label: string
    /** "3 in bin", "next one · 2 bought". */
    readonly stock?: string
    /** The card's press: a Buy that sends, or a pick that adds to the basket. */
    readonly press?: BenchChoice
}

export interface TradeBasket {
    readonly picks: readonly GhostPiece[]
    readonly total: number
    readonly most: number
}

export interface TradePicker {
    readonly guild: GuildId
    /** "Alchemist trade". */
    readonly title: string
    /** "buy 1 vessel for sale". */
    readonly line: string
    /** What the seat can spend. */
    readonly purse: number
    readonly cards: readonly TradeCard[]
    readonly basket?: TradeBasket
    /** R-4.6.2 The bench's own further choices, as the Merchant's sulfur into the barrel. */
    readonly choices: readonly BenchChoice[]
    /** `each`: each card's Buy is the send. `one`: the picks add up, sent once under them. */
    readonly sends: 'each' | 'one'
    readonly caption: string
}

/** R-4.6.3 Which trades the picker reads: the Farmer's goes to the map, so it keeps the bench. */
export function takesTradePicker(bench: BenchOffer): boolean {
    return bench.fn === 'trade' && bench.guild !== 'farmer' && bench.collapsed === undefined
}

const VesselWords: Readonly<Record<VesselType, string>> = {
    ship: 'for ship routes',
    submersible: 'for submersible routes',
    'flying-machine': 'for flying-machine routes'
}

/** Up to this many of a gain are drawn; past it the words carry the number. */
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

/** The press a card takes, named for the card, with no rose note: the card says the price. */
function pressOf(item: BenchItem, label: string, shown?: string): BenchChoice | undefined {
    if (!item.press && item.refusal === undefined) {
        return undefined
    }
    return {
        label,
        ...(shown ? { shown } : {}),
        picked: item.picked,
        ...(item.press ? { press: item.press } : {}),
        ...(item.refusal !== undefined ? { refusal: item.refusal } : {})
    }
}

function buy(item: BenchItem, gain: string): BenchChoice | undefined {
    return pressOf(item, `Buy ${gain} · ${shillings(item.price)}`, `Buy · ${shillings(item.price)}`)
}

function alchemistCards(bench: BenchOffer): readonly TradeCard[] {
    return bench.items.flatMap((item): TradeCard[] => {
        const vessel = idOf(item) as VesselType
        if (!item.id.startsWith('vessel:') || !(vessel in VesselWords)) {
            return []
        }
        const gain = item.label.toLowerCase()
        const press = buy(item, gain)
        return [
            {
                item,
                name: item.label,
                words: VesselWords[vessel],
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
    const row = state.guilds.knight.rows.findIndex((held) => held.playerId === playerId)
    const gain = `${markers} marker${markers === 1 ? '' : 's'}`
    const press = buy(item, gain)
    return [
        {
            item,
            name: "Your row's markers",
            // R-4.6.3 Tame the Beast is asked once the markers are 3 or more.
            words:
                markers >= 3
                    ? `take all ${markers}; 3 or more may tame a beast`
                    : `take all ${markers}`,
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
        if (!item.id.startsWith('good:')) {
            return []
        }
        const good = idOf(item) as Good
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
                stock: bought > 0 ? `next one · ${bought} bought` : `${item.count ?? 0} in bin`,
                ...(press ? { press } : {})
            }
        ]
    })
}

/** "r1c2" → "row 1, space 2". */
function scrollWords(item: BenchItem): string {
    const [, row, column] = /r(\d)c(\d)$/.exec(item.id) ?? []
    return row && column ? `row ${row}, space ${column}` : idOf(item)
}

function nobleCards(bench: BenchOffer): readonly TradeCard[] {
    return bench.items.flatMap((item): TradeCard[] => {
        if (!item.id.startsWith('scroll:')) {
            return []
        }
        const name = `Seal, ${scrollWords(item)}`
        const label = costToGain(name, item.price, "king's seal")
        const press = pressOf(item, label)
        return [
            {
                item,
                name,
                words: 'red side up, unseen',
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
            words: `draw one · ${shillings(first.price)}${bench.preview?.revealsInfo ? " · can't be undone" : ''}`,
            ...(first.price !== undefined ? { price: first.price } : {}),
            gain: [],
            gainWords,
            label: costToGain('Draw a bead', first.price, gainWords)
        }
    ]
}

function basketOf(bench: BenchOffer, most: number): TradeBasket {
    const picks = bench.ghosts.flatMap((ghost): GhostPiece[] => {
        if (ghost.item.startsWith('good:')) {
            return [{ kind: 'good', good: ghost.item.slice('good:'.length) as Good }]
        }
        return ghost.item.startsWith('scroll:') ? [{ kind: 'seal' }] : []
    })
    const payment = bench.preview?.payment
    const total = payment
        ? payment.members.reduce((sum, { amount }) => sum + amount, 0) +
          payment.charity.amount +
          payment.generalSupply
        : 0
    return { picks, total: picks.length > 0 ? total : 0, most }
}

function listed(names: readonly string[]): string {
    return names.length <= 1
        ? (names[0] ?? '')
        : `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}`
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
        purse: state.getPlayerState(playerId).shillings,
        choices: bench.rows
    }
    switch (bench.guild) {
        case 'alchemist': {
            const cards = alchemistCards(bench)
            const names = cards.map(({ name }) => name.toLowerCase())
            return {
                ...common,
                line: 'buy 1 vessel for sale',
                cards,
                sends: 'each',
                caption: `For sale this round: ${listed(names)}, ringed on the board. Each Buy sends; Undo takes it back.`
            }
        }
        case 'knight':
            return {
                ...common,
                line: "take your row's markers",
                cards: knightCards(bench, state, playerId),
                sends: 'each',
                caption:
                    'Your row is ringed on the board. Buy sends, or asks first whether to tame a beast; Undo takes it back.'
            }
        case 'merchant':
            return {
                ...common,
                line: `buy up to ${MerchantTradeGoods} · each bin sells its cheapest`,
                cards: merchantCards(bench),
                basket: basketOf(bench, MerchantTradeGoods),
                sends: 'one',
                caption:
                    'Each bin is ringed on the board. A press adds its cheapest good to the basket; Undo takes the last one back.'
            }
        case 'noble': {
            const { most, price } = nobleTradeOffer(state)
            return {
                ...common,
                line: `buy up to ${most} · ${shillings(price)} each`,
                cards: nobleCards(bench),
                basket: basketOf(bench, most),
                sends: 'one',
                caption:
                    'The seals on the scrolls are ringed on the board. Which space a seal leaves matters to later pulls.'
            }
        }
        case 'monk':
            return {
                ...common,
                line: 'draw one of two beads',
                cards: monkCards(bench),
                sends: 'one',
                caption: 'The two beads the draw chooses between are ringed on the board.'
            }
        case 'farmer':
            return undefined
    }
}
