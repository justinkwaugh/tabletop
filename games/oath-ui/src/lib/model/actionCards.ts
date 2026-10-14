import {
    ActionType,
    MachineState,
    offeredChoices,
    freeActionTypesNow,
    powerKey,
    usableModifiers,
    type CardPower,
    type HydratedOathGameState,
    type ModifierUse,
    type PowerCost,
    type PowerUseKey
} from '@tabletop/oath'
import { musterRows } from './musterRows.js'
import {
    NO_OPTION,
    allowsSeveral,
    emptyPicks,
    powerChoicesFrom,
    withOptionPick,
    type PowerChoicePicks
} from './powerChoices.js'
import { powerUseKey, samePowerUse } from './powerUse.js'
import { recoverRows } from './recoverRows.js'
import { searchRows } from './searchRows.js'
import { tradeRows } from './tradeRows.js'
import { travelOffer, travelRows } from './travelRows.js'

/** R-7.4 — the major actions a modifier card is declared on. */
export const CARD_ACTIONS = [
    ActionType.Search,
    ActionType.Travel,
    ActionType.Muster,
    ActionType.Trade,
    ActionType.Recover
] as const

export type CardAction = (typeof CARD_ACTIONS)[number]

/** Whether the action can be taken without the card. */
export type ActionCardKind = 'makesPossible' | 'changes'

export interface ActionCard {
    cardId: string
    powerIndex: number
    action: CardAction
    kind: ActionCardKind
    /** What using the card brings beyond its cost, said before it is used. */
    consequence?: string
    /** The second card of a pair: an action only the two together make possible. */
    with?: PowerUseKey
}

/**
 * What using a card brings beyond its cost, in rose wherever its row or entry is drawn. A card's
 * line (`ACTION_CARD_LINES`) says what it gives; this says what it costs the player besides.
 */
export const ACTION_CARD_CONSEQUENCES: Readonly<Record<string, string>> = {
    'denizen.nomad.special-envoy': 'ends your Act Phase',
    'denizen.hearth.awaited-return': 'sacrifice 1 warband',
    'relic.truthful-harp': 'reveal them'
}

/**
 * R-7.4 — each optional modifier's one line, what it gives, as its menu row and its Use a power
 * entry say it: a gain the action's row then counts ("+1 warband"), a price it waives
 * ("0 Supply"), or what it opens ("cards at beast sites"). A card the engine applies by itself
 * (R-7.4.1) has none: it is never offered.
 */
export const ACTION_CARD_LINES: Readonly<Record<string, string>> = {
    // Travel
    'relic.dragonskin-drum': '+1 warband',
    'denizen.nomad.tents': '0 Supply',
    'denizen.nomad.a-fast-steed': '0 Supply',
    'denizen.nomad.special-envoy': '0 Supply',
    'denizen.arcane.portal': '0 Supply · no site powers',
    'denizen.beast.forest-paths': '0 Supply · no site powers',
    'denizen.nomad.hospitality': '+1 favor',
    // Muster
    'denizen.hearth.rowdy-pub': '+1 warband',
    'denizen.beast.animal-playmates': '0 Supply',
    'denizen.discord.downtrodden': '+2 warbands',
    'denizen.order.pressgangs': 'cards with tokens',
    'denizen.order.knights-errant': 'then a free Campaign',
    // Trade
    'denizen.beast.birdsong': '0 Supply',
    'relic.cup-of-plenty': '0 Supply',
    'denizen.arcane.secret-signal': '+1 favor',
    'denizen.beast.the-old-oak': '+1 secret',
    'denizen.hearth.awaited-return': '0 Supply',
    'denizen.arcane.map-library': 'cards in your region',
    'denizen.beast.small-friends': 'cards at beast sites',
    'denizen.arcane.master-of-disguise': 'another player’s advisers',
    'denizen.arcane.acting-troupe': 'counts as a beast card or order card',
    // Search
    'denizen.beast.wild-cry': '+1 Supply +2 warbands',
    'denizen.hearth.welcoming-party': '+1 favor',
    'denizen.hearth.news-from-afar': '0 Supply',
    'denizen.beast.mushrooms': '0 Supply · draw 1 from the bottom',
    'denizen.beast.errand-boy': 'another region’s pile',
    'denizen.arcane.observatory': 'any discard pile',
    'denizen.arcane.augury': 'draw +1',
    'relic.truthful-harp': 'draw +2',
    'denizen.beast.bracken': 'discards to any pile',
    'relic.cracked-horn': 'discards under the world deck',
    'denizen.beast.new-growth': 'beast cards or hearth cards to any site',
    'denizen.hearth.land-warden': 'play 2 cards',
    'denizen.hearth.crop-rotation': 'discard one there first',
    'denizen.order.hunting-party': 'then a free Campaign',
    // Recover
    'denizen.arcane.magicians-code': '+2 secrets on the Darkest Secret'
}

