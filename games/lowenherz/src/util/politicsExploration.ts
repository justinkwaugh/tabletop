import {
    assert,
    assertExists,
    shuffle,
    type GameAction,
    type RandomFunction
} from '@tabletop/common'
import {
    PoliticsCardDeck,
    PoliticsCardType,
    samePoliticsCard,
    type PoliticsCard
} from '../definition/politicsCards.js'
import type { LowenherzProjectedState } from '../model/gameState.js'
import { isTakePoliticsCard } from '../actions/takePoliticsCard.js'
import { isLookAtPoliticsPile } from '../actions/lookAtPoliticsPile.js'
import { isPlayAllianceCard } from '../actions/playAllianceCard.js'
import { isPlayRenegadeCard } from '../actions/playRenegadeCard.js'
import { isPlaceKnight } from '../actions/placeKnight.js'
import { isSubmitDuelBid } from '../actions/submitDuelBid.js'

type Slot = { pile: 'A' | 'B'; position: number; playerId?: string; known?: PoliticsCard }
type Constraint = { slots: number[]; face: number; min: number; max: number }

export function populatePoliticsCards(
    state: LowenherzProjectedState,
    actions: readonly GameAction[],
    random: RandomFunction
) {
    const faces = PoliticsCardDeck.filter(
        (card, index, cards) => cards.findIndex((other) => samePoliticsCard(card, other)) === index
    )
    const faceIndex = (card: PoliticsCard) => {
        const index = faces.findIndex((face) => samePoliticsCard(face, card))
        assert(index >= 0, 'Exploration encountered an unknown politics card')
        return index
    }
    const counts = (cards: PoliticsCard[]) => {
        const result = faces.map(() => 0)
        for (const card of cards) result[faceIndex(card)]++
        return result
    }
    const slots: Slot[] = []
    actions.forEach((action, position) => {
        if (isTakePoliticsCard(action))
            slots.push({
                pile: action.pile,
                position,
                playerId: action.playerId,
                known: action.card
            })
    })
    for (const pile of ['A', 'B'] as const) {
        const count = pile === 'A' ? state.politicsPileACount : state.politicsPileBCount
        assertExists(count, 'Exploration requires public politics pile counts')
        assert(Number.isInteger(count) && count >= 0 && count <= 13, 'Invalid politics pile count')
        for (let i = 0; i < count; i++) slots.push({ pile, position: actions.length })
    }
    assert(
        slots.length === PoliticsCardDeck.length,
        'Exploration requires complete politics acquisition history'
    )
    assert(
        [6, 7].includes(slots.filter((slot) => slot.pile === 'A').length),
        'Invalid initial politics pile sizes'
    )
    const constraints: Constraint[] = []
    const indices = (predicate: (slot: Slot) => boolean) =>
        slots.flatMap((slot, i) => (predicate(slot) ? [i] : []))
    const exact = (selected: number[], cards: PoliticsCard[]) => {
        assert(selected.length === cards.length, 'Politics observation has an inconsistent count')
        counts(cards).forEach((count, face) =>
            constraints.push({ slots: selected, face, min: count, max: count })
        )
    }
    exact(
        indices(() => true),
        PoliticsCardDeck
    )
    slots.forEach((slot, index) => {
        if (slot.known) exact([index], [slot.known])
    })
    const spent = new Map(state.players.map((player) => [player.playerId, faces.map(() => 0)]))
    const requireHeld = (
        playerId: string,
        cards: PoliticsCard[],
        position: number,
        discard: boolean
    ) => {
        const consumed = spent.get(playerId)
        assertExists(consumed, 'Unknown politics card owner')
        const needed = counts(cards)
        const acquired = indices((slot) => slot.playerId === playerId && slot.position < position)
        needed.forEach((quantity, face) => {
            if (!quantity) return
            constraints.push({
                slots: acquired,
                face,
                min: consumed[face] + quantity,
                max: acquired.length
            })
            if (discard) consumed[face] += quantity
        })
    }
    actions.forEach((action, position) => {
        if (isLookAtPoliticsPile(action) && action.metadata?.cards) {
            exact(
                indices((slot) => slot.pile === action.pile && slot.position > position),
                action.metadata.cards
            )
        } else if (isPlayAllianceCard(action)) {
            requireHeld(action.playerId, [{ type: PoliticsCardType.Alliance }], position, true)
        } else if (isPlayRenegadeCard(action)) {
            requireHeld(action.playerId, [{ type: PoliticsCardType.Renegade }], position, true)
        } else if (isPlaceKnight(action) && action.treasureValue !== undefined) {
            requireHeld(
                action.playerId,
                [{ type: PoliticsCardType.Treasure, value: action.treasureValue }],
                position,
                true
            )
        } else if (isSubmitDuelBid(action)) {
            const result = action.metadata?.roundResult
            if (action.metadata?.duelResult)
                assertExists(result, 'Exploration requires complete duel reveal records')
            if (result) {
                for (const bid of result.bids) {
                    requireHeld(
                        bid.playerId,
                        bid.treasureValues.map((value) => ({
                            type: PoliticsCardType.Treasure,
                            value
                        })),
                        position,
                        action.metadata?.duelResult === 'win' &&
                            action.metadata.winnerId === bid.playerId
                    )
                }
            }
        }
    })
    for (const player of state.players) {
        const acquired = indices((slot) => slot.playerId === player.playerId)
        const consumed = spent.get(player.playerId)!
        assert(
            acquired.length - consumed.reduce((sum, count) => sum + count, 0) ===
                player.politicsCardCount,
            'Exploration hand counts disagree with public acquisitions and payments'
        )
        const known =
            player.politicsCards ??
            state.finalHands?.find((hand) => hand.playerId === player.playerId)?.cards
        if (known) {
            const quantities = counts(known)
            quantities.forEach((quantity, face) =>
                constraints.push({
                    slots: acquired,
                    face,
                    min: consumed[face] + quantity,
                    max: consumed[face] + quantity
                })
            )
        }
        if (player.politicsInspection) {
            exact(
                indices(
                    (slot) =>
                        slot.pile === player.politicsInspection?.pile && slot.playerId === undefined
                ),
                player.politicsInspection.cards
            )
        }
        const bid = state.duel?.bids.find((bid) => bid.playerId === player.playerId)
        if (bid?.treasureValues)
            requireHeld(
                player.playerId,
                bid.treasureValues.map((value) => ({ type: PoliticsCardType.Treasure, value })),
                actions.length,
                false
            )
    }
    const assignment = assignFaces(slots.length, faces.length, constraints, random)
    assertExists(
        assignment,
        'No hypothetical politics distribution satisfies the revealed information'
    )
    const cardsAt = (selected: number[]) =>
        selected.map((index) => ({ ...faces[assignment[index]] }))
    const hands = new Map(
        state.players.map((player) => {
            const hand = cardsAt(indices((slot) => slot.playerId === player.playerId))
            const consumed = spent.get(player.playerId)!
            const remaining = hand.filter((card) => {
                const face = faceIndex(card)
                if (consumed[face] === 0) return true
                consumed[face]--
                return false
            })
            shuffle(remaining, random)
            return [player.playerId, remaining] as const
        })
    )
    const pile = (letter: 'A' | 'B') => {
        const cards = cardsAt(
            indices((slot) => slot.pile === letter && slot.playerId === undefined)
        )
        shuffle(cards, random)
        return cards
    }
    return { hands, politicsCardPileA: pile('A'), politicsCardPileB: pile('B') }
}

