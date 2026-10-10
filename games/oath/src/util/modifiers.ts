import * as Type from 'typebox'
import { assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import {
    cardPowers,
    PowerTiming,
    powersWithTiming,
    type CardPower,
    powerKey
} from '../data/cardPowers.js'
import {
    hasAccessToCard,
    isFacedownAdviserOf,
    poweredCardIds,
    siteHolding,
    cardsWithinReach
} from './access.js'
import { payPowerCost, reasonCannotPayPowerCost } from './powerCost.js'
import { PowerChoice, PowerChoiceKind, reasonChoicesInvalid } from './powerChoice.js'
import { PowerUse } from '../model/powerUse.js'
import { effectFor, type EffectContext, type ModifierHooks } from '../powers/registry.js'
import { traitModifiers } from './reliquaryTraits.js'
import { isAtLeastOathRevision, OathRevision } from './revision.js'
import type { DiscardTarget } from './discard.js'

// R-7.4.1, R-7.4.2, R-X.1 — one use per action; a costed modifier pays at declaration.

/** Small Friends — "act as if your pawn is at any site with a beast card". */
export function reachableSitesFor(
    state: HydratedOathGameState,
    playerId: string,
    action: ActionType
): string[] {
    if (action !== ActionType.Trade) return []
    const sites = new Set<string>()
    for (const cardId of cardsWithinReach(state, playerId)) {
        if (!hasAccessToCard(state, playerId, cardId)) continue
        for (const power of powersWithTiming(cardId, PowerTiming.Modifier)) {
            const hook = effectFor(power)?.modifier?.actsAsAtSites
            if (!hook) continue
            for (const siteId of hook({ state, playerId, power, choices: [] })) sites.add(siteId)
        }
    }
    return [...sites]
}

/** R-7.1.1 */
function modifierCandidates(
    state: HydratedOathGameState,
    playerId: string,
    action: ActionType
): string[] {
    const candidates = new Set<string>(poweredCardIds(state, playerId))
    for (const siteId of reachableSitesFor(state, playerId, action)) {
        for (const id of state.denizensAt(siteId)) candidates.add(id)
    }
    return [...candidates]
}

/** R-7.4 */
export type ModifierUse = PowerUse
export const ModifierUse = PowerUse

export const ModifierUses = Type.Optional(Type.Array(ModifierUse, { maxItems: 8 }))

export interface ActiveModifier {
    power: CardPower
    hooks: ModifierHooks
    choices: readonly PowerChoice[]
    mandatory: boolean
}

export interface ActionPlan {
    reason?: string
    cost: number
    active: ActiveModifier[]
}

export function modifierContext(
    state: HydratedOathGameState,
    playerId: string,
    m: ActiveModifier
): EffectContext {
    return { state, playerId, power: m.power, choices: m.choices }
}

/** R-7.4.1's "must" — folded in whether or not declared. */
export function mandatoryModifiers(
    state: HydratedOathGameState,
    playerId: string,
    action: ActionType
): ActiveModifier[] {
    const found: ActiveModifier[] = []
    for (const cardId of modifierCandidates(state, playerId, action)) {
        for (const power of powersWithTiming(cardId, PowerTiming.Modifier)) {
            if (power.modifiesAction !== action) continue
            const effect = effectFor(power)
            if (!effect?.modifier || !effect.mandatory) continue
            found.push({ power, hooks: effect.modifier, choices: [], mandatory: true })
        }
    }
    // R-6.6.2.a — uncovered Reliquary traits are mandatory modifiers with no card behind them.
    found.push(...traitModifiers(state, playerId, action))
    return found
}

/** A printed condition depends on the action's particulars, so it is checked at declaration. */
export function usableModifiers(
    state: HydratedOathGameState,
    playerId: string,
    action: ActionType
): CardPower[] {
    const found: CardPower[] = []
    for (const cardId of modifierCandidates(state, playerId, action)) {
        for (const power of powersWithTiming(cardId, PowerTiming.Modifier)) {
            if (power.modifiesAction !== action) continue
            const effect = effectFor(power)
            if (!effect?.modifier || effect.mandatory) continue
            if (reasonCannotPayPowerCost(state, playerId, power)) continue
            found.push(power)
        }
    }
    return found
}

const MASTER_OF_DISGUISE = 'denizen.arcane.master-of-disguise'

/** Master of Disguise — "act as if you had another player's advisers instead": whose, when declared on a Trade. */
export function disguisedAs(
    action: ActionType,
    uses: readonly ModifierUse[] | undefined
): string | undefined {
    if (action !== ActionType.Trade) return undefined
    const use = uses?.find((u) => u.cardId === MASTER_OF_DISGUISE)
    const choice = use?.choices?.find((c) => c.kind === PowerChoiceKind.Player)
    return choice?.kind === PowerChoiceKind.Player ? choice.playerId : undefined
}

export function resolveModifiers(
    state: HydratedOathGameState,
    playerId: string,
    action: ActionType,
    uses: readonly ModifierUse[] | undefined,
    particulars: Partial<EffectContext['particulars']> = {}
): { reason?: string; active: ActiveModifier[] } {
    const active: ActiveModifier[] = []
    const seen = new Set<string>()
    // Master of Disguise — "(You can't use your other advisers.)"; theirs are used as yours.
    const disguise = disguisedAs(action, uses)
    const disguisedAdvisers =
        disguise === undefined ? [] : state.getPlayerState(disguise).faceupAdviserIds()
    for (const use of uses ?? []) {
        const key = powerKey(use.cardId, use.powerIndex)
        if (seen.has(key)) {
            return {
                reason: `${use.cardId} power ${use.powerIndex} was declared twice (R-7.4.2: once per action)`,
                active
            }
        }
        seen.add(key)
        if (
            disguise !== undefined &&
            use.cardId !== MASTER_OF_DISGUISE &&
            state.getPlayerState(playerId).isFaceupAdviser(use.cardId)
        ) {
            return { reason: `Master of Disguise: you can't use your other advisers`, active }
        }
        if (
            !disguisedAdvisers.includes(use.cardId) &&
            !hasAccessToCard(state, playerId, use.cardId) &&
            !reachableSitesFor(state, playerId, action).includes(
                siteHolding(state, use.cardId) ?? ''
            )
        ) {
            return { reason: `you neither rule ${use.cardId} nor is your pawn at its site`, active }
        }
        if (isFacedownAdviserOf(state, playerId, use.cardId)) {
            return {
                reason: `${use.cardId} is one of your facedown advisers, which have no power (R-5.1.4.II)`,
                active
            }
        }
        const power = cardPowers(use.cardId)[use.powerIndex]
        if (!power)
            return { reason: `${use.cardId} has no power at index ${use.powerIndex}`, active }
        if (power.timing !== PowerTiming.Modifier) {
            return {
                reason: `${use.cardId}'s power ${use.powerIndex} is ${power.timing}, not a modifier`,
                active
            }
        }
        if (power.modifiesAction !== action) {
            return {
                reason: `${use.cardId} modifies ${power.modifiesAction ?? 'no action'}, not ${action} (R-7.4)`,
                active
            }
        }
        const effect = effectFor(power)
        assertExists(
            effect?.modifier,
            `${use.cardId} power ${use.powerIndex} registers no modifier`
        )
        if (effect.mandatory) {
            return {
                reason: `${use.cardId} is mandatory and applies unasked; do not declare it (R-7.4.1)`,
                active
            }
        }
        const unpayable = reasonCannotPayPowerCost(state, playerId, power)
        if (unpayable) return { reason: unpayable, active }
        const badChoice = reasonChoicesInvalid(state, playerId, power, use.choices)
        if (badChoice) return { reason: badChoice, active }
        const ctx: EffectContext = {
            state,
            playerId,
            power,
            choices: use.choices ?? [],
            particulars
        }
        const unmet = effect.modifier.condition?.(ctx)
        if (unmet) return { reason: `${use.cardId}: ${unmet}`, active }
        const cross = effect.reasonCannotResolve?.(ctx)
        if (cross) return { reason: cross, active }
        active.push({ power, hooks: effect.modifier, choices: use.choices ?? [], mandatory: false })
    }
    for (const m of mandatoryModifiers(state, playerId, action)) {
        const ctx: EffectContext = { ...modifierContext(state, playerId, m), particulars }
        // R-9.2.a — a mandatory modifier whose "if able" does not hold is skipped.
        if (m.hooks.condition?.(ctx)) continue
        active.push(m)
    }
    return { active }
}

/** R-7.4 — already validated and paid by the Search. */
export function carriedModifiers(
    state: HydratedOathGameState,
    carried: readonly ModifierUse[] | undefined
): ActiveModifier[] {
    const active: ActiveModifier[] = []
    for (const use of carried ?? []) {
        const power = cardPowers(use.cardId)[use.powerIndex]
        assertExists(power, `${use.cardId} prints no power ${use.powerIndex}`)
        const hooks = effectFor(power)?.modifier
        assertExists(hooks, `${use.cardId} power ${use.powerIndex} is not a modifier`)
        active.push({ power, hooks, choices: use.choices ?? [], mandatory: false })
    }
    return active
}

/** R-7.4, R-5.1.4 — the modifiers a Search carries to its play. */
export function searchPlayModifiers(state: HydratedOathGameState): ActiveModifier[] {
    return carriedModifiers(state, state.pendingSearchModifiers)
}

/** Bracken, Cracked Horn */
export function discardTargetOf(
    state: HydratedOathGameState,
    playerId: string,
    active: readonly ActiveModifier[]
): DiscardTarget | undefined {
    return active
        .map((m) => m.hooks.discardTo?.(modifierContext(state, playerId, m)))
        .find((t) => t !== undefined)
}

/** R-7.1.2 */
export function payModifierCosts(
    state: HydratedOathGameState,
    playerId: string,
    active: readonly ActiveModifier[]
): void {
    for (const m of active) {
        if (!m.mandatory) payPowerCost(state, playerId, m.power)
    }
}

/** R-7.6.2 — "spend no Supply" ignores the cost and any increase to it, whatever the order declared. */
export function foldSupplyCost(
    base: number,
    state: HydratedOathGameState,
    playerId: string,
    active: readonly ActiveModifier[],
    particulars: Partial<EffectContext['particulars']> = {},
    siteSpendsNoSupply = false
): number {
    const spendsNone = (m: ActiveModifier) =>
        m.hooks.spendsNoSupply?.({ ...modifierContext(state, playerId, m), particulars }) === true
    if (!isAtLeastOathRevision(state, OathRevision.CardFixes1)) {
        return foldInDeclarationOrder(
            'supplyCost',
            siteSpendsNoSupply ? 0 : base,
            state,
            playerId,
            active,
            particulars,
            (m) => (spendsNone(m) ? 0 : undefined)
        )
    }
    if (siteSpendsNoSupply || active.some(spendsNone)) return 0
    return foldNumber('supplyCost', base, state, playerId, active, particulars)
}

/** Mushrooms with Augury — a count one modifier sets is the base the others add to. */
export function foldDrawCount(
    base: number,
    state: HydratedOathGameState,
    playerId: string,
    active: readonly ActiveModifier[],
    particulars: Partial<EffectContext['particulars']> = {}
): number {
    const setBy = (m: ActiveModifier) => m.hooks.setsDrawCount
    if (!isAtLeastOathRevision(state, OathRevision.CardFixes1)) {
        return foldInDeclarationOrder(
            'drawCount',
            base,
            state,
            playerId,
            active,
            particulars,
            setBy
        )
    }
    const set = active.map(setBy).find((count) => count !== undefined)
    return foldNumber('drawCount', set ?? base, state, playerId, active, particulars)
}

/** R-X.4 — before revision 4 a value one modifier set stood at its place in the declaration order. */
function foldInDeclarationOrder(
    seam: 'supplyCost' | 'drawCount',
    base: number,
    state: HydratedOathGameState,
    playerId: string,
    active: readonly ActiveModifier[],
    particulars: Partial<EffectContext['particulars']>,
    setBy: (m: ActiveModifier) => number | undefined
): number {
    let value = base
    for (const m of active) {
        value = setBy(m) ?? value
        const hook = m.hooks[seam]
        if (hook) value = hook(value, { ...modifierContext(state, playerId, m), particulars })
    }
    return Math.max(0, value)
}

export function foldNumber(
    seam:
        | 'supplyCost'
        | 'musterWarbands'
        | 'tradeFavor'
        | 'tradeSecrets'
        | 'drawCount'
        | 'recoverSecrets',
    base: number,
    state: HydratedOathGameState,
    playerId: string,
    active: readonly ActiveModifier[],
    particulars: Partial<EffectContext['particulars']> = {}
): number {
    let value = base
    for (const m of active) {
        const hook = m.hooks[seam]
        if (hook) value = hook(value, { ...modifierContext(state, playerId, m), particulars })
    }
    return Math.max(0, value)
}

/** R-7.1.2.a's occupancy bar, relaxed by Pressgangs. */
export function anyRelaxesOccupancy(
    state: HydratedOathGameState,
    playerId: string,
    active: readonly ActiveModifier[]
): boolean {
    return active.some(
        (m) => m.hooks.relaxOccupancy?.(modifierContext(state, playerId, m)) === true
    )
}

export function runBefore(
    state: HydratedOathGameState,
    playerId: string,
    active: readonly ActiveModifier[],
    particulars: Partial<EffectContext['particulars']> = {}
): string[] {
    const notes: string[] = []
    for (const m of active) {
        const note = m.hooks.before?.({ ...modifierContext(state, playerId, m), particulars })
        if (note) notes.push(note)
    }
    return notes
}

/** Asked with the folded cost in `particulars`, so a limit is checked against the real spend. */
export function firstForbid(
    state: HydratedOathGameState,
    playerId: string,
    active: readonly ActiveModifier[],
    particulars: Partial<EffectContext['particulars']> = {}
): string | undefined {
    for (const m of active) {
        const reason = m.hooks.forbids?.({ ...modifierContext(state, playerId, m), particulars })
        if (reason) return reason
    }
    return undefined
}

export function runAfter(
    state: HydratedOathGameState,
    playerId: string,
    active: readonly ActiveModifier[],
    particulars: Partial<EffectContext['particulars']> = {}
): { notes: string[]; endsActPhase: boolean } {
    const notes: string[] = []
    let endsActPhase = false
    for (const m of active) {
        const r = m.hooks.after?.({ ...modifierContext(state, playerId, m), particulars })
        if (!r) continue
        if (r.summary) notes.push(r.summary)
        if (r.endsActPhase) endsActPhase = true
    }
    return { notes, endsActPhase }
}

export function modifierSummary(active: readonly ActiveModifier[]): string[] {
    return active.map((m) => `${m.power.cardId}${m.mandatory ? ' (must)' : ''}`)
}
