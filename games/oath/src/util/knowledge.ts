import { assertExists } from '@tabletop/common'
import type { HydratedOathGameState } from '../model/gameState.js'
import type { HydratedOathPlayerState, KnownPositions } from '../model/playerState.js'
import { Region } from '../model/oathEnums.js'
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

/** Scryer, Tavern Songs — `cardIds` are the pile's top cards, top first. */
export function seeDiscardPile(
    state: HydratedOathGameState,
    playerId: string,
    region: Region,
    cardIds: readonly string[]
): void {
    const size = state.requireVault().discardPiles[region].length
    const piles = discardPilesOf(state.getPlayerState(playerId))
    const known = [...piles[region], ...unknown(Math.max(0, size - piles[region].length))]
    for (const [fromTop, cardId] of cardIds.entries()) known[size - 1 - fromTop] = cardId
    piles[region] = trimTop(known)
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
    for (const player of state.players) {
        const piles = discardPilesOf(player)
        piles[region] = trimTop(
            fromBottom ? piles[region].slice(drawn.length) : piles[region].slice(0, size)
        )
    }
    return drawn
}

/** R-10.5 — cards on top leave every known position where it was; cards underneath lift them. */
export function putOnDiscardPile(
    state: HydratedOathGameState,
    region: Region,
    cardIds: string[],
    bottom: boolean
): void {
    discardOnto(state.requireVault(), region, cardIds, bottom)
    if (!bottom) return
    for (const player of state.players) {
        const piles = discardPilesOf(player)
        if (piles[region].length > 0) piles[region] = [...unknown(cardIds.length), ...piles[region]]
    }
}

/** Convoys — `from` goes on top of `to`. */
export function mergeDiscardPileOnto(state: HydratedOathGameState, from: Region, to: Region): void {
    if (from === to) return
    const vault = state.requireVault()
    const underneath = vault.discardPiles[to].length
    mergeDiscardPiles(vault, from, to)
    for (const player of state.players) {
        const piles = discardPilesOf(player)
        if (piles[from].length > 0)
            piles[to] = [...piles[to], ...unknown(underneath - piles[to].length), ...piles[from]]
        piles[from] = []
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
