import { pawnSiteId } from './pawn.js'
import { assertExists } from '@tabletop/common'
import * as Type from 'typebox'
import { HydratedOathGameState, type RelicSlot } from '../model/gameState.js'
import type { HydratedOathPlayerState } from '../model/playerState.js'
import { Region, Suit } from '../model/oathEnums.js'
import { WarbandGroup } from '../model/campaign.js'
import { ExchangeTerms, type ExchangeAllowance } from '../model/question.js'
import type { CardPower, PowerUseKey } from '../data/cardPowers.js'
import { accessibleCardIds } from './access.js'
import { boardWarbandGroups } from './force.js'
import { describeWarbands } from './warbands.js'
import { choiceSpecsFor } from '../powers/registry.js'

// R-7.1.3, R-X.1 — the engine never infers a choice, so every choice a power opens arrives on the action.

export enum PowerChoiceKind {
    /** R-7.1.3 — the bare "may". */
    Yes = 'yes',
    FavorBank = 'favorBank',
    Player = 'player',
    Card = 'card',
    Site = 'site',
    Warbands = 'warbands',
    Region = 'region',
    RelicSlot = 'relicSlot',
    /** R-9.4 */
    FacedownAdviser = 'facedownAdviser',
    /** R-7.6.3 — the card's effect validates the terms. */
    Exchange = 'exchange',
    /** The card's effect bounds the number. */
    Count = 'count'
}

export type PowerChoice = Type.Static<typeof PowerChoice>
export const PowerChoice = Type.Union([
    Type.Object({ kind: Type.Literal(PowerChoiceKind.Yes) }),
    Type.Object({ kind: Type.Literal(PowerChoiceKind.FavorBank), suit: Type.Enum(Suit) }),
    Type.Object({ kind: Type.Literal(PowerChoiceKind.Player), playerId: Type.String() }),
    Type.Object({ kind: Type.Literal(PowerChoiceKind.Card), cardId: Type.String() }),
    Type.Object({ kind: Type.Literal(PowerChoiceKind.Site), siteId: Type.String() }),
    Type.Object({ kind: Type.Literal(PowerChoiceKind.Warbands), group: WarbandGroup }),
    Type.Object({ kind: Type.Literal(PowerChoiceKind.Region), region: Type.Enum(Region) }),
    Type.Object({ kind: Type.Literal(PowerChoiceKind.RelicSlot), slotId: Type.String() }),
    Type.Object({
        kind: Type.Literal(PowerChoiceKind.FacedownAdviser),
        playerId: Type.String(),
        index: Type.Integer({ minimum: 0, maximum: 15 })
    }),
    Type.Object({
        kind: Type.Literal(PowerChoiceKind.Exchange),
        withPlayerId: Type.String(),
        terms: ExchangeTerms
    }),
    Type.Object({ kind: Type.Literal(PowerChoiceKind.Count), n: Type.Number() })
])

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
    what?: string
    allows?: ExchangeAllowance
}

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

function domainOf(spec: ChoiceSpec): ChoiceDomain {
    return spec.domain ?? defaultDomain(spec.kind)
}

export interface LegalChoice {
    spec: ChoiceSpec
    options: PowerChoice[]
}

export type LegalPowerUse = PowerUseKey & { choices: LegalChoice[] }

export function legalChoices(
    state: HydratedOathGameState,
    playerId: string,
    power: CardPower
): LegalChoice[] {
    return choiceSpecsFor(power).map((spec) => ({
        spec,
        options: domainOf(spec)(state, playerId, power)
    }))
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
    }
}

/** R-7.1.3, R-X.1 — matched to specs by kind, in declaration order. */
export function reasonChoicesInvalid(
    state: HydratedOathGameState,
    playerId: string,
    power: CardPower,
    choices: readonly PowerChoice[] | undefined
): string | undefined {
    const specs = choiceSpecsFor(power)
    const given = [...(choices ?? [])]

    if (specs.length === 0) {
        return given.length === 0
            ? undefined
            : `${power.cardId} power ${power.powerIndex} takes no choices, but ${given.length} were given`
    }

    for (const [i, spec] of specs.entries()) {
        const taken: PowerChoice[] = []
        // A later spec of the same kind takes what only its domain offers (Warning Signals).
        const later = specs.slice(i + 1).filter((l) => l.kind === spec.kind)
        const laterSameKind = later.length > 0
        const offered = new Set(
            domainOf(spec)(state, playerId, power).map((option) => keyOf(option))
        )
        const offeredLater = new Set(
            later.flatMap((l) => domainOf(l)(state, playerId, power).map((option) => keyOf(option)))
        )
        while (taken.length < spec.max) {
            const next = given[0]
            if (next === undefined || next.kind !== spec.kind) break
            const key = keyOf(next)
            if (!offered.has(key) && offeredLater.has(key)) break
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

        const options = new Map(
            domainOf(spec)(state, playerId, power).map((option) => [keyOf(option), option])
        )
        const seen = new Set<string>()
        for (const choice of taken) {
            const key = keyOf(choice)
            const option = options.get(key)
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
    }
}
function describe(x: ChoiceSpec | PowerChoice): string {
    return 'min' in x ? (x.what ?? `a ${x.kind}`) : describeChoice(x)
}
