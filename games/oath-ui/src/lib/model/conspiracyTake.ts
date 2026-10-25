import {
    conspiracyTakeRefusal,
    reasonCannotTakeByConspiracy,
    type ConspiracyPlay,
    type ConspiracyTake,
    type ConspiracyTakeGuard,
    type ConspiracyTakeRefusal,
    type HydratedOathGameState
} from '@tabletop/oath'
import { bannerName, cardName, type ReasonPart } from './names.js'
import { bannersHeldBy } from './seatFacts.js'

export type TakePrizeOption = { prize: ConspiracyTake; label: string }

/** A Conspiracy's take as picked: whom from, which prize, and whether the player is done. */
export type ConspiracyPick = { targetPlayerId?: string; prizeIndex?: number; confirmed: boolean }

export const NO_CONSPIRACY_PICK: ConspiracyPick = { confirmed: false }

const LOST_TONGUE = 'denizen.nomad.lost-tongue'
/**
 * Cards that guard one banner: Tome Guardians the Darkest Secret; Vow of Silence and Vow of
 * Renewal theirs, in a game stored before the vows came to forbid only a Recover.
 */
const BANNER_GUARDS = new Set([
    'denizen.order.tome-guardians',
    'denizen.arcane.vow-of-silence',
    'denizen.discord.vow-of-renewal'
])

/**
 * Why no one at the site can be taken from: a cause's short words, a seat in them as its chip;
 * for a guard the words do not name, the engine's own sentence.
 */
export type ConspiracyNoTakeLine =
    { kind: 'words'; parts: ReasonPart[] } | { kind: 'engine'; reason: string }

function othersHere(state: HydratedOathGameState, playerId: string): string[] {
    const siteId = state.getPlayerState(playerId).siteId
    if (siteId === undefined) return []
    return state.players
        .filter((p) => p.playerId !== playerId && p.siteId === siteId)
        .map((p) => p.playerId)
}

// R-5.1.4.IV — players at my site the take can reach: a secret to burn, the match, and a prize.
export function conspiracyTargets(state: HydratedOathGameState, playerId: string): string[] {
    return othersHere(state, playerId).filter(
        (target) => conspiracyTakeRefusal(state, playerId, target) === undefined
    )
}

/** When no one at the site can be taken from, one line per other player there; else none. */
export function conspiracyNoTake(
    state: HydratedOathGameState,
    playerId: string
): ConspiracyNoTakeLine[] {
    const others = othersHere(state, playerId)
    if (others.length === 0) return [words('No one else is here.')]
    const lines: ConspiracyNoTakeLine[] = []
    for (const target of others) {
        const refusal = conspiracyTakeRefusal(state, playerId, target)
        if (!refusal) return []
        for (const line of noTakeLines(target, refusal)) {
            // A cause that is yours, not theirs (the secret, Spell Breaker), is said once.
            if (!lines.some((shown) => JSON.stringify(shown) === JSON.stringify(line))) {
                lines.push(line)
            }
        }
    }
    return lines
}

/**
 * Short facts by cause, as the action grid's: "Needs N …; you have M.", a card's name first.
 * One line, except where different cards guard different prizes: one line per card.
 */
function noTakeLines(target: string, refusal: ConspiracyTakeRefusal): ConspiracyNoTakeLine[] {
    const seat = (possessive: boolean): ReasonPart => ({
        kind: 'seat',
        playerId: target,
        possessive
    })
    const text = (value: string): ReasonPart => ({ kind: 'text', text: value })
    switch (refusal.cause) {
        case 'secret':
            return [words(`Needs 1 secret; you have ${refusal.has}.`)]
        case 'secretCost':
            return [words(`${cardName(refusal.cardId)}: no secret costs.`)]
        case 'match':
            return [
                {
                    kind: 'words',
                    parts: [
                        text(`Needs ${refusal.needs} advisers matching `),
                        seat(true),
                        text(`; you have ${refusal.has}.`)
                    ]
                }
            ]
        case 'nothingHeld':
            return [{ kind: 'words', parts: [seat(false), text(' holds no relic or banner.')] }]
        case 'guarded': {
            // Lost Tongue refuses all its holder holds, whichever card the engine met first for a prize.
            if (refusal.guards.some((guard) => guard.cardId === LOST_TONGUE)) {
                return [
                    {
                        kind: 'words',
                        parts: [
                            text(`${cardName(LOST_TONGUE)}: `),
                            seat(true),
                            text(' can’t be taken.')
                        ]
                    }
                ]
            }
            const byCard = refusal.guards.filter(
                (guard, i) => refusal.guards.findIndex((g) => g.cardId === guard.cardId) === i
            )
            return byCard.map(guardLine)
        }
    }
}

/** "<card>: the <banner> can’t be taken."; a guard these words do not name keeps the engine's sentence. */
function guardLine(guard: ConspiracyTakeGuard): ConspiracyNoTakeLine {
    if (BANNER_GUARDS.has(guard.cardId) && guard.take.kind === 'banner') {
        return words(
            `${cardName(guard.cardId)}: the ${bannerName(guard.take.banner)} can’t be taken.`
        )
    }
    return { kind: 'engine', reason: guard.reason }
}

function words(text: string): ConspiracyNoTakeLine {
    return { kind: 'words', parts: [{ kind: 'text', text }] }
}

// Circlet of Command, Lost Tongue, Tome Guardians — a prize they guard is not offered.
export function conspiracyPrizes(
    state: HydratedOathGameState,
    playerId: string,
    targetPlayerId: string
): TakePrizeOption[] {
    const relics = state.getPlayerState(targetPlayerId).relicIds.map((cardId) => ({
        prize: { kind: 'relic' as const, cardId },
        label: cardName(cardId)
    }))
    const banners = bannersHeldBy(state, targetPlayerId).map((banner) => ({
        prize: { kind: 'banner' as const, banner },
        label: `the ${bannerName(banner)}`
    }))
    return [...relics, ...banners].filter(
        ({ prize }) =>
            reasonCannotTakeByConspiracy(state, playerId, targetPlayerId, prize) === undefined
    )
}

/** The take a pick names, while its target and prize are still on offer. */
export function conspiracyPlayOf(
    state: HydratedOathGameState,
    playerId: string,
    pick: ConspiracyPick
): ConspiracyPlay | undefined {
    const target = pick.targetPlayerId
    if (!target || !conspiracyTargets(state, playerId).includes(target)) return undefined
    const prize =
        pick.prizeIndex === undefined
            ? undefined
            : conspiracyPrizes(state, playerId, target)[pick.prizeIndex]?.prize
    return prize ? { targetPlayerId: target, take: prize } : undefined
}

/**
 * The take is picked whole: nobody (no take, R-5.1.4.IV's "may"), or a player and a prize. A
 * player picked with no prize is a take begun, not a decline.
 */
export function conspiracyPickComplete(
    state: HydratedOathGameState,
    playerId: string,
    pick: ConspiracyPick
): boolean {
    const target = pick.targetPlayerId
    return (
        target === undefined ||
        !conspiracyTargets(state, playerId).includes(target) ||
        conspiracyPlayOf(state, playerId, pick) !== undefined
    )
}