/** The line a card's row says, empty for a card the table does not know. */
export function actionCardLine(cardId: string): string {
    return ACTION_CARD_LINES[cardId] ?? ''
}

/** One entry's key in the powers list: a pair is keyed by both its cards. */
export function actionCardKey(card: ActionCard): string {
    const key = powerKey(card.cardId, card.powerIndex)
    return card.with ? `${key}+${powerKey(card.with.cardId, card.with.powerIndex)}` : key
}

/** The cards an entry opens its action with: the card, and a pair's second card. */
export function actionCardUses(card: ActionCard): PowerUseKey[] {
    return [powerUseKey(card), ...(card.with ? [powerUseKey(card.with)] : [])]
}

/** R-7.4 — each way to declare the card alone: every choice its text opens, at every legal option. */
export function soleDeclarations(
    state: HydratedOathGameState,
    playerId: string,
    power: CardPower
): ModifierUse[] {
    const use = powerUseKey(power)
    const legal = offeredChoices(state, playerId, power)
    if (legal.length === 0) return [use]
    let picked: PowerChoicePicks[] = [emptyPicks()]
    legal.forEach((choice, index) => {
        // No modifier card asks a choice that takes several picks; one that did is left at none.
        if (allowsSeveral(choice)) return
        const options = choice.options.map((_, pick) => pick)
        const each = choice.spec.min > 0 ? options : [NO_OPTION, ...options]
        picked = picked.flatMap((picks) =>
            each.map((pick) =>
                pick === NO_OPTION ? picks : withOptionPick(picks, choice, index, pick)
            )
        )
    })
    return picked.map((picks) => ({ ...use, choices: powerChoicesFrom(legal, picks) }))
}

/** One row of an action's menu: what it offers, and the cards in use it is judged and sent with. */
export type MenuRow = { key: string; modifiers: readonly ModifierUse[] }

/** A row as offered, without the cards it is sent with, so two menus' rows compare by what they offer. */
function rowKey(row: object): string {
    return JSON.stringify(row, (field, value: unknown) =>
        field === 'modifiers' ? undefined : value
    )
}

/** R-7.4 — every row of an action's menu with these cards in use, each with the cards that fit it. */
export function actionMenu(
    state: HydratedOathGameState,
    playerId: string,
    action: CardAction,
    modifiers: readonly ModifierUse[]
): MenuRow[] {
    const rows = (each: readonly { modifiers: readonly ModifierUse[] }[]): MenuRow[] =>
        each.map((row) => ({ key: rowKey(row), modifiers: row.modifiers }))
    switch (action) {
        case ActionType.Search:
            return rows(searchRows(state, playerId, modifiers, []))
        case ActionType.Travel:
            // R-7.4 — Hospitality's gain comes after the move, so a destination offers the same
            // Travel with its bank as without; the card fits the row where a way carries it.
            return travelRows(state, playerId, modifiers).map((row) => ({
                key: rowKey(travelOffer(row)),
                modifiers:
                    row.ways.find((way) => way.hospitality !== undefined)?.modifiers ??
                    row.modifiers
            }))
        case ActionType.Muster:
            return rows(musterRows(state, playerId, modifiers))
        case ActionType.Trade:
            // Each option of a card is its own row: the cards in use are judged per option.
            return tradeRows(state, playerId, modifiers).flatMap((row) =>
                row.choices.map((choice) => ({
                    key: rowKey({ cardId: row.cardId, suit: row.suit, choice }),
                    modifiers: choice.modifiers
                }))
            )
        case ActionType.Recover: {
            const { relics, banners } = recoverRows(state, playerId, modifiers)
            return rows([...relics, ...banners])
        }
    }
}

export function actionMenuRows(
    state: HydratedOathGameState,
    playerId: string,
    action: CardAction,
    modifiers: readonly ModifierUse[]
): string[] {
    return actionMenu(state, playerId, action, modifiers).map((row) => row.key)
}

/** R-7.4 — whether a card in use applies to some row of the menu: else it is not listed. */
export function fitsARow(menu: readonly MenuRow[], use: PowerUseKey): boolean {
    return menu.some((row) => row.modifiers.some((m) => samePowerUse(m, use)))
}

function addsARow(rows: readonly string[], plain: readonly string[]): boolean {
    const known = new Set(plain)
    return rows.some((row) => !known.has(row))
}

/** Each pair of declarations, one of each card, as `soleDeclarations` gives them. */
function pairDeclarations(
    state: HydratedOathGameState,
    playerId: string,
    first: CardPower,
    second: CardPower
): ModifierUse[][] {
    const seconds = soleDeclarations(state, playerId, second)
    return soleDeclarations(state, playerId, first).flatMap((a) => seconds.map((b) => [a, b]))
}