function assignFaces(
    size: number,
    faceCount: number,
    constraints: Constraint[],
    random: RandomFunction
): number[] | undefined {
    const domains = Array.from({ length: size }, () =>
        Array.from({ length: faceCount }, (_, face) => face)
    )
    for (const constraint of constraints) {
        if (constraint.max === 0)
            for (const slot of constraint.slots)
                domains[slot] = domains[slot].filter((face) => face !== constraint.face)
        if (constraint.min === constraint.slots.length)
            for (const slot of constraint.slots)
                domains[slot] = domains[slot].filter((face) => face === constraint.face)
    }
    const order = Array.from({ length: size }, (_, index) => index)
    shuffle(order, random)
    order.sort((a, b) => domains[a].length - domains[b].length)
    domains.forEach((domain) => shuffle(domain, random))
    const assigned = Array.from({ length: size }, () => -1)
    const valid = () =>
        constraints.every((constraint) => {
            let certain = 0
            let possible = 0
            for (const slot of constraint.slots) {
                if (assigned[slot] === constraint.face) {
                    certain++
                    possible++
                } else if (assigned[slot] === -1 && domains[slot].includes(constraint.face)) {
                    possible++
                    if (domains[slot].length === 1) certain++
                }
            }
            return certain <= constraint.max && possible >= constraint.min
        })
    const failed = new Set<string>()
    const search = (depth: number): boolean => {
        if (!valid()) return false
        if (depth === size) return true
        const key = `${depth}:${constraints.map((constraint) => constraint.slots.filter((slot) => assigned[slot] === constraint.face).length).join(',')}`
        if (failed.has(key)) return false
        const slot = order[depth]
        for (const face of domains[slot]) {
            assigned[slot] = face
            if (search(depth + 1)) return true
        }
        assigned[slot] = -1
        failed.add(key)
        return false
    }
    return search(0) ? assigned : undefined
}
