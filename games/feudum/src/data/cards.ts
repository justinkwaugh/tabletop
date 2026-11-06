import { FeudumColors } from '../definition/colors.js'
import type { Character, Good } from './components.js'

/** R-3.5 The eleven cards, in the digest's order. */
export const ActionCardKinds = [
    'migrate',
    'move',
    'influence',
    'improve',
    'explore',
    'harvest',
    'tax',
    'conquer',
    'defend',
    'repeat',
    'guild'
] as const
export type ActionCardKind = (typeof ActionCardKinds)[number]
export type ActionCardId = `card.action.${ActionCardKind}`

/** R-3.4 x2 may be replayed by Repeat; crossed x2 never is; the others show neither. */
export type ReplaySymbol = 'x2' | 'crossed-x2'

export interface CardSymbols {
    readonly replay: ReplaySymbol | null
    /** R-3.4 The card may not be the last a player plays in the round. */
    readonly notLast: boolean
    /** R-3.4 The special ability replaces the regular action. */
    readonly eitherOr: boolean
    readonly icon: 'epic-voyage' | 'region-tile' | null
}

/** R-3.4 One value or a list of them as printed; `variable` is the printed "?". */
export type PrintedVp = readonly number[] | 'variable'

/** R-3.4 What a special ability needs; all of a card's needs must be met. */
export type SpecialNeed =
    | { readonly kind: 'pawn-on-board'; readonly character: Character }
    | { readonly kind: 'pawn-at-location'; readonly character: Character }
    | { readonly kind: 'good'; readonly good: Good }
    | { readonly kind: 'barrel-sulfur' }
    | { readonly kind: 'shillings'; readonly shillings: number }

/** R-3.4 Whether the ability adds to the regular action or replaces it. */
export type SpecialMode = 'in-addition' | 'instead'

export interface SpecialAbility {
    readonly name: string
    readonly needs: readonly SpecialNeed[]
    readonly mode: SpecialMode
    readonly effect: string
    /** The vp the ability prints in place of the card's; null when it prints none. */
    readonly vp: number | null
}

export interface ActionCard {
    readonly id: ActionCardId
    readonly kind: ActionCardKind
    readonly printedName: string
    /** One per colour. */
    readonly count: number
    readonly symbols: CardSymbols
    readonly vp: PrintedVp | null
    /** R-3.14 Flipped when conquered, not on its owner's turn. */
    readonly outOfTurn: boolean
    readonly regularAction: string
    readonly special: SpecialAbility
}

/** R-1.1 */
export const ActionCardsPerKind = FeudumColors.length

const NoSymbols: CardSymbols = { replay: null, notLast: false, eitherOr: false, icon: null }

type ActionCardRow = Pick<ActionCard, 'kind' | 'printedName' | 'regularAction'> &
    Partial<Pick<ActionCard, 'vp' | 'outOfTurn'>> & {
        readonly symbols?: Partial<CardSymbols>
        readonly special: Omit<SpecialAbility, 'mode' | 'vp'> & { readonly vp?: number }
    }

function actionCard(row: ActionCardRow): ActionCard {
    const symbols = { ...NoSymbols, ...row.symbols }
    return {
        id: `card.action.${row.kind}`,
        kind: row.kind,
        printedName: row.printedName,
        count: ActionCardsPerKind,
        symbols,
        vp: row.vp ?? null,
        outOfTurn: row.outOfTurn ?? false,
        regularAction: row.regularAction,
        special: {
            ...row.special,
            // R-3.4 Either/or replaces the regular action; on every other card the ability adds.
            mode: symbols.eitherOr ? 'instead' : 'in-addition',
            vp: row.special.vp ?? null
        }
    }
}

