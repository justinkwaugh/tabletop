import { assertExists } from '@tabletop/common'
import type { HydratedOathGameState } from '../model/gameState.js'
import type {
    HandPositions,
    HydratedOathPlayerState,
    KnownPositions,
    TablePositions
} from '../model/playerState.js'
import { CardKind, Region } from '../model/oathEnums.js'
import { PowerQuestionKind } from '../model/question.js'
import type { HiddenReveal } from '../model/hidden.js'
import { isVision, kindOf } from '../data/cardRegistry.js'
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

export function noKnownDiscardPiles(): Record<Region, TablePositions> {
    return { [Region.Cradle]: [], [Region.Provinces]: [], [Region.Hinterland]: [] }
}

function worldDeckTopOf(player: HydratedOathPlayerState): string[] {
    assertExists(player.knownWorldDeckTop, 'This operation requires known stacks')
    return player.knownWorldDeckTop
}

function discardPilesOf(player: HydratedOathPlayerState): Record<Region, TablePositions> {
    assertExists(player.knownDiscardPiles, 'This operation requires known stacks')
    return player.knownDiscardPiles
}

function worldDeckBottomOf(player: HydratedOathPlayerState): TablePositions {
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

/**
 * R-5.1.2 — whoever knew a card drawn now knows it is in the drawer's hand; a draw that reaches the
 * cards known under the deck takes them off its known bottom.
 */
export function drawWorldDeck(
    state: HydratedOathGameState,
    count: number,
    drawerId: string
): WorldDeckDraw {
    const vault = state.requireVault()
    const before = vault.worldDeck.length
    const draw = drawFromWorldDeck(vault, count)
    state.worldDeckDrawn += draw.drawn.length
    state.worldDeckVisions -= draw.drawn.filter(isVision).length
    for (const player of state.players) {
        const top = worldDeckTopOf(player)
        intoHand(state, player.playerId, drawerId, top.slice(0, draw.drawn.length))
        player.knownWorldDeckTop = top.slice(draw.drawn.length)
    }
    const size = vault.worldDeck.length
    for (const holder of worldDeckBottomRecords(state)) {
        intoHand(state, holder.witness, drawerId, holder.get().slice(size, before))
        holder.set(trimTop(holder.get().slice(0, size)))
    }
    return draw
}

/**
 * Oracle — the Vision closest to the top. A player who saw it among the top cards saw it go. Its
 * place is private, so no record of what lies under the deck moves but its drawer's, who saw where
 * it lay and now holds it.
 */
export function drawWorldDeckVision(
    state: HydratedOathGameState,
    playerId: string
): string | undefined {
    // R-9.4 — when every Vision left lies under the deck where the table saw its back go, the one
    // closest to the top is the highest of them, which everyone can tell; otherwise it lay above.
    const visionsUnder = state.seenWorldDeckBottom.flatMap((entry, at) =>
        backOf(entry) === CardKind.Vision ? [at] : []
    )
    const fromUnder =
        visionsUnder.length > 0 && visionsUnder.length === state.worldDeckVisions
            ? visionsUnder[visionsUnder.length - 1]
            : undefined
    const cardId = drawFirstVision(state.requireVault())
    if (cardId !== undefined) {
        state.worldDeckVisions -= 1
        // R-8.8 — one from above the known bottom lay within reach of the top.
        if (fromUnder === undefined) state.worldDeckDrawn += 1
    }
    if (fromUnder !== undefined)
        for (const holder of worldDeckBottomRecords(state)) {
            const known = holder.get()
            if (fromUnder >= known.length) continue
            intoHand(state, holder.witness, playerId, [known[fromUnder]])
            holder.set(trimTop(known.toSpliced(fromUnder, 1)))
        }
    for (const player of state.players) {
        const top = worldDeckTopOf(player)
        if (cardId !== undefined && top.includes(cardId))
            intoHand(state, player.playerId, playerId, [cardId])
        player.knownWorldDeckTop = top.filter((id) => id !== cardId)
    }
    const drawer = state.getPlayerState(playerId)
    const known = worldDeckBottomOf(drawer)
    const at = cardId === undefined ? -1 : known.indexOf(cardId)
    if (at >= 0) drawer.knownWorldDeckBottom = known.toSpliced(at, 1)
    return cardId
}

export const EVERYONE = 'everyone'

/** Who saw a card go onto a stack: everyone at the table, or the one player who knew it. */
export type Witness = typeof EVERYONE | string

/**
 * Who could see each card before an action moved it: `byCard` knew the card and will see where it
 * lands; `setsByCard` (a facedown adviser's viewers) and `handSetsByCard` (a hand card's) knew the
 * card but not its place among the others moved with it. With `holders`, also each hand's and
 * facedown adviser's holder.
 */
export interface DiscardWitnesses {
    byCard: ReadonlyMap<string, readonly Witness[]>
    setsByCard: ReadonlyMap<string, readonly Witness[]>
    handSetsByCard: ReadonlyMap<string, readonly Witness[]>
    holders: boolean
    /** Pilgrimage — cards the table knows as a set, but not in their order. */
    sets: ReadonlySet<string>
    /** A relic question's drawn relic, and who already knew it. */
    relics: ReadonlyMap<string, readonly Witness[]>
}

/** What the table shows, read from public state alone, so a projection can take it too. */
export function tableWitnesses(state: HydratedOathGameState): DiscardWitnesses {
    const shown = [
        ...Object.values(state.denizensBySite).flat(),
        ...state.players.flatMap((player) => [
            ...player.faceupAdviserIds(),
            // Truthful Harp, False Prophet — a facedown card the table saw go down.
            ...player.advisers.flatMap((row) =>
                row.seen && row.shownCardId !== undefined ? [row.shownCardId] : []
            ),
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
    const sets = new Set<string>()
    for (const question of state.pendingQuestions?.queue ?? [])
        if (question.kind === PowerQuestionKind.OrderDrawnCards)
            for (const cardId of question.among ?? []) sets.add(cardId)
    const relics = new Map<string, readonly Witness[]>()
    for (const question of state.pendingQuestions?.queue ?? [])
        if (
            (question.kind === PowerQuestionKind.KeepOrBottomRelic ||
                question.kind === PowerQuestionKind.BottomRelic) &&
            question.relicCardId !== undefined &&
            question.seenBy !== undefined
        )
            relics.set(question.relicCardId, question.seenBy)
    return {
        byCard: new Map(shown.map((cardId) => [cardId, ['everyone']])),
        setsByCard: new Map(),
        handSetsByCard: new Map(),
        holders: false,
        sets,
        relics
    }
}

/**
 * On the host: the table's cards, every hand card and facedown adviser as its holder's, and those
 * others knew too (a hand card the table or a player saw drawn, an adviser shown), who will know it
 * is among the cards moved but not where.
 */
export function discardWitnesses(state: HydratedOathGameState): DiscardWitnesses {
    const byCard = new Map<string, readonly Witness[]>()
    const setsByCard = new Map<string, Witness[]>()
    const handSetsByCard = new Map<string, Witness[]>()
    const alsoKnows = (sets: Map<string, Witness[]>, cardId: string, witness: Witness) =>
        sets.set(cardId, [...(sets.get(cardId) ?? []), witness])
    for (const player of state.players) {
        for (const cardId of [...player.knownHand(), ...player.facedownAdviserIds()])
            byCard.set(cardId, [player.playerId])
        for (const entry of player.handSeen)
            if (typeof entry === 'string') alsoKnows(handSetsByCard, entry, 'everyone')
        for (const other of state.players) {
            if (other.playerId === player.playerId) continue
            for (const entry of knownHandsOf(other)[player.playerId] ?? [])
                if (typeof entry === 'string') alsoKnows(handSetsByCard, entry, other.playerId)
        }
        // R-9.4 — whoever was shown a facedown adviser knows it when it goes.
        for (const [index, row] of player.advisers.entries())
            if (!row.faceUp)
                for (const viewer of row.shownTo ?? [])
                    alsoKnows(setsByCard, player.knownAdviserIds()[index], viewer)
    }
    const table = tableWitnesses(state)
    for (const [cardId, witnesses] of table.byCard) byCard.set(cardId, witnesses)
    return {
        byCard,
        setsByCard,
        handSetsByCard,
        holders: true,
        sets: table.sets,
        relics: table.relics
    }
}

function knownHandsOf(player: HydratedOathPlayerState): Record<string, HandPositions> {
    assertExists(player.knownHands, 'This operation requires known hands')
    return player.knownHands
}

/** Cards `witness` knew in a stack, now in `drawerId`'s hand: the drawer needs no record of their own. */
function intoHand(
    state: HydratedOathGameState,
    witness: Witness,
    drawerId: string,
    entries: TablePositions
): void {
    if (witness === drawerId) return
    const known = entries.flatMap((entry): HandPositions => {
        if (entry === null) return []
        if (typeof entry === 'string') return [entry]
        return 'among' in entry ? [{ among: entry.among }] : []
    })
    if (known.length === 0) return
    if (witness === 'everyone') {
        const drawer = state.getPlayerState(drawerId)
        drawer.handSeen = [...drawer.handSeen, ...known]
        return
    }
    const hands = knownHandsOf(state.getPlayerState(witness))
    hands[drawerId] = [...(hands[drawerId] ?? []), ...known]
}

/** A hand emptied: what anyone knew it held has gone where the action that emptied it put it. */
export function forgetHand(state: HydratedOathGameState, playerId: string): void {
    state.getPlayerState(playerId).handSeen = []
    for (const player of state.players) delete knownHandsOf(player)[playerId]
}

interface RecordHolder {
    witness: Witness
    get(): TablePositions
    set(positions: TablePositions): void
}

/** What the whole table has seen of each pile, and what each player has. */
function pileRecords(state: HydratedOathGameState, region: Region): RecordHolder[] {
    return [
        {
            witness: 'everyone',
            get: () => state.seenDiscardPiles[region],
            set: (positions) => (state.seenDiscardPiles[region] = positions)
        },
        ...state.players.map((player) => {
            const piles = discardPilesOf(player)
            return {
                witness: player.playerId,
                get: () => piles[region],
                set: (positions: TablePositions) => (piles[region] = withoutBacks(positions))
            }
        })
    ]
}

function worldDeckBottomRecords(state: HydratedOathGameState): RecordHolder[] {
    return [
        {
            witness: 'everyone',
            get: () => state.seenWorldDeckBottom,
            set: (positions) => (state.seenWorldDeckBottom = positions)
        },
        ...state.players.map((player) => ({
            witness: player.playerId,
            get: () => worldDeckBottomOf(player),
            set: (positions: TablePositions) =>
                (player.knownWorldDeckBottom = withoutBacks(positions))
        }))
    ]
}

function recordOf(records: RecordHolder[], witness: Witness): RecordHolder {
    const record = records.find((holder) => holder.witness === witness)
    assertExists(record, `${witness} is no witness at this table`)
    return record
}

function pileRecordOf(
    state: HydratedOathGameState,
    region: Region,
    witness: Witness
): RecordHolder {
    return recordOf(pileRecords(state, region), witness)
}

function worldDeckBottomRecordOf(state: HydratedOathGameState, witness: Witness): RecordHolder {
    return recordOf(worldDeckBottomRecords(state), witness)
}

function backOfCard(cardId: string): CardKind {
    const back = kindOf(cardId)
    assertExists(back, `${cardId} is no registered card`)
    return back
}

/** R-9.4 — the back a record entry shows, where it shows one. */
export function backOf(entry: TablePositions[number]): CardKind | undefined {
    if (entry === null) return undefined
    if (typeof entry === 'string') return kindOf(entry)
    return entry.back
}

/** A player remembers cards and sets; backs are the table's, which everyone reads. */
function withoutBacks(positions: TablePositions): TablePositions {
    return positions.map((entry) => {
        if (entry === null || typeof entry === 'string') return entry
        return 'among' in entry ? { among: entry.among } : null
    })
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

/** R-5.1.2, Mushrooms — whoever knew a card drawn now knows it is in the drawer's hand. */
export function drawDiscardPile(
    state: HydratedOathGameState,
    region: Region,
    count: number,
    fromBottom: boolean,
    drawerId: string
): string[] {
    const vault = state.requireVault()
    const before = vault.discardPiles[region].length
    const drawn = fromBottom
        ? drawFromDiscardBottom(vault, region, count)
        : drawFromDiscard(vault, region, count)
    const size = vault.discardPiles[region].length
    for (const record of pileRecords(state, region)) {
        const known = record.get()
        const taken = fromBottom ? known.slice(0, drawn.length) : known.slice(size, before)
        intoHand(state, record.witness, drawerId, taken)
        record.set(trimTop(fromBottom ? known.slice(drawn.length) : known.slice(0, size)))
    }
    return drawn
}

/**
 * Who remembers each card put on a stack: `witnessOf` names those who see where it lands, and
 * `setWitnessesOf` those who know it is among the cards put there but not where (Truthful Harp,
 * Pilgrimage, a hand or adviser others knew). The table always sees each back.
 */
export interface Deposit {
    witnessOf: (cardId: string) => readonly Witness[]
    setWitnessesOf?: (cardId: string) => readonly Witness[]
}

function remember(
    recordFor: (witness: Witness) => RecordHolder,
    cardIds: readonly string[],
    positionOf: (index: number) => number,
    deposit: Deposit
) {
    const exactly = (cardId: string) => deposit.witnessOf(cardId)
    const asSet = (cardId: string) =>
        (deposit.setWitnessesOf?.(cardId) ?? []).filter(
            (witness) => !exactly(cardId).includes(witness)
        )
    // Sorted: the order the cards went down is their player's alone.
    const setFor = (witness: Witness) =>
        cardIds.filter((cardId) => asSet(cardId).includes(witness)).toSorted()
    // HIDDEN-011 — a set may lie at any place of the deposit not known exactly whose back one of its
    // cards shows, so where it lies says nothing of the order.
    const setAt = (witness: Witness, cardId: string) => {
        if (exactly(cardId).includes(witness)) return undefined
        const among = setFor(witness)
        const back = backOfCard(cardId)
        return among.some((member) => backOfCard(member) === back) ? among : undefined
    }
    const setWitnesses = new Set(cardIds.flatMap(asSet))
    for (const [index, cardId] of cardIds.entries()) {
        const at = positionOf(index)
        for (const witness of exactly(cardId)) {
            const record = recordFor(witness)
            record.set(placed(record.get(), at, cardId))
        }
        for (const witness of setWitnesses) {
            const among = witness === 'everyone' ? undefined : setAt(witness, cardId)
            if (among === undefined) continue
            const record = recordFor(witness)
            record.set(placed(record.get(), at, { among }))
        }
        // R-9.4 — the table saw every back go down, and each place a set it knew may lie at.
        if (!exactly(cardId).includes('everyone')) {
            const table = recordFor('everyone')
            const back = backOfCard(cardId)
            const among = setWitnesses.has('everyone') ? setAt('everyone', cardId) : undefined
            table.set(placed(table.get(), at, among ? { among, back } : { back }))
        }
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
    state.worldDeckVisions += cardIds.filter(isVision).length
    for (const record of worldDeckBottomRecords(state))
        if (record.get().length > 0) record.set([...unknown(cardIds.length), ...record.get()])
    remember(
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
export function drawRelicDeck(
    state: HydratedOathGameState,
    count: number
): { relicCardIds: string[]; seenBy: Witness[][] } {
    const vault = state.requireVault()
    const drawn = drawRelics(vault, count)
    const remaining = vault.relicDeck.length
    // A relic drawn off a known bottom stays known to whoever knew it there.
    const seenBy = drawn.map((relicCardId): Witness[] =>
        state.seenRelicDeckBottom.includes(relicCardId)
            ? ['everyone']
            : state.players
                  .filter((player) => relicDeckBottomOf(player).includes(relicCardId))
                  .map((player) => player.playerId)
    )
    const trim = (known: KnownPositions) =>
        trimAbove(known.slice(Math.max(0, known.length - remaining)))
    state.seenRelicDeckBottom = trim(state.seenRelicDeckBottom)
    for (const player of state.players)
        player.knownRelicDeckBottom = trim(relicDeckBottomOf(player))
    return { relicCardIds: drawn, seenBy }
}

/** A relic question names who already knew the relic drawn for it. */
export function knownDraw(reveal: HiddenReveal | undefined): { seenBy?: string[] } {
    const seenBy = reveal?.kind === 'relics' ? reveal.seenBy?.[0] : undefined
    return seenBy !== undefined && seenBy.length > 0 ? { seenBy } : {}
}

/** A relic a site flip drew onto `slotId`: whoever knew it knows it there, without a peek (R-6.3). */
export function rememberRelicAt(
    state: HydratedOathGameState,
    slotId: string,
    relicCardId: string,
    seenBy: readonly Witness[]
): void {
    if (seenBy.includes('everyone'))
        state.seenRelics = { ...state.seenRelics, [slotId]: relicCardId }
    for (const player of state.players)
        if (seenBy.includes(player.playerId)) {
            assertExists(player.peekedRelics, 'This operation requires known peeks')
            player.peekedRelics[slotId] = relicCardId
        }
}

/**
 * Every player records the relic sent to the bottom, by name if they know it; a relic the table knew
 * where it lay, or at its old place under the deck, the table knows here too.
 */
export function sendRelicToBottom(
    state: HydratedOathGameState,
    relicCardId: string,
    knownBy: 'everyone' | readonly Witness[]
): void {
    returnRelicToBottom(state.requireVault(), relicCardId)
    const everyone =
        knownBy === 'everyone' ||
        knownBy.includes('everyone') ||
        Object.values(state.seenRelics).includes(relicCardId)
    const record = (known: KnownPositions, knows: boolean) =>
        trimAbove([...known.filter((id) => id !== relicCardId), knows ? relicCardId : null])
    state.seenRelicDeckBottom = record(state.seenRelicDeckBottom, everyone)
    for (const player of state.players)
        player.knownRelicDeckBottom = record(
            relicDeckBottomOf(player),
            everyone || knownBy.includes(player.playerId) || hasPeekedAt(player, relicCardId)
        )
    leaveSlots(state, relicCardId)
}

/** A relic that left its slot: no record keeps it there. */
function leaveSlots(state: HydratedOathGameState, relicCardId: string): void {
    const without = (slots: Record<string, string>) =>
        Object.fromEntries(Object.entries(slots).filter(([, cardId]) => cardId !== relicCardId))
    state.seenRelics = without(state.seenRelics)
    for (const player of state.players)
        if (player.peekedRelics !== undefined) player.peekedRelics = without(player.peekedRelics)
}

/** R-6.3 — a relic this player saw where it lay. */
function hasPeekedAt(player: HydratedOathPlayerState, relicCardId: string): boolean {
    assertExists(player.peekedRelics, 'This operation requires known peeks')
    return Object.values(player.peekedRelics).includes(relicCardId)
}
