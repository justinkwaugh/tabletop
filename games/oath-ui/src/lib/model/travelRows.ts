import {
    ActionType,
    FAVOR_BANK_ORDER,
    HydratedTravel,
    PowerChoiceKind,
    burnedFavorTaker,
    favorHomeBankOf,
    holdsTheTurn,
    resolveModifiers,
    secretsFlipped,
    suitOf,
    tollsFor,
    type HydratedOathGameState,
    type ModifierUse,
    type PowerUseKey,
    type Region,
    type Suit,
    type Toll
} from '@tabletop/oath'
import { travelWays, type TravelWay } from './actionOffers.js'
import { fittingModifiers } from './modifierFit.js'

/** "After traveling, gain [favor] from one favor bank that matches both a card at your site and one of your advisers." */
export const HOSPITALITY = 'denizen.nomad.hospitality'

export type TravelChoice = TravelWay & {
    favorTo: (string | undefined)[]
    /** Hospitality's bank, gained from after the move; absent where it gives nothing. */
    hospitality?: Suit
    /** The cards in use this way is sent with: the destination's, and Hospitality with its bank. */
    modifiers: ModifierUse[]
}

export type TravelRow = {
    slotId: string
    region: Region
    /** Absent while the site is facedown (R-9.4). */
    cardId?: string
    /**
     * One per way to pay, and per bank Hospitality could take there: a destination where two banks
     * match offers each of its ways once for each bank.
     */
    ways: TravelChoice[]
    /** The cards in use that fit this destination: its ways are priced with them. */
    modifiers: ModifierUse[]
}

export function isHospitality(use: PowerUseKey): boolean {
    return use.cardId === HOSPITALITY
}

const usingBank = (use: PowerUseKey, suit: Suit): ModifierUse => ({
    cardId: use.cardId,
    powerIndex: use.powerIndex,
    choices: [{ kind: PowerChoiceKind.FavorBank, suit }]
})

/** The bank a Hospitality declaration names, if it names one. */
function namedBank(use: ModifierUse): Suit | undefined {
    for (const choice of use.choices ?? []) {
        if (choice.kind === PowerChoiceKind.FavorBank) return choice.suit
    }
    return undefined
}

/** R-7.4 — the cards in use a Travel to this site is judged and sent with. */
export function travelModifiers(
    state: HydratedOathGameState,
    playerId: string,
    slotId: string,
    declared: readonly ModifierUse[]
): ModifierUse[] {
    return fittingModifiers(state, playerId, ActionType.Travel, declared, {
        destinationSiteId: slotId
    })
}

/** A Travel card in use whose cost the player pays: what it places and burns, and where it is. */
type CardCost = { cardId: string; placeFavor: number; burnFavor: number }

/** R-7.1.2 — the favor costs of the cards a Travel to this site is sent with, as the engine pays them. */
function cardCosts(
    state: HydratedOathGameState,
    playerId: string,
    slotId: string,
    modifiers: readonly ModifierUse[]
): CardCost[] {
    return resolveModifiers(state, playerId, ActionType.Travel, modifiers, {
        destinationSiteId: slotId
    })
        .active.filter((m) => !m.mandatory)
        .map(({ power }) => ({
            cardId: power.cardId,
            placeFavor: power.cost.placeFavor,
            burnFavor: power.cost.burnFavor
        }))
}

/**
 * R-7.1.2, R-7.1.4, R-7.4 — each bank as the way's payments leave it, for Hospitality's gain after
 * the move. The engine pays the cards' costs, then the tolls, before the move. Favor paid leaves the
 * player's board first, then the bank the engine keeps their favor in (Vow of Kinship,
 * `favorHomeBankOf`), as `spendFavor` takes it. A cost's placed favor goes onto its card, or out of
 * turn into the card's own bank (R-7.1.2.a); a toll's favor reaches its payee as `receiveFavor`
 * gives it, into their bank under the same vow; burned favor (a cost's burn, a toll for the bandits)
 * goes to whoever takes it (Vow of Renewal, `burnedFavorTaker`), into their bank under the vow, or
 * else leaves the banks. An emptied bank gives nothing on that way (R-9.3); a way that leaves it
 * favor still can.
 */
function banksAfterPayments(
    state: HydratedOathGameState,
    playerId: string,
    costs: readonly CardCost[],
    tolls: readonly Toll[]
): Record<Suit, number> {
    const banks = { ...state.favorBank }
    const into = (suit: Suit | undefined, count: number) => {
        if (suit) banks[suit] += count
    }
    const burned = (count: number) => {
        const taker = burnedFavorTaker(state)
        if (taker) into(favorHomeBankOf(state, taker), count)
    }
    const paid =
        costs.reduce((n, cost) => n + cost.placeFavor + cost.burnFavor, 0) + tolls.length
    const fromBank = Math.max(0, paid - state.getPlayerState(playerId).favor)
    into(favorHomeBankOf(state, playerId), -fromBank)
    const outOfTurn = !holdsTheTurn(state, playerId)
    for (const { cardId, placeFavor, burnFavor } of costs) {
        if (outOfTurn) into(suitOf(cardId), placeFavor)
        burned(burnFavor)
    }
    for (const { payeeId } of tolls) {
        if (payeeId) into(favorHomeBankOf(state, payeeId), 1)
        else burned(1)
    }
    return banks
}

