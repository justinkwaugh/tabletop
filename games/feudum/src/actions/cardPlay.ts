import { assertExists } from '@tabletop/common'
import * as Type from 'typebox'
import type { SpaceId } from '../data/board.js'
import {
    ActionCards,
    type ActionCard,
    type ActionCardKind,
    type SpecialNeed
} from '../data/cards.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import type { HydratedFeudumPlayerState, PlayedCard } from '../model/playerState.js'
import { returnGoodToHaversack } from '../model/supply.js'

/** R-3.15 `repeat` is Repeat replaying an x2 card; `deja-vu` is Déjà Vu, for a saltpeter. */
export type RepeatMode = Type.Static<typeof RepeatMode>
export const RepeatMode = Type.Union([Type.Literal('repeat'), Type.Literal('deja-vu')])

/** R-3.15, R-3.3-H1 What every card play's input may carry, intersected into its schema. */
export const CardPlayFields = Type.Object({
    /** R-3.15 The card from the hand is Repeat; the Action's own card is the one replayed. */
    asRepeat: Type.Optional(RepeatMode),
    /** R-3.3-H1 The sequential turn, declared with the first of its two cards. */
    secondCard: Type.Optional(Type.Literal(true))
})

export type CardPlayInput = Readonly<Type.Static<typeof CardPlayFields>>

/** R-3.5 */
export function cardOf(kind: ActionCardKind): ActionCard {
    const card = ActionCards.find((row) => row.kind === kind)
    assertExists(card, `R-3.5 There is a card ${kind}`)
    return card
}

/** R-3.2 Only the turn player plays a card. */
export function reasonTurnRefused(
    state: HydratedFeudumGameState,
    playerId: string
): string | undefined {
    return state.flow.turn?.playerId === playerId ? undefined : "It isn't your turn."
}

/** R-3.2 */
export function reasonNotInHandRefused(
    player: HydratedFeudumPlayerState,
    kind: ActionCardKind
): string | undefined {
    return player.requireHand().includes(kind)
        ? undefined
        : `${cardOf(kind).printedName} isn't in your hand.`
}

/**
 * R-3.13-H1 A not-last card needs another unplayed card, which a second card counts as. Only the
 * regular and special plays ask this; `ForfeitCard` is the way to play it last.
 */
export function reasonNotLastRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    kind: ActionCardKind
): string | undefined {
    const card = cardOf(kind)
    return card.symbols.notLast && state.getPlayerState(playerId).requireHand().length <= 1
        ? `${card.printedName} can't be your last card: forfeit it.`
        : undefined
}

/** R-3.3, R-3.3-H1 Once a round, with the pouch sulfur, and with a card left to be the second. */
export function reasonSecondCardRefused(player: HydratedFeudumPlayerState): string | undefined {
    if (player.pouch !== 'sulfur') {
        return 'You have no sulfur on your pouch.'
    }
    if (player.sequentialUsed) {
        return 'You have already played your sequential turn.'
    }
    return player.requireHand().length > 1 ? undefined : 'You have no second card to play.'
}

/** R-3.15.1, R-3.15.2 A played card, by Repeat if it shows x2; never one with the crossed x2. */
export function reasonRepeatRefused(
    player: HydratedFeudumPlayerState,
    kind: ActionCardKind,
    mode: RepeatMode
): string | undefined {
    const card = cardOf(kind)
    if (!player.requireHand().includes('repeat')) {
        return "Repeat isn't in your hand."
    }
    if (player.repeatUsed) {
        return 'You have already repeated a card this round.'
    }
    if (card.symbols.replay === 'crossed-x2') {
        return `${card.printedName} can't be replayed.`
    }
    if (!player.played.some((played) => played.kind === kind)) {
        return `You haven't played ${card.printedName} this round.`
    }
    if (mode === 'repeat') {
        return card.symbols.replay === 'x2'
            ? undefined
            : `${card.printedName} has no x2: only Déjà Vu replays it.`
    }
    return player.goods.saltpeter > 0 ? undefined : 'Déjà Vu needs a saltpeter.'
}

/**
 * R-3.2, R-3.3-H1, R-3.13-H1, R-3.15 What every regular or special play asks first. Each action's
 * own `reasonXRefused` calls this, then adds what its card needs.
 */
export function reasonCardPlayRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    kind: ActionCardKind,
    input: CardPlayInput
): string | undefined {
    const player = state.getPlayerState(playerId)
    return (
        reasonTurnRefused(state, playerId) ??
        (input.asRepeat
            ? reasonRepeatRefused(player, kind, input.asRepeat)
            : (reasonNotInHandRefused(player, kind) ??
              reasonNotLastRefused(state, playerId, kind))) ??
        (input.secondCard ? reasonSecondCardRefused(player) : undefined)
    )
}

function withArticle(word: string): string {
    return `${/^[aeiou]/i.test(word) ? 'an' : 'a'} ${word}`
}

function titled(word: string): string {
    return `${word.charAt(0).toUpperCase()}${word.slice(1)}`
}

