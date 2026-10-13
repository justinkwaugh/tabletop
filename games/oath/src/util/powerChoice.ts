import { pawnSiteId } from './pawn.js'
import { assertExists } from '@tabletop/common'
import { HydratedOathGameState, type RelicSlot } from '../model/gameState.js'
import type { HydratedOathPlayerState } from '../model/playerState.js'
import { Region, Suit } from '../model/oathEnums.js'
import type { ExchangeAllowance } from '../model/question.js'
import { PowerChoice, PowerChoiceKind } from '../model/powerChoice.js'
import type { CardPower, PowerUseKey } from '../data/cardPowers.js'
import { accessibleCardIds } from './access.js'
import { boardWarbandGroups } from './force.js'
import { describeWarbands } from './warbands.js'
import { choiceSpecsFor, effectFor } from '../powers/registry.js'
import { isAtLeastOathRevision, type OathRevision } from './revision.js'

export { PowerChoice, PowerChoiceKind }

/** A `warbands` option carries the group's maximum; the player picks how many. */
export type ChoiceDomain = (
    state: HydratedOathGameState,
    playerId: string,
    power: CardPower
) => PowerChoice[]

/** R-7.1.3 — `min: 0` is the "may". */
export interface ChoiceSpec {
    kind: PowerChoiceKind
    min: number
    max: number
    domain?: ChoiceDomain
    /** Its domain is read on the state the earlier choices leave: `EffectDefinition.stateAfter`. */
    sequential?: true
    what?: string
    allows?: ExchangeAllowance
    /** R-X.4 — asked only in a game created at this revision or later. */
    fromRevision?: OathRevision
    /** R-X.4 — asked only in a game created before this revision. */
    beforeRevision?: OathRevision
    /**
     * Warbands: the specs of this kind and domain name this many warbands together, or every one
     * the domain holds when it holds fewer (Terror Spells' "two"). The effect's own check reads it.
     */
    together?: number
    /** Warbands: the count goes in multiples of it (Blood Pact's "an even number"). */
    step?: number
    /**
     * Yes: the card's "or". No Yes is its first branch and a Yes its second, so neither is the
     * default (R-7.1.3). Read only by `offeredChoices`' callers.
     */
    or?: true
    /**
     * Whether the spec's options are offered now: a "may" (and what only its yes asks for) as the
     * card's own condition judges it, or a branch only while it would do anything ("not last").
     * Read only by `offeredChoices`: a choice sent is judged by the domain and the effect, as
     * without it.
     */
    offered?: (state: HydratedOathGameState, playerId: string) => boolean
    /**
     * FavorBank: each spec of the run names one favor; the run names `total` favor from
     * `sources`, as the effect's own check (R-7.1.3) reads it. Read only by `offeredChoices`.
     */
    favorTotal?: (state: HydratedOathGameState, playerId: string) => FavorTotal
}

/** R-7.1.3 — the banks a run of favor picks may name, and the favor they come to. */
export type FavorTotal = { sources: Suit[]; total: number }

export function exchangeAllowanceOf(spec: ChoiceSpec): ExchangeAllowance {
    assertExists(spec.allows, `a ${spec.kind} choice declares no exchange allowance`)
    return spec.allows
}

export function one(kind: PowerChoiceKind, extra: Partial<ChoiceSpec> = {}): ChoiceSpec {
    return { kind, min: 1, max: 1, ...extra }
}

export function optional(kind: PowerChoiceKind, extra: Partial<ChoiceSpec> = {}): ChoiceSpec {
    return { kind, min: 0, max: 1, ...extra }
}