function consequenceOf(powers: readonly CardPower[]): string | undefined {
    const said = powers.flatMap((p) => {
        const consequence = ACTION_CARD_CONSEQUENCES[p.cardId]
        return consequence ? [consequence] : []
    })
    return said.length > 0 ? said.join(' · ') : undefined
}

/**
 * R-7.4 — the modifier cards the seat can use and pay for that put a row in an action's menu the
 * menu lacks without them: a new choice, or one at another price, payment, gain or draw. A card
 * whose condition only narrows the menu, or that only adds something after the action, puts no
 * row there, so it is offered only in that action's menu. An action only two cards make possible
 * together, neither alone, is one entry for the pair.
 */
export function actionCards(state: HydratedOathGameState, playerId: string): ActionCard[] {
    if (state.machineState !== MachineState.ActPhase) return []
    // R-10.2 — while a free action is due, only it, giving it up or ending the phase is offered.
    if (freeActionTypesNow(state, playerId).length > 0) return []
    return CARD_ACTIONS.flatMap((action): ActionCard[] => {
        const plain = actionMenuRows(state, playerId, action, [])
        const usable = usableModifiers(state, playerId, action)
        const kindOf = (declarations: readonly ModifierUse[][]): ActionCardKind | undefined => {
            const menus = declarations
                .map((uses) => actionMenuRows(state, playerId, action, uses))
                .filter((rows) => rows.length > 0)
            if (plain.length === 0) return menus.length > 0 ? 'makesPossible' : undefined
            return menus.some((rows) => addsARow(rows, plain)) ? 'changes' : undefined
        }
        const singles = usable.map((power) => ({
            power,
            kind: kindOf(soleDeclarations(state, playerId, power).map((use) => [use]))
        }))
        const cards = singles.flatMap(({ power, kind }): ActionCard[] => {
            if (!kind) return []
            const consequence = consequenceOf([power])
            return [
                { ...powerUseKey(power), action, kind, ...(consequence ? { consequence } : {}) }
            ]
        })
        if (plain.length > 0) return cards
        // R-7.4 — an action no card makes possible alone may be made possible by two together.
        const alone = singles.filter(({ kind }) => kind === undefined).map(({ power }) => power)
        const pairs = alone.flatMap((first, i): ActionCard[] =>
            alone.slice(i + 1).flatMap((second): ActionCard[] => {
                if (!kindOf(pairDeclarations(state, playerId, first, second))) return []
                const consequence = consequenceOf([first, second])
                return [
                    {
                        ...powerUseKey(first),
                        action,
                        kind: 'makesPossible',
                        with: powerUseKey(second),
                        ...(consequence ? { consequence } : {})
                    }
                ]
            })
        )
        return [...cards, ...pairs]
    })
}

/** R-7.4 — the cards that would make an action possible that cannot be taken as printed. */
export function cardsMakingPossible(
    cards: readonly ActionCard[],
    action: ActionType
): ActionCard[] {
    return cards.filter((card) => card.action === action && card.kind === 'makesPossible')
}

/** R-7.1.2 — what using the card costs, as its row says it before the press. */
export function cardCostLine(cost: PowerCost): string {
    const counted = (count: number, noun: string) =>
        `${count} ${noun}${noun === 'secret' && count > 1 ? 's' : ''}`
    const placed = [
        ...(cost.placeFavor > 0 ? [counted(cost.placeFavor, 'favor')] : []),
        ...(cost.placeSecret > 0 ? [counted(cost.placeSecret, 'secret')] : [])
    ]
    const burned = [
        ...(cost.burnFavor > 0 ? [counted(cost.burnFavor, 'favor')] : []),
        ...(cost.burnSecret > 0 ? [counted(cost.burnSecret, 'secret')] : [])
    ]
    const clauses = [
        ...(placed.length > 0 ? [`put ${placed.join(' and ')} on it`] : []),
        ...(burned.length > 0 ? [`burn ${burned.join(' and ')}`] : [])
    ]
    return clauses.length > 0 ? clauses.join(', ') : 'free'
}

/** A power's cost as the answer that pays it shows it: "1 favor + 1 secret"; nothing when free. */
export function answerCostText(cost: PowerCost): string | undefined {
    const favor = cost.placeFavor + cost.burnFavor
    const secrets = cost.placeSecret + cost.burnSecret
    const parts = [
        ...(favor > 0 ? [`${favor} favor`] : []),
        ...(secrets > 0 ? [`${secrets} ${secrets === 1 ? 'secret' : 'secrets'}`] : [])
    ]
    return parts.length > 0 ? parts.join(' + ') : undefined
}