/**
 * Hospitality — the banks this way could gain from: each that matches a card at the destination
 * and one of the player's advisers, as the engine judges it with the way's other cards, and that
 * holds favor to give once those cards' costs and the way's tolls are paid (an empty bank gives
 * nothing, R-9.3). A declaration naming a bank keeps to it.
 */
function hospitalityBanks(
    state: HydratedOathGameState,
    playerId: string,
    slotId: string,
    way: TravelWay,
    tolls: readonly Toll[],
    others: readonly ModifierUse[],
    hospitality: ModifierUse
): Suit[] {
    const named = namedBank(hospitality)
    const banks = banksAfterPayments(
        state,
        playerId,
        cardCosts(state, playerId, slotId, others),
        tolls.filter((toll) => way.tolls.includes(toll.cardId))
    )
    return FAVOR_BANK_ORDER.filter(
        (suit) =>
            (named === undefined || named === suit) &&
            banks[suit] > 0 &&
            HydratedTravel.reasonCannotTravel(
                state,
                playerId,
                slotId,
                [...others, usingBank(hospitality, suit)],
                way.tolls,
                way.flipSecret
            ) === undefined
    )
}

/**
 * R-5.6, R-7.1.4, R-11.12 — every Travel the player can make now, read from the engine's terms.
 * R-7.4 — Hospitality takes no bank before the destination: each destination is priced without
 * it, then each way is offered once per bank it fits there, or once without it where none does,
 * so no destination is hidden.
 */
export function travelRows(
    state: HydratedOathGameState,
    playerId: string,
    declared: readonly ModifierUse[]
): TravelRow[] {
    const hospitality = declared.find(isHospitality)
    const others = declared.filter((use) => !isHospitality(use))
    return state.allSiteIds().flatMap((slotId): TravelRow[] => {
        const modifiers = travelModifiers(state, playerId, slotId, others)
        const terms = travelWays(state, playerId, slotId, modifiers)
        if (terms.length === 0) return []
        const tolls = tollsFor(state, playerId, { kind: 'travel', toSiteId: slotId })
        const ways = terms.flatMap((way): TravelChoice[] => {
            const choice = {
                ...way,
                favorTo: way.tolls.map(
                    (cardId) => tolls.find((t) => t.cardId === cardId)?.payeeId
                ),
                modifiers
            }
            if (!hospitality) return [choice]
            const banks = hospitalityBanks(
                state,
                playerId,
                slotId,
                way,
                tolls,
                modifiers,
                hospitality
            )
            if (banks.length === 0) return [choice]
            return banks.map((suit) => ({
                ...choice,
                hospitality: suit,
                modifiers: [...modifiers, usingBank(hospitality, suit)]
            }))
        })
        const cardId = state.isSiteFaceup(slotId) ? state.siteCardAt(slotId) : undefined
        return [
            {
                slotId,
                region: state.regionOf(slotId),
                ...(cardId ? { cardId } : {}),
                ways,
                modifiers
            }
        ]
    })
}

/** The same way to pay: its tolls and its flip, whatever bank it gains from. */
export function samePayment(a: TravelWay, b: TravelWay): boolean {
    return (
        a.flipSecret === b.flipSecret &&
        a.tolls.length === b.tolls.length &&
        a.tolls.every((t) => b.tolls.includes(t))
    )
}

/** Each way to pay once, whatever banks Hospitality splits it into. */
export function waysToPay<Way extends TravelWay>(ways: readonly Way[]): Way[] {
    return ways.filter((way, index) => !ways.slice(0, index).some((w) => samePayment(w, way)))
}

/** A way that costs nothing: no Supply, no toll and no secret flipped. A Hospitality gain is no cost. */
export function costsNothing(way: TravelWay): boolean {
    return way.cost === 0 && way.tolls.length === 0 && secretsFlipped(way.flipSecret) === 0
}

/**
 * The ways a destination shows: where one costs nothing, only that way (once per bank Hospitality
 * could gain from), the dearer ways hidden; else every way. The engine still accepts any legal way.
 */
export function waysToShow<Way extends TravelWay>(ways: readonly Way[]): Way[] {
    const free = ways.filter(costsNothing)
    return free.length > 0 ? free : [...ways]
}

/** The banks Hospitality could gain from at a destination, each once, in the banks' order. */
export function hospitalityBanksOf(ways: readonly { hospitality?: Suit }[]): Suit[] {
    return FAVOR_BANK_ORDER.filter((suit) => ways.some((way) => way.hospitality === suit))
}

/**
 * R-7.4 — a destination as the Travel menu offers it, Hospitality's banks left out: its gain comes
 * after the move, so a destination it fits offers the same Travel as without it.
 */
export function travelOffer(row: TravelRow): object {
    return {
        slotId: row.slotId,
        region: row.region,
        cardId: row.cardId,
        ways: waysToPay(row.ways).map((way) => ({
            tolls: way.tolls,
            flipSecret: way.flipSecret,
            cost: way.cost,
            discountTolls: way.discountTolls,
            favorTo: way.favorTo
        }))
    }
}