export function defaultDomain(kind: PowerChoiceKind): ChoiceDomain {
    switch (kind) {
        case PowerChoiceKind.Yes:
            return () => [{ kind: PowerChoiceKind.Yes }]
        case PowerChoiceKind.FavorBank:
            return () =>
                Object.values(Suit).map((suit) => ({ kind: PowerChoiceKind.FavorBank, suit }))
        case PowerChoiceKind.Player:
            return (state, playerId) =>
                state.players
                    .filter((p) => p.playerId !== playerId)
                    .map((p) => ({ kind: PowerChoiceKind.Player, playerId: p.playerId }))
        case PowerChoiceKind.Card:
            // R-9.4 — a Card choice is public, so it never names the actor's facedown adviser.
            return (state, playerId) => {
                const facedown = state.getPlayerState(playerId).facedownAdviserIds()
                return accessibleCardIds(state, playerId)
                    .filter((cardId) => !facedown.includes(cardId))
                    .map((cardId) => ({ kind: PowerChoiceKind.Card, cardId }))
            }
        case PowerChoiceKind.Site:
            // R-10.21's faceup qualifier: a facedown slot is no site to name.
            return (state) =>
                state.faceupSiteIds().map((siteId) => ({ kind: PowerChoiceKind.Site, siteId }))
        case PowerChoiceKind.Region:
            return () =>
                Object.values(Region).map((region) => ({ kind: PowerChoiceKind.Region, region }))
        case PowerChoiceKind.Count:
            return () => [{ kind: PowerChoiceKind.Count, n: 0 }]
        case PowerChoiceKind.Bargain:
            return (state, playerId) =>
                state.players
                    .filter((p) => p.playerId !== playerId)
                    .map((p) => ({
                        kind: PowerChoiceKind.Bargain,
                        playerId: p.playerId,
                        secretsGiven: 0,
                        pairsGiven: 0
                    }))
        case PowerChoiceKind.Exchange:
            return (state, playerId) =>
                state.players
                    .filter((p) => p.playerId !== playerId)
                    .map((p) => ({
                        kind: PowerChoiceKind.Exchange,
                        withPlayerId: p.playerId,
                        terms: {}
                    }))
        case PowerChoiceKind.RelicSlot:
            return (state, playerId) => [
                ...relicSlotChoicesAtYourSite(state, playerId),
                ...reliquarySlotChoices(state)
            ]
        case PowerChoiceKind.FacedownAdviser:
            return (state, playerId) =>
                state.players
                    .filter((p) => p.playerId !== playerId)
                    .flatMap((p) => facedownAdviserChoices(p))
        case PowerChoiceKind.Warbands:
            return (state, playerId) =>
                boardWarbandGroups(state, playerId).map((group) => ({
                    kind: PowerChoiceKind.Warbands,
                    group
                }))
    }
}

function relicSlotChoices(slots: readonly RelicSlot[]): PowerChoice[] {
    return slots.map((slot) => ({ kind: PowerChoiceKind.RelicSlot, slotId: slot.slotId }))
}

export function relicSlotChoicesAtYourSite(
    state: HydratedOathGameState,
    playerId: string
): PowerChoice[] {
    return relicSlotChoices(state.relicSlotsAt(pawnSiteId(state, playerId)))
}

export function reliquarySlotChoices(state: HydratedOathGameState): PowerChoice[] {
    return relicSlotChoices(state.reliquarySlots())
}

/** R-9.4 — the facedown rows are public; which card each holds is not. */
export function facedownAdviserChoices(player: HydratedOathPlayerState): PowerChoice[] {
    return player.advisers.flatMap((row, index) =>
        row.faceUp
            ? []
            : [{ kind: PowerChoiceKind.FacedownAdviser, playerId: player.playerId, index }]
    )
}

/** R-X.4 — the choices a power asks in a game of this state's revision, in declaration order. */
export function choiceSpecsAt(state: HydratedOathGameState, power: CardPower): ChoiceSpec[] {
    return choiceSpecsFor(power).filter(
        (spec) =>
            (spec.fromRevision === undefined || isAtLeastOathRevision(state, spec.fromRevision)) &&
            (spec.beforeRevision === undefined ||
                !isAtLeastOathRevision(state, spec.beforeRevision))
    )
}

function domainOf(spec: ChoiceSpec): ChoiceDomain {
    return spec.domain ?? defaultDomain(spec.kind)
}

export interface LegalChoice {
    spec: ChoiceSpec
    options: PowerChoice[]
    /** `offeredChoices` only: the favor a FavorBank run comes to (`ChoiceSpec.favorTotal`). */
    total?: number
}

export type LegalPowerUse = PowerUseKey & { choices: LegalChoice[] }

