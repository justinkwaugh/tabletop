import {
    HydratedSearchResolve,
    reasonCannotTakeByConspiracy,
    type ConspiracyPlay,
    type ConspiracyTake,
    type HydratedOathGameState
} from '@tabletop/oath'
import { bannerName, cardName } from './names.js'
import { bannersHeldBy } from './seatFacts.js'

export type TakePrizeOption = { prize: ConspiracyTake; label: string }

/** A Conspiracy's take as picked: whom from, which prize, and whether the player is done. */
export type ConspiracyPick = { targetPlayerId?: string; prizeIndex?: number; confirmed: boolean }

export const NO_CONSPIRACY_PICK: ConspiracyPick = { confirmed: false }

// R-5.1.4.IV — players at my site whose advisers the Conspiracy's take can match.
export function conspiracyTargets(state: HydratedOathGameState, playerId: string): string[] {
    const siteId = state.getPlayerState(playerId).siteId
    return state.players
        .filter(
            (p) =>
                p.playerId !== playerId &&
                p.siteId === siteId &&
                HydratedSearchResolve.conspiracyMatchIsValid(state, playerId, p.playerId)
        )
        .map((p) => p.playerId)
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
