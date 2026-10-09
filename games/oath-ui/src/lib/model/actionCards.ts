import {
    ActionType,
    MachineState,
    legalChoices,
    freeActionTypesNow,
    usableModifiers,
    type CardPower,
    type HydratedOathGameState,
    type ModifierUse,
    type PowerCost
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
import { powerUseKey } from './powerUse.js'
import { recoverRows } from './recoverRows.js'
import { searchRows } from './searchRows.js'
import { tradeRows } from './tradeRows.js'
import { travelRows } from './travelRows.js'

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
}

export const ACTION_CARD_CONSEQUENCES: Readonly<Record<string, string>> = {
    'denizen.nomad.special-envoy': 'ends your Act Phase',
    'denizen.hearth.awaited-return': 'sacrifices 1 warband from your board'
}

/** R-7.4 — each way to declare the card alone: every choice its text opens, at every legal option. */
export function soleDeclarations(
    state: HydratedOathGameState,
    playerId: string,
    power: CardPower
): ModifierUse[] {
    const use = powerUseKey(power)
    const legal = legalChoices(state, playerId, power)
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

export function actionMenuRows(
    state: HydratedOathGameState,
    playerId: string,
    action: CardAction,
    modifiers: ModifierUse[]
): string[] {
    const keys = (rows: readonly unknown[]) => rows.map((row) => JSON.stringify(row))
    switch (action) {
        case ActionType.Search:
            return keys(searchRows(state, playerId, modifiers, []))
        case ActionType.Travel:
            return keys(travelRows(state, playerId, modifiers))
        case ActionType.Muster:
            return keys(musterRows(state, playerId, modifiers))
        case ActionType.Trade:
            return keys(tradeRows(state, playerId, modifiers))
        case ActionType.Recover: {
            const { relics, banners } = recoverRows(state, playerId, modifiers)
            return keys([...relics, ...banners])
        }
    }
}

function addsARow(rows: readonly string[], plain: readonly string[]): boolean {
    const known = new Set(plain)
    return rows.some((row) => !known.has(row))
}

/**
 * R-7.4 — the modifier cards the seat can use and pay for that put a row in an action's menu the
 * menu lacks without them: a new choice, or one at another price, payment, gain or draw. A card
 * whose condition only narrows the menu, or that only adds something after the action, puts no
 * row there, so it is offered only in that action's menu.
 */
export function actionCards(state: HydratedOathGameState, playerId: string): ActionCard[] {
    if (state.machineState !== MachineState.ActPhase) return []
    // R-10.2 — while a free action is due, only it, giving it up or ending the phase is offered.
    if (freeActionTypesNow(state, playerId).length > 0) return []
    return CARD_ACTIONS.flatMap((action): ActionCard[] => {
        const plain = actionMenuRows(state, playerId, action, [])
        return usableModifiers(state, playerId, action).flatMap((power): ActionCard[] => {
            const menus = soleDeclarations(state, playerId, power)
                .map((use) => actionMenuRows(state, playerId, action, [use]))
                .filter((rows) => rows.length > 0)
            const kind: ActionCardKind | undefined =
                plain.length === 0
                    ? menus.length > 0
                        ? 'makesPossible'
                        : undefined
                    : menus.some((rows) => addsARow(rows, plain))
                      ? 'changes'
                      : undefined
            if (!kind) return []
            const consequence = ACTION_CARD_CONSEQUENCES[power.cardId]
            return [{ ...powerUseKey(power), action, kind, ...(consequence ? { consequence } : {}) }]
        })
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

/** A card's printed power in words the panel's tokens can be drawn from. */
export function printedPowerWords(text: string): string {
    return text
        .replace(/(?:\[(?:favor|secret)\])+/g, (run) => {
            const count = run.split('][').length
            const noun = run.includes('favor') ? 'favor' : 'secret'
            return count === 1 ? noun : `${count} ${noun}${noun === 'secret' ? 's' : ''}`
        })
        .replace(/\[suit:([a-z]+)\]/g, '$1')
        .replace(/\*\*/g, '')
        .replace(/_/g, '')
}
