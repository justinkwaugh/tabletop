import { assertExists } from '@tabletop/common'
import type { HydratedOathGameState } from '../model/gameState.js'
import type {
    HydratedOathPlayerState,
    KnownPositions,
    TablePositions
} from '../model/playerState.js'
import { isVision } from '../data/cardRegistry.js'
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
    putUnderWorldDeck,
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

function worldDeckBottomOf(player: HydratedOathPlayerState): KnownPositions {
    assertExists(player.knownWorldDeckBottom, 'This operation requires known stacks')
    return player.knownWorldDeckBottom
}

function relicDeckBottomOf(player: HydratedOathPlayerState): KnownPositions {
    assertExists(player.knownRelicDeckBottom, 'This operation requires known stacks')
    return player.knownRelicDeckBottom
}

/** Positions from the bottom: unknown cards above the last known one say nothing. */
function trimTop<T>(known: readonly (T | null)[]): (T | null)[] {
    let end = known.length
    while (end > 0 && known[end - 1] === null) end -= 1
    return known.slice(0, end)
}

/** Positions ending at the bottom: unknown cards above the first known one say nothing. */
function trimAbove(known: KnownPositions): KnownPositions {
    const first = known.findIndex((cardId) => cardId !== null)
    return first < 0 ? [] : known.slice(first)
}

