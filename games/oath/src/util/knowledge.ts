import { assertExists } from '@tabletop/common'
import type { HydratedOathGameState } from '../model/gameState.js'
import type { HydratedOathPlayerState, KnownPositions } from '../model/playerState.js'
import { Region } from '../model/oathEnums.js'
import { PowerQuestionKind } from '../model/question.js'
import { CONSPIRACY_ID } from '../data/visions.js'
import {
    discardOnto,
    drawFirstVision,
    drawFromDiscard,
    drawFromDiscardBottom,
    drawFromWorldDeck,
    drawRelics,
    mergeDiscardPiles,
    returnRelicToBottom,
    type WorldDeckDraw
} from '../model/vault.js'

export function noKnownDiscardPiles(): Record<Region, KnownPositions> {
    return { [Region.Cradle]: [], [Region.Provinces]: [], [Region.Hinterland]: [] }
}

function worldDeckTopOf(player: HydratedOathPlayerState): string[] {
    assertExists(player.knownWorldDeckTop, 'This operation requires known stacks')
    return player.knownWorldDeckTop
}

function discardPilesOf(player: HydratedOathPlayerState): Record<Region, KnownPositions> {
    assertExists(player.knownDiscardPiles, 'This operation requires known stacks')
    return player.knownDiscardPiles
}

function relicDeckBottomOf(player: HydratedOathPlayerState): KnownPositions {
    assertExists(player.knownRelicDeckBottom, 'This operation requires known stacks')
    return player.knownRelicDeckBottom
}

/** Positions from the bottom: unknown cards above the last known one say nothing. */
function trimTop(known: KnownPositions): KnownPositions {
    let end = known.length
    while (end > 0 && known[end - 1] === null) end -= 1
    return known.slice(0, end)
}

/** Positions ending at the bottom: unknown cards above the first known one say nothing. */
function trimAbove(known: KnownPositions): KnownPositions {
    const first = known.findIndex((cardId) => cardId !== null)
    return first < 0 ? [] : known.slice(first)
}

function unknown(count: number): KnownPositions {
    return Array.from({ length: count }, () => null)
}

/** Oracular Pig — `cardIds` are the top of the world deck, top first. */
export function seeWorldDeckTop(
    state: HydratedOathGameState,
    playerId: string,
    cardIds: readonly string[]
): void {
    const player = state.getPlayerState(playerId)
    player.knownWorldDeckTop = [...cardIds, ...worldDeckTopOf(player).slice(cardIds.length)]
}

/** R-5.1.2 */
export function drawWorldDeck(state: HydratedOathGameState, count: number): WorldDeckDraw {
    const draw = drawFromWorldDeck(state.requireVault(), count)
    for (const player of state.players)
        player.knownWorldDeckTop = worldDeckTopOf(player).slice(draw.drawn.length)
    return draw
}

/** Oracle — the Vision closest to the top; a player who saw it in the top cards saw it go. */
export function drawWorldDeckVision(state: HydratedOathGameState): string | undefined {
    const cardId = drawFirstVision(state.requireVault())
    for (const player of state.players)
        player.knownWorldDeckTop = worldDeckTopOf(player).filter((id) => id !== cardId)
    return cardId
}

/** Who saw a card go onto a pile: everyone at the table, or the one player who knew it. */
export type Witness = 'everyone' | string

/** Before an action moves cards: a card shown to the table is everyone's, a hand or a facedown adviser its holder's. */
export function discardWitnesses(state: HydratedOathGameState): Map<string, Witness> {
    const witnesses = new Map<string, Witness>()
    for (const player of state.players) {
        for (const cardId of player.handIds ?? []) witnesses.set(cardId, player.playerId)
        for (const cardId of player.adviserIds ?? []) witnesses.set(cardId, player.playerId)
    }
    const shown = [
        ...Object.values(state.denizensBySite).flat(),
        ...state.players.flatMap((player) => [
            ...player.faceupAdviserIds(),
            ...(player.revealedVisionId ? [player.revealedVisionId] : [])
        ])
    ]
    for (const question of state.pendingQuestions?.queue ?? []) {
        if (question.kind === PowerQuestionKind.OrderDiscards) shown.push(...question.cardIds)
        if (question.kind === PowerQuestionKind.PlayOrDiscardVision)
            shown.push(question.visionCardId)
        // Inquisitor — the favor it keeps names the Conspiracy it found.
        if (question.kind === PowerQuestionKind.PlayOrDiscardConspiracy) shown.push(CONSPIRACY_ID)
    }
    for (const cardId of shown) witnesses.set(cardId, 'everyone')
    return witnesses
}