function stateAfterChoices(
    state: HydratedOathGameState,
    playerId: string,
    power: CardPower,
    earlier: readonly PowerChoice[]
): HydratedOathGameState {
    if (earlier.length === 0) return state
    const stateAfter = effectFor(power)?.stateAfter
    assertExists(
        stateAfter,
        `${power.cardId} power ${power.powerIndex} declares sequential choices but no stateAfter`
    )
    return stateAfter({ state, playerId, power, choices: earlier })
}

function readingStates(
    state: HydratedOathGameState,
    playerId: string,
    power: CardPower,
    specs: readonly ChoiceSpec[],
    earlier: readonly PowerChoice[]
): (spec: ChoiceSpec) => HydratedOathGameState {
    const after = specs.some((spec) => spec.sequential)
        ? stateAfterChoices(state, playerId, power, earlier)
        : state
    return (spec) => (spec.sequential ? after : state)
}

export function legalChoices(
    state: HydratedOathGameState,
    playerId: string,
    power: CardPower,
    earlier: readonly PowerChoice[] = []
): LegalChoice[] {
    const specs = choiceSpecsAt(state, power)
    const readingFor = readingStates(state, playerId, power, specs, earlier)
    return specs.map((spec) => ({
        spec,
        options: domainOf(spec)(readingFor(spec), playerId, power)
    }))
}

/**
 * R-7.1.3 — the choices a menu offers: `legalChoices`, less a yes the card rules out now
 * (`ChoiceSpec.offered`) and a bank a favor run cannot name (`ChoiceSpec.favorTotal`, with the
 * run's total). It judges nothing: the doorway reads the domains alone.
 */
export function offeredChoices(
    state: HydratedOathGameState,
    playerId: string,
    power: CardPower
): LegalChoice[] {
    return legalChoices(state, playerId, power).map((legal) => {
        const { offered, favorTotal } = legal.spec
        if (offered && !offered(state, playerId)) return { ...legal, options: [] }
        if (!favorTotal) return legal
        const { sources, total } = favorTotal(state, playerId)
        return {
            ...legal,
            options: legal.options.filter(
                (option) =>
                    option.kind === PowerChoiceKind.FavorBank && sources.includes(option.suit)
            ),
            total
        }
    })
}

function keyOf(choice: PowerChoice): string {
    switch (choice.kind) {
        case PowerChoiceKind.Yes:
            return 'yes'
        case PowerChoiceKind.FavorBank:
            return `favorBank:${choice.suit}`
        case PowerChoiceKind.Player:
            return `player:${choice.playerId}`
        case PowerChoiceKind.Card:
            return `card:${choice.cardId}`
        case PowerChoiceKind.Site:
            return `site:${choice.siteId}`
        case PowerChoiceKind.Warbands:
            return `warbands:${choice.group.owner}@${JSON.stringify(choice.group.at)}`
        case PowerChoiceKind.Region:
            return `region:${choice.region}`
        case PowerChoiceKind.RelicSlot:
            return `relicSlot:${choice.slotId}`
        case PowerChoiceKind.FacedownAdviser:
            return `facedownAdviser:${choice.playerId}#${choice.index}`
        case PowerChoiceKind.Exchange:
            return `exchange:${choice.withPlayerId}`
        case PowerChoiceKind.Count:
            return 'count'
        case PowerChoiceKind.Bargain:
            return `bargain:${choice.playerId}`
    }
}