function unknown(count: number): null[] {
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

/** R-5.1.2 — a draw that reaches the cards known under the deck takes them off its known bottom. */
export function drawWorldDeck(state: HydratedOathGameState, count: number): WorldDeckDraw {
    const vault = state.requireVault()
    const draw = drawFromWorldDeck(vault, count)
    for (const player of state.players)
        player.knownWorldDeckTop = worldDeckTopOf(player).slice(draw.drawn.length)
    const size = vault.worldDeck.length
    for (const holder of worldDeckBottomRecords(state))
        holder.set(trimTop(holder.get().slice(0, size)))
    return draw
}

/** Oracle — the Vision closest to the top; a player who saw it in the top cards saw it go. */
export function drawWorldDeckVision(state: HydratedOathGameState): string | undefined {
    const vault = state.requireVault()
    const at = vault.worldDeck.findIndex(isVision)
    const fromBottom = vault.worldDeck.length - 1 - at
    const cardId = drawFirstVision(vault)
    for (const player of state.players)
        player.knownWorldDeckTop = worldDeckTopOf(player).filter((id) => id !== cardId)
    if (cardId !== undefined)
        for (const holder of worldDeckBottomRecords(state)) {
            const known = holder.get()
            if (fromBottom < known.length)
                holder.set(trimTop(withoutCard(known.toSpliced(fromBottom, 1), cardId)))
        }
    return cardId
}

/** Who saw a card go onto a stack: everyone at the table, or the one player who knew it. */
export type Witness = 'everyone' | string

/** Who could see each card before an action moved it; with `holders`, also each hand's and facedown adviser's holder. */
export interface DiscardWitnesses {
    byCard: ReadonlyMap<string, Witness>
    holders: boolean
}

/** What the table shows, read from public state alone, so a projection can take it too. */
export function tableWitnesses(state: HydratedOathGameState): DiscardWitnesses {
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
    return { byCard: new Map(shown.map((cardId) => [cardId, 'everyone'])), holders: false }
}

/** On the host: the table's cards, and every hand card and facedown adviser as its holder's. */
export function discardWitnesses(state: HydratedOathGameState): DiscardWitnesses {
    const byCard = new Map<string, Witness>()
    for (const player of state.players)
        for (const cardId of [...player.knownHand(), ...player.facedownAdviserIds()])
            byCard.set(cardId, player.playerId)
    for (const [cardId, witness] of tableWitnesses(state).byCard) byCard.set(cardId, witness)
    return { byCard, holders: true }
}

interface RecordHolder {
    get(): TablePositions
    set(positions: TablePositions): void
}

/** What the whole table has seen of each pile, and what each player has. */
function pileRecords(state: HydratedOathGameState, region: Region): RecordHolder[] {
    return [
        {
            get: () => state.seenDiscardPiles[region],
            set: (positions) => (state.seenDiscardPiles[region] = positions)
        },
        ...state.players.map((player) => {
            const piles = discardPilesOf(player)
            return {
                get: () => piles[region],
                set: (positions: TablePositions) => (piles[region] = cardsOnly(positions))
            }
        })
    ]
}

function worldDeckBottomRecords(state: HydratedOathGameState): RecordHolder[] {
    return [
        {
            get: () => state.seenWorldDeckBottom,
            set: (positions) => (state.seenWorldDeckBottom = positions)
        },
        ...state.players.map((player) => ({
            get: () => worldDeckBottomOf(player),
            set: (positions: TablePositions) => (player.knownWorldDeckBottom = cardsOnly(positions))
        }))
    ]
}

function pileRecordOf(
    state: HydratedOathGameState,
    region: Region,
    witness: Witness
): RecordHolder {
    const [table, ...players] = pileRecords(state, region)
    if (witness === 'everyone') return table
    return players[state.players.findIndex((player) => player.playerId === witness)]
}

function worldDeckBottomRecordOf(state: HydratedOathGameState, witness: Witness): RecordHolder {
    const [table, ...players] = worldDeckBottomRecords(state)
    if (witness === 'everyone') return table
    return players[state.players.findIndex((player) => player.playerId === witness)]
}

/** A player remembers cards, never a set; a set only ever reaches the table's record. */
function cardsOnly(positions: TablePositions): KnownPositions {
    return positions.map((entry) => (typeof entry === 'string' ? entry : null))
}

function withoutCard(positions: TablePositions, cardId: string): TablePositions {
    return positions.map((entry) =>
        entry !== null && typeof entry === 'object'
            ? { among: entry.among.filter((id) => id !== cardId) }
            : entry
    )
}

function placed(positions: TablePositions, fromBottom: number, entry: TablePositions[number]) {
    const known = [...positions, ...unknown(Math.max(0, fromBottom + 1 - positions.length))]
    known[fromBottom] = entry
    return known
}

/** Scryer, Tavern Songs, Brass Horse — `cardIds` are the pile's top cards, top first. */
export function seeDiscardPile(
    state: HydratedOathGameState,
    witness: Witness,
    region: Region,
    cardIds: readonly string[]
): void {
    const size = state.requireVault().discardPiles[region].length
    const record = pileRecordOf(state, region, witness)
    let known = record.get()
    for (const [fromTop, cardId] of cardIds.entries())
        known = placed(known, size - 1 - fromTop, cardId)
    record.set(trimTop(known))
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
    for (const record of pileRecords(state, region))
        record.set(
            trimTop(fromBottom ? record.get().slice(drawn.length) : record.get().slice(0, size))
        )
    return drawn
}

/**
 * Who remembers each card put on a stack: its witness by name, and the table as one of `shownAsSet`
 * when it saw the cards but not their order (Truthful Harp). A card with no witness is remembered
 * by no one.
 */
export interface Deposit {
    witnessOf: (cardId: string) => Witness | undefined
    shownAsSet?: ReadonlySet<string>
}

function remember(
    table: RecordHolder,
    recordFor: (witness: Witness) => RecordHolder,
    cardIds: readonly string[],
    positionOf: (index: number) => number,
    deposit: Deposit
) {
    const set = cardIds.filter((cardId) => deposit.shownAsSet?.has(cardId))
    for (const [index, cardId] of cardIds.entries()) {
        const witness = deposit.witnessOf(cardId)
        if (witness !== undefined) {
            const record = recordFor(witness)
            record.set(placed(record.get(), positionOf(index), cardId))
        }
        if (witness !== 'everyone' && set.includes(cardId))
            table.set(placed(table.get(), positionOf(index), { among: set }))
    }
}

/** R-10.5 — cards on top keep every known position; cards underneath lift them. */
export function putOnDiscardPile(
    state: HydratedOathGameState,
    region: Region,
    cardIds: string[],
    bottom: boolean,
    deposit: Deposit
): void {
    const vault = state.requireVault()
    const size = vault.discardPiles[region].length
    discardOnto(vault, region, cardIds, bottom)
    if (bottom)
        for (const record of pileRecords(state, region))
            if (record.get().length > 0) record.set([...unknown(cardIds.length), ...record.get()])
    remember(
        pileRecords(state, region)[0],
        (witness) => pileRecordOf(state, region, witness),
        cardIds,
        (index) => (bottom ? cardIds.length - 1 - index : size + index),
        deposit
    )
}

/** Cracked Horn — under the world deck, in the order given, so the last lies at the bottom. */
export function putUnderWorldDeckKnown(
    state: HydratedOathGameState,
    cardIds: string[],
    deposit: Deposit
): void {
    putUnderWorldDeck(state.requireVault(), cardIds)
    for (const record of worldDeckBottomRecords(state))
        if (record.get().length > 0) record.set([...unknown(cardIds.length), ...record.get()])
    remember(
        worldDeckBottomRecords(state)[0],
        (witness) => worldDeckBottomRecordOf(state, witness),
        cardIds,
        (index) => cardIds.length - 1 - index,
        deposit
    )
}

/** Convoys — `from` goes on top of `to`. */
export function mergeDiscardPileOnto(state: HydratedOathGameState, from: Region, to: Region): void {
    if (from === to) return
    const vault = state.requireVault()
    const underneath = vault.discardPiles[to].length
    mergeDiscardPiles(vault, from, to)
    const fromRecords = pileRecords(state, from)
    for (const [index, record] of pileRecords(state, to).entries()) {
        const moved = fromRecords[index].get()
        if (moved.length > 0)
            record.set([...record.get(), ...unknown(underneath - record.get().length), ...moved])
        fromRecords[index].set([])
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