/** R-3.4 The need as the rest of a sentence, or undefined when it is met. */
function unmetNeed(
    player: HydratedFeudumPlayerState,
    need: SpecialNeed,
    spaceId?: SpaceId
): string | undefined {
    switch (need.kind) {
        case 'pawn-on-board': {
            return player.pawns.some((pawn) => pawn.spaceId && pawn.character === need.character)
                ? undefined
                : `${withArticle(titled(need.character))} pawn on the board`
        }
        // R-3.5 Until the action names its space, anywhere on the board is enough to offer it.
        case 'pawn-at-location': {
            return player.pawns.some(
                (pawn) =>
                    pawn.character === need.character &&
                    (spaceId ? pawn.spaceId === spaceId : pawn.spaceId)
            )
                ? undefined
                : `${withArticle(titled(need.character))} pawn at the location`
        }
        case 'good': {
            return player.goods[need.good] > 0 ? undefined : withArticle(need.good)
        }
        case 'barrel-sulfur': {
            return player.barrel > 0 ? undefined : 'a sulfur in your barrel'
        }
        case 'shillings': {
            return player.shillings >= need.shillings
                ? undefined
                : `${need.shillings} shilling${need.shillings === 1 ? '' : 's'}`
        }
    }
}

/**
 * R-3.4, R-3.4-H1 Every game uses the advanced rules: a special is refused only for an unmet need.
 * `spaceId` is the space an action has named, for a card showing a pawn at the location.
 */
export function reasonSpecialRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    kind: ActionCardKind,
    spaceId?: SpaceId
): string | undefined {
    const { special } = cardOf(kind)
    const player = state.getPlayerState(playerId)
    const unmet = special.needs
        .map((need) => unmetNeed(player, need, spaceId))
        .find((sentence) => sentence !== undefined)
    return unmet ? `${special.name} needs ${unmet}.` : undefined
}

/** R-3.4 */
export function specialOffered(
    state: HydratedFeudumGameState,
    playerId: string,
    kind: ActionCardKind,
    spaceId?: SpaceId
): boolean {
    return reasonSpecialRefused(state, playerId, kind, spaceId) === undefined
}

export interface CardOffer {
    readonly kind: ActionCardKind
    /** R-3.4 Its need is met. R-3.14.2 Royal Immunity is never played in turn. */
    readonly special: boolean
    /** R-3.13-H1 A last Conquer; R-3.15 a Repeat with nothing to replay. */
    readonly forfeitOnly: boolean
}

export interface RepeatOffer {
    readonly kind: ActionCardKind
    readonly mode: RepeatMode
}

export interface CardPlayOffers {
    readonly cards: readonly CardOffer[]
    readonly repeats: readonly RepeatOffer[]
    /** R-3.3-H1 Whether the next card may declare the second. */
    readonly secondCard: boolean
}

/** R-3.15 x2 by Repeat; any other, for a saltpeter, by Déjà Vu; each kind once. */
function repeatOffers(player: HydratedFeudumPlayerState): RepeatOffer[] {
    const kinds = [...new Set(player.played.map((played) => played.kind))]
    return kinds.flatMap((kind): RepeatOffer[] => {
        const mode = cardOf(kind).symbols.replay === 'x2' ? 'repeat' : 'deja-vu'
        return reasonRepeatRefused(player, kind, mode) ? [] : [{ kind, mode }]
    })
}

/** R-3.2, R-3.4, R-3.13-H1, R-3.15 What the turn player's hand offers before a card is picked. */
export function cardPlayOffers(state: HydratedFeudumGameState, playerId: string): CardPlayOffers {
    const player = state.getPlayerState(playerId)
    const repeats = repeatOffers(player)
    const cards = player.requireHand().map((kind): CardOffer => ({
        kind,
        special: !cardOf(kind).outOfTurn && specialOffered(state, playerId, kind),
        forfeitOnly:
            reasonNotLastRefused(state, playerId, kind) !== undefined ||
            (kind === 'repeat' && repeats.length === 0)
    }))
    return { cards, repeats, secondCard: reasonSecondCardRefused(player) === undefined }
}

/**
 * R-3.2, R-3.3, R-3.15 The card leaves the hand for `played` with its use. Replaying, that card is
 * Repeat and `kind` is what it replays. Sets `flow.turn.secondCard` from this card's declaration:
 * true while a declared second card is owed. Call after the action's reason has passed.
 */
export function playCard(
    state: HydratedFeudumGameState,
    playerId: string,
    kind: ActionCardKind,
    use: PlayedCard['use'],
    input: CardPlayInput = {}
): void {
    const { turn } = state.flow
    assertExists(turn, 'R-3.2 A card is played on a turn')
    const player = state.getPlayerState(playerId)
    const hand = player.requireHand()
    const fromHand = input.asRepeat ? 'repeat' : kind
    hand.splice(hand.indexOf(fromHand), 1)
    player.handCount = hand.length

    if (input.asRepeat) {
        const dejaVu = input.asRepeat === 'deja-vu'
        player.played.push({
            kind: fromHand,
            use,
            replayedKind: kind,
            ...(dejaVu ? { dejaVu } : {})
        })
        player.repeatUsed = true
        if (dejaVu) {
            player.goods.saltpeter -= 1
            returnGoodToHaversack(state, 'saltpeter')
        }
    } else {
        player.played.push({ kind, use })
    }

    turn.secondCard = input.secondCard === true
    if (input.secondCard) {
        player.sequentialUsed = true
    }
}