/** R-3.5 The wording is `components.md`'s; the special-ability names are the printed titles. */
export const ActionCards: readonly ActionCard[] = [
    // R-3.6
    actionCard({
        kind: 'migrate',
        printedName: 'Migrate',
        regularAction: 'Move one of your pawns onto or off the board',
        special: {
            name: 'Distant Kin',
            needs: [{ kind: 'pawn-on-board', character: 'alchemist' }],
            effect: 'in addition: enter at any starting space'
        }
    }),
    // R-3.7
    actionCard({
        kind: 'move',
        printedName: 'Move',
        symbols: { replay: 'x2', icon: 'epic-voyage' },
        regularAction: 'Move pieces (allowance = pawns on board + monsters), then pilfer',
        special: {
            name: 'Godspeed',
            needs: [{ kind: 'pawn-on-board', character: 'monk' }],
            effect: 'in addition: one monk +1 move'
        }
    }),
    // R-3.8
    actionCard({
        kind: 'influence',
        printedName: 'Influence',
        symbols: { replay: 'x2' },
        regularAction: 'Add 1 influence marker to each space holding your pawn',
        special: {
            name: 'Money is Influence',
            needs: [
                { kind: 'pawn-at-location', character: 'merchant' },
                { kind: 'shillings', shillings: 1 }
            ],
            effect: 'in addition: unseat a lone ruler'
        }
    }),
    // R-3.9; the vp by the region tile chart, `track.tile-chart.<i..iv>`
    actionCard({
        kind: 'improve',
        printedName: 'Improve',
        symbols: { eitherOr: true, icon: 'region-tile' },
        vp: 'variable',
        regularAction: 'Improve a ruled location, then take a region tile and score',
        special: {
            name: 'Tend Landscape',
            needs: [{ kind: 'good', good: 'wood' }],
            effect: 'instead: place a collected tile as a landscape at a location where you are serf, 2 vp',
            vp: 2
        }
    }),
    // R-3.10
    actionCard({
        kind: 'explore',
        printedName: 'Explore',
        regularAction:
            'Rule an outpost: draw 2 Royal Writs (+1 per other outpost or feudum), keep 1',
        special: {
            name: 'Shovels & Swords',
            needs: [{ kind: 'good', good: 'iron' }],
            effect: 'in addition: draw 2 more, keep 1 more'
        }
    }),
    // R-3.11
    actionCard({
        kind: 'harvest',
        printedName: 'Harvest',
        vp: [1],
        regularAction: 'Harvest goods onto a ruled farm with fewer than 10 goods',
        special: {
            name: 'Inspect the Harvest',
            needs: [{ kind: 'pawn-on-board', character: 'farmer' }],
            effect: 'in addition: draw the total first, choose favors openly'
        }
    }),
    // R-3.12
    actionCard({
        kind: 'tax',
        printedName: 'Tax',
        regularAction: 'Rule a town: take 2 shillings + 1 per other town or feudum',
        special: {
            name: 'Reinforcements',
            needs: [{ kind: 'pawn-on-board', character: 'knight' }],
            effect: 'in addition: take 1 of your influence markers'
        }
    }),
    // R-3.13
    actionCard({
        kind: 'conquer',
        printedName: 'Conquer',
        symbols: { replay: 'crossed-x2', notLast: true, eitherOr: true },
        vp: [2, 4],
        regularAction: "Attack an opponent's pawn, monster or feudum (R-4.8)",
        special: {
            name: 'Starve the People',
            needs: [{ kind: 'pawn-at-location', character: 'noble' }],
            effect: 'instead: remove a subject or serf, 0 vp, may place a military service disc',
            vp: 0
        }
    }),
    // R-3.14
    actionCard({
        kind: 'defend',
        printedName: 'Defend',
        symbols: { replay: 'crossed-x2', eitherOr: true },
        vp: [1],
        outOfTurn: true,
        regularAction: 'Flip out of turn when conquered: +1 defence, 1 vp',
        special: {
            name: 'Royal Immunity',
            needs: [{ kind: 'good', good: 'food' }],
            effect: "instead, out of turn: cancel a Starve the People, put a king's seal under the marker"
        }
    }),
    // R-3.15
    actionCard({
        kind: 'repeat',
        printedName: 'Repeat',
        regularAction: 'Replay one card you already played this round that carries x2',
        special: {
            name: 'Déjà Vu',
            needs: [{ kind: 'good', good: 'saltpeter' }],
            effect: 'replay a card without x2 (never Conquer or Defend)'
        }
    }),
    // R-3.16
    actionCard({
        kind: 'guild',
        printedName: 'Guild',
        symbols: { replay: 'x2', eitherOr: true },
        vp: 'variable',
        regularAction: 'One guild action: trade, pull or push',
        special: {
            name: 'Feast',
            needs: [{ kind: 'barrel-sulfur' }],
            effect: "instead: perform an opponent's guild function on a shared space, +3 vp",
            vp: 3
        }
    })
]

/** R-1.1 */
export const ActionCardTotal = ActionCards.length * ActionCardsPerKind

export interface HarvestChartRow {
    readonly total: number
    readonly partial: number
    readonly favors: number
}

/** R-3.11.2 The chart on the Harvest card. */
export const HarvestCardChart: readonly HarvestChartRow[] = [
    { total: 5, partial: 4, favors: 1 },
    { total: 6, partial: 5, favors: 1 },
    { total: 7, partial: 5, favors: 2 },
    { total: 8, partial: 5, favors: 3 },
    { total: 9, partial: 6, favors: 3 },
    { total: 10, partial: 6, favors: 4 }
]