/** R-7.1.3, R-X.1 — matched to specs by kind, in declaration order. */
export function reasonChoicesInvalid(
    state: HydratedOathGameState,
    playerId: string,
    power: CardPower,
    choices: readonly PowerChoice[] | undefined
): string | undefined {
    const specs = choiceSpecsAt(state, power)
    const all = choices ?? []
    const given = [...all]

    if (specs.length === 0) {
        return given.length === 0
            ? undefined
            : `${power.cardId} power ${power.powerIndex} takes no choices, but ${given.length} were given`
    }

    // The state each sequential spec is read on depends only on the choices taken before it.
    const statesAfter = new Map<number, HydratedOathGameState>()
    const readingOf = (spec: ChoiceSpec, earlier: readonly PowerChoice[]) => {
        if (!spec.sequential) return state
        const known = statesAfter.get(earlier.length)
        if (known) return known
        const after = stateAfterChoices(state, playerId, power, earlier)
        statesAfter.set(earlier.length, after)
        return after
    }

    for (const [i, spec] of specs.entries()) {
        const taken: PowerChoice[] = []
        // A later spec of the same kind takes what only its domain offers (Warning Signals).
        const later = specs.slice(i + 1).filter((l) => l.kind === spec.kind)
        const laterSameKind = later.length > 0
        const earlier = all.slice(0, all.length - given.length)
        // Read only when a choice is matched against them: a spec past the last choice costs nothing.
        let options: Map<string, PowerChoice> | undefined
        const optionsOf = () =>
            (options ??= new Map(
                domainOf(spec)(readingOf(spec, earlier), playerId, power).map((option) => [
                    keyOf(option),
                    option
                ])
            ))
        let offeredLater: Set<string> | undefined
        const offeredLaterOf = () =>
            (offeredLater ??= new Set(
                later.flatMap((l) =>
                    domainOf(l)(readingOf(l, earlier), playerId, power).map((option) =>
                        keyOf(option)
                    )
                )
            ))
        while (taken.length < spec.max) {
            const next = given[0]
            if (next === undefined || next.kind !== spec.kind) break
            const key = keyOf(next)
            if (!optionsOf().has(key) && offeredLaterOf().has(key)) break
            taken.push(next)
            given.shift()
        }

        if (taken.length < spec.min) {
            return taken.length === 0
                ? `no choice was made for ${describe(spec)}`
                : `${taken.length} given where at least ${spec.min} of ${describe(spec)} were wanted`
        }
        // A surplus may belong to a later spec of the same kind.
        if (given.length > 0 && given[0].kind === spec.kind && !laterSameKind) {
            return `${taken.length + 1} given where at most ${spec.max} of ${describe(spec)} were wanted`
        }

        const seen = new Set<string>()
        for (const choice of taken) {
            const key = keyOf(choice)
            const option = optionsOf().get(key)
            if (!option) {
                return `${describe(choice)} is not among the options for ${describe(spec)}`
            }
            if (seen.has(key)) {
                return `${describe(choice)} was chosen twice for ${describe(spec)}`
            }
            seen.add(key)
            if (
                choice.kind === PowerChoiceKind.Warbands &&
                option.kind === PowerChoiceKind.Warbands
            ) {
                if (choice.group.count < 1) {
                    return `at least one warband must be chosen for ${describe(spec)}`
                }
                if (choice.group.count > option.group.count) {
                    return (
                        `${describeWarbands(choice.group.count, choice.group.owner)} chosen for ` +
                        `${describe(spec)}, but only ${option.group.count} are there`
                    )
                }
            }
        }
    }

    if (given.length > 0) {
        return `a ${given[0].kind} choice was given that ${power.cardId} power ${power.powerIndex} never asked for`
    }
    return undefined
}

function describeChoice(choice: PowerChoice): string {
    switch (choice.kind) {
        case PowerChoiceKind.Yes:
            return 'yes'
        case PowerChoiceKind.FavorBank:
            return `the ${choice.suit} bank`
        case PowerChoiceKind.Player:
            return choice.playerId
        case PowerChoiceKind.Card:
            return choice.cardId
        case PowerChoiceKind.Site:
            return choice.siteId
        case PowerChoiceKind.Warbands:
            return describeWarbands(choice.group.count, choice.group.owner)
        case PowerChoiceKind.Region:
            return `the ${choice.region}`
        case PowerChoiceKind.RelicSlot:
            return `the relic at ${choice.slotId}`
        case PowerChoiceKind.FacedownAdviser:
            return `${choice.playerId}'s facedown adviser ${choice.index + 1}`
        case PowerChoiceKind.Exchange:
            return `an exchange with ${choice.withPlayerId}`
        case PowerChoiceKind.Count:
            return `${choice.n}`
        case PowerChoiceKind.Bargain:
            return `the exchanges with ${choice.playerId}`
    }
}
function describe(x: ChoiceSpec | PowerChoice): string {
    return 'min' in x ? (x.what ?? `a ${x.kind}`) : describeChoice(x)
}