/** What the whole table has seen of each pile, and what each player has. */
function pileRecords(state: HydratedOathGameState): Record<Region, KnownPositions>[] {
    return [state.seenDiscardPiles, ...state.players.map(discardPilesOf)]
}

function recordOf(state: HydratedOathGameState, witness: Witness): Record<Region, KnownPositions> {
    return witness === 'everyone'
        ? state.seenDiscardPiles
        : discardPilesOf(state.getPlayerState(witness))
}

function place(
    record: Record<Region, KnownPositions>,
    region: Region,
    fromBottom: number,
    cardId: string
) {
    const known = [
        ...record[region],
        ...unknown(Math.max(0, fromBottom + 1 - record[region].length))
    ]
    known[fromBottom] = cardId
    record[region] = known
}

/** Scryer, Tavern Songs, Brass Horse — `cardIds` are the pile's top cards, top first. */
export function seeDiscardPile(
    state: HydratedOathGameState,
    witness: Witness,
    region: Region,
    cardIds: readonly string[]
): void {
    const size = state.requireVault().discardPiles[region].length
    const record = recordOf(state, witness)
    for (const [fromTop, cardId] of cardIds.entries())
        place(record, region, size - 1 - fromTop, cardId)
    record[region] = trimTop(record[region])
}

/** R-5.1.2, Mushrooms */
export function drawDiscardPile(
    state: HydratedOathGameState,
    region: Region,
    count: number,
    fromBottom: boolean
): string[] {
    const vault = state.requireVault()
    const drawn = fromBottom
        ? drawFromDiscardBottom(vault, region, count)
        : drawFromDiscard(vault, region, count)
    const size = vault.discardPiles[region].length
    for (const record of pileRecords(state))
        record[region] = trimTop(
            fromBottom ? record[region].slice(drawn.length) : record[region].slice(0, size)
        )
    return drawn
}

/** R-10.5 — each card is remembered where it lands by whoever saw it go; cards underneath lift the rest. */
export function putOnDiscardPile(
    state: HydratedOathGameState,
    region: Region,
    cardIds: string[],
    bottom: boolean,
    witnessOf: (cardId: string) => Witness
): void {
    const vault = state.requireVault()
    const size = vault.discardPiles[region].length
    discardOnto(vault, region, cardIds, bottom)
    if (bottom)
        for (const record of pileRecords(state))
            if (record[region].length > 0)
                record[region] = [...unknown(cardIds.length), ...record[region]]
    for (const [index, cardId] of cardIds.entries()) {
        const fromBottom = bottom ? cardIds.length - 1 - index : size + index
        place(recordOf(state, witnessOf(cardId)), region, fromBottom, cardId)
    }
}

/** Convoys — `from` goes on top of `to`. */
export function mergeDiscardPileOnto(state: HydratedOathGameState, from: Region, to: Region): void {
    if (from === to) return
    const vault = state.requireVault()
    const underneath = vault.discardPiles[to].length
    mergeDiscardPiles(vault, from, to)
    for (const record of pileRecords(state)) {
        if (record[from].length > 0)
            record[to] = [
                ...record[to],
                ...unknown(underneath - record[to].length),
                ...record[from]
            ]
        record[from] = []
    }
}

/** R-1.17, R-5.6.2, R-8.6.2 — a draw that reaches a known relic takes it off the known bottom. */
export function drawRelicDeck(state: HydratedOathGameState, count: number): string[] {
    const vault = state.requireVault()
    const drawn = drawRelics(vault, count)
    const remaining = vault.relicDeck.length
    for (const player of state.players) {
        const known = relicDeckBottomOf(player)
        player.knownRelicDeckBottom = trimAbove(known.slice(Math.max(0, known.length - remaining)))
    }
    return drawn
}

/** Every player records the relic sent to the bottom, by name if they know it. */
export function sendRelicToBottom(
    state: HydratedOathGameState,
    relicCardId: string,
    knownBy: 'everyone' | readonly string[]
): void {
    returnRelicToBottom(state.requireVault(), relicCardId)
    for (const player of state.players) {
        const knows =
            knownBy === 'everyone' ||
            knownBy.includes(player.playerId) ||
            hasPeekedAt(player, relicCardId)
        player.knownRelicDeckBottom = trimAbove([
            ...relicDeckBottomOf(player).filter((id) => id !== relicCardId),
            knows ? relicCardId : null
        ])
    }
}

/** R-6.3 — a relic this player saw where it lay. */
function hasPeekedAt(player: HydratedOathPlayerState, relicCardId: string): boolean {
    assertExists(player.peekedRelics, 'This operation requires known peeks')
    return Object.values(player.peekedRelics).includes(relicCardId)
}
