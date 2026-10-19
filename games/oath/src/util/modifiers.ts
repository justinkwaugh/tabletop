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
    hasAccessAt,
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
import type { WarbandOwner } from '../model/warbandCounts.js'

// R-7.4.1, R-7.4.2, R-X.1 — one use per action; a costed modifier pays at declaration.

/**
 * R-7.1.1-H2, Small Friends — "act as if your pawn is at any site with a beast card". Before
 * revision 19 (R-X.4) holding the card reaches every such site, declared or not; from it, only
 * the one site a declared Small Friends names (its Q&A: "Only the new site").
 */
export function reachableSitesFor(
    state: HydratedOathGameState,
    playerId: string,
    action: ActionType,
    uses?: readonly ModifierUse[]
): string[] {
    if (action !== ActionType.Trade) return []
    if (isAtLeastOathRevision(state, OathRevision.EngineFixes15)) {
        const at = actsAsAtSite(state, playerId, action, uses)
        return at === undefined ? [] : [at]
    }
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

/**
 * Small Friends, from revision 19 (R-X.4) — the site a declared use names, where the Trade acts
 * as if the pawn is. Its card must be one the player may use with these declarations: their own,
 * or one lent by Master of Disguise. The site itself is judged where the use is resolved.
 */
export function actsAsAtSite(
    state: HydratedOathGameState,
    playerId: string,
    action: ActionType,
    uses: readonly ModifierUse[] | undefined
): string | undefined {
    if (action !== ActionType.Trade) return undefined
    if (!isAtLeastOathRevision(state, OathRevision.EngineFixes15)) return undefined
    const disguise = disguisedAs(action, uses)
    for (const use of uses ?? []) {
        const power = cardPowers(use.cardId)[use.powerIndex]
        if (power?.timing !== PowerTiming.Modifier || power.modifiesAction !== action) continue
        const hook = effectFor(power)?.modifier?.actsAsAtSites
        if (!hook || !mayDeclare(state, playerId, use.cardId, disguise)) continue
        const [siteId] = hook({ state, playerId, power, choices: use.choices ?? [] })
        if (siteId !== undefined) return siteId
    }
    return undefined
}

/**
 * R-7.1.1 — whether a declaration may name the card. Master of Disguise: the other player's
 * faceup advisers stand in for the player's own other advisers.
 */
function mayDeclare(
    state: HydratedOathGameState,
    playerId: string,
    cardId: string,
    disguise: string | undefined
): boolean {
    if (disguise === undefined) return hasAccessToCard(state, playerId, cardId)
    if (state.getPlayerState(disguise).faceupAdviserIds().includes(cardId)) return true
    return !isOwnOtherAdviser(state, playerId, cardId) && hasAccessToCard(state, playerId, cardId)
}

/** Master of Disguise — "(You can't use your other advisers.)": every faceup adviser but itself. */
function isOwnOtherAdviser(state: HydratedOathGameState, playerId: string, cardId: string) {
    return cardId !== MASTER_OF_DISGUISE && state.getPlayerState(playerId).isFaceupAdviser(cardId)
}

/**
 * R-7.1.1 — with Small Friends acting at a site (revision 19), that site's cards stand in for the
 * pawn's own; what the player holds or rules stays in reach. Master of Disguise — "act as if you
 * had another player's advisers instead": the named player's faceup advisers stand in for the
 * player's own other advisers (its Q&A: "you fully replace your advisers"), so the listing is
 * what `resolveModifiers` accepts.
 */
function modifierCandidates(
    state: HydratedOathGameState,
    playerId: string,
    action: ActionType,
    uses?: readonly ModifierUse[]
): string[] {
    const candidates = new Set<string>(poweredCardIds(state, playerId))
    for (const siteId of reachableSitesFor(state, playerId, action, uses)) {
        for (const id of state.denizensAt(siteId)) candidates.add(id)
    }
    const at = actsAsAtSite(state, playerId, action, uses)
    const disguise = disguisedAs(action, uses)
    const lent = disguise === undefined ? [] : state.getPlayerState(disguise).faceupAdviserIds()
    const own = [...candidates].filter(
        (cardId) =>
            (at === undefined || hasAccessAt(state, playerId, cardId, at)) &&
            (disguise === undefined || !isOwnOtherAdviser(state, playerId, cardId))
    )
    return [...new Set([...own, ...lent])]
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

/** R-7.4.1 — a modifier the engine applies by itself: it is never declared. */
export function isMandatoryModifier(power: CardPower): boolean {
    return effectFor(power)?.mandatory === true
}

/**
 * A free gain (Dragonskin Drum, Rowdy Pub, Wild Cry …): an optional modifier that costs nothing,
 * asks nothing and only gains, so a menu may start it in use. Read by no rule: a modifier applies
 * only when it is declared (R-7.4.1).
 */
export function isFreeGain(power: CardPower): boolean {
    return effectFor(power)?.freeGain === true
}

/**
 * A printed condition depends on the action's particulars, so it is checked at declaration.
 * `uses`: the cards already declared, where they change what is in reach (Small Friends' site).
 */
export function usableModifiers(
    state: HydratedOathGameState,
    playerId: string,
    action: ActionType,
    uses?: readonly ModifierUse[]
): CardPower[] {
    const found: CardPower[] = []
    for (const cardId of modifierCandidates(state, playerId, action, uses)) {
        for (const power of powersWithTiming(cardId, PowerTiming.Modifier)) {
            if (power.modifiesAction !== action) continue
            const effect = effectFor(power)
            if (!effect?.modifier || effect.mandatory) continue
            if (effect.modifier.reasonUnusable?.({ state, playerId, power, choices: [] })) continue
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

/**
 * R-11.7-H2 — `destinationUnknown`: the Travel out of an enemy's Shrouded Wood declares its cards
 * before the ruler names the site, so a card's condition is judged per pick (`modifierApplies`),
 * and the mandatory ones fold there too: only what does not depend on the destination is checked.
 * A card whose bank is chosen on arrival (Hospitality) is declared with no bank, so its choice is
 * not checked here either.
 */
export interface ResolveMode {
    destinationUnknown?: boolean
}

export function resolveModifiers(
    state: HydratedOathGameState,
    playerId: string,
    action: ActionType,
    uses: readonly ModifierUse[] | undefined,
    particulars: Partial<EffectContext['particulars']> = {},
    mode: ResolveMode = {}
): { reason?: string; active: ActiveModifier[] } {
    const active: ActiveModifier[] = []
    const seen = new Set<string>()
    // Master of Disguise — "(You can't use your other advisers.)"; theirs are used as yours.
    const disguise = disguisedAs(action, uses)
    const disguisedAdvisers =
        disguise === undefined ? [] : state.getPlayerState(disguise).faceupAdviserIds()
    const actingAt = actsAsAtSite(state, playerId, action, uses)
    for (const use of uses ?? []) {
        const key = powerKey(use.cardId, use.powerIndex)
        if (seen.has(key)) {
            return {
                reason: `${use.cardId} power ${use.powerIndex} was declared twice (R-7.4.2: once per action)`,
                active
            }
        }
        seen.add(key)
        if (disguise !== undefined && isOwnOtherAdviser(state, playerId, use.cardId)) {
            return { reason: `Master of Disguise: you can't use your other advisers`, active }
        }
        // Small Friends from revision 19: its site stands in for the pawn's (Q&A: "Only the new site").
        const inReach =
            actingAt === undefined
                ? hasAccessToCard(state, playerId, use.cardId) ||
                  reachableSitesFor(state, playerId, action).includes(
                      siteHolding(state, use.cardId) ?? ''
                  )
                : hasAccessAt(state, playerId, use.cardId, actingAt)
        if (!disguisedAdvisers.includes(use.cardId) && !inReach) {
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
        const unusable = effect.modifier.reasonUnusable?.({
            state,
            playerId,
            power,
            choices: use.choices ?? []
        })
        if (unusable) return { reason: `${use.cardId}: ${unusable}`, active }
        const unpayable = reasonCannotPayPowerCost(state, playerId, power)
        if (unpayable) return { reason: unpayable, active }
        const bankOnArrival =
            mode.destinationUnknown === true &&
            effect.modifier.bankChosenOnArrival === true &&
            (use.choices ?? []).length === 0
        const badChoice = bankOnArrival
            ? undefined
            : reasonChoicesInvalid(state, playerId, power, use.choices)
        if (badChoice) return { reason: badChoice, active }
        const declared: ActiveModifier = {
            power,
            hooks: effect.modifier,
            choices: use.choices ?? [],
            mandatory: false
        }
        if (!mode.destinationUnknown) {
            const unmet = reasonModifierDoesNotApply(state, playerId, declared, particulars)
            if (unmet) return { reason: unmet, active }
        }
        active.push(declared)
    }
    if (mode.destinationUnknown) return { active }
    for (const m of mandatoryModifiers(state, playerId, action)) {
        const ctx: EffectContext = { ...modifierContext(state, playerId, m), particulars }
        // R-9.2.a — a mandatory modifier whose "if able" does not hold is skipped.
        if (m.hooks.condition?.(ctx)) continue
        active.push(m)
    }
    return { active }
}

/** A declared modifier's printed condition, and its cross-check, for the action's particulars. */
export function reasonModifierDoesNotApply(
    state: HydratedOathGameState,
    playerId: string,
    m: ActiveModifier,
    particulars: Partial<EffectContext['particulars']>
): string | undefined {
    const ctx: EffectContext = { ...modifierContext(state, playerId, m), particulars }
    const unmet = m.hooks.condition?.(ctx)
    if (unmet) return `${m.power.cardId}: ${unmet}`
    return effectFor(m.power)?.reasonCannotResolve?.(ctx)
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
        | 'tradeSideFavor'
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
): { notes: string[]; endsActPhase: boolean; warbandOwners: WarbandOwner[] } {
    const notes: string[] = []
    const warbandOwners: WarbandOwner[] = []
    let endsActPhase = false
    for (const m of active) {
        const r = m.hooks.after?.({ ...modifierContext(state, playerId, m), particulars })
        if (!r) continue
        if (r.summary) notes.push(r.summary)
        if (r.endsActPhase) endsActPhase = true
        if (r.warbandOwner !== undefined) warbandOwners.push(r.warbandOwner)
    }
    return { notes, endsActPhase, warbandOwners }
}

export function modifierSummary(active: readonly ActiveModifier[]): string[] {
    return active.map((m) => `${m.power.cardId}${m.mandatory ? ' (must)' : ''}`)
}
