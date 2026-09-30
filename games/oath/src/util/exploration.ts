import { assert, assertExists, shuffle, type RandomFunction } from '@tabletop/common'
import {
    OathGameStateValidator,
    type OathGameState,
    type OathProjectedState
} from '../model/gameState.js'
import type { OathVault } from '../model/vault.js'
import type { KnownPositions, TablePositions } from '../model/playerState.js'
import { CardKind, Region, SetupVariant, Suit } from '../model/oathEnums.js'
import { PowerQuestionKind } from '../model/question.js'
import { cardIdsOfKind, isVision, kindOf, suitOf } from '../data/cardRegistry.js'
import { PLAYTEST_DECK, PLAYTEST_SITES } from '../data/playtestDeck.js'
import { ALL_SITE_IDS } from '../data/sites.js'
import { RELIC_DECK_IDS } from '../data/relics.js'
import {
    CARDS_IN_PLAY,
    DENIZENS_PER_SUIT_IN_PLAY,
    SECOND_PILE_DENIZENS,
    SECOND_PILE_VISIONS,
    TOP_PILE_DENIZENS,
    TOP_PILE_VISIONS,
    TOTAL_VISIONS,
    setupDrawTotal
} from '../data/worldDeck.js'
import { noKnownDiscardPiles } from './knowledge.js'

type ProjectedQuestion = NonNullable<OathProjectedState['pendingQuestions']>['queue'][number]

/** R-8.8 — the top two piles' cards, within which every Vision starts. */
const VISION_REACH =
    TOP_PILE_DENIZENS + TOP_PILE_VISIONS + SECOND_PILE_DENIZENS + SECOND_PILE_VISIONS

/**
 * R-9.4 — a complete state in which every card the input names stays where it is, and every card
 * it does not name is dealt afresh from `random`, consistent with the public counts and backs.
 */
export function populateHiddenCards(
    input: OathProjectedState,
    random: RandomFunction
): OathGameState {
    const state = structuredClone(input)
    const questions = [...(state.pendingQuestions?.queue ?? []), ...(state.heldTurn?.queue ?? [])]
    const world = dealWorldCards(state, questions, random)
    const relics = dealRelics(state, questions, random)
    const sites = dealSites(state, random)
    const vault: OathVault = {
        worldDeck: world.worldDeck,
        discardPiles: world.discardPiles,
        siteFacedown: sites.siteFacedown,
        relicFacedown: relics.relicFacedown,
        relicDeck: relics.relicDeck,
        siteDeck: sites.siteDeck,
        dispossessed: []
    }
    const adviserIdsOf = (playerId: string) => {
        const dealt = world.advisers.get(playerId)
        return dealt
            ? dealt.map(dealtCard)
            : required(state.players.find((p) => p.playerId === playerId)?.adviserIds)
    }
    const result = {
        ...state,
        vault,
        players: state.players.map((player) => ({
            ...player,
            handIds: world.hands.get(player.playerId) ?? required(player.handIds),
            adviserIds: adviserIdsOf(player.playerId),
            advisers: player.advisers.map((row, index) =>
                !row.faceUp && (row.shownTo ?? []).length > 0
                    ? { ...row, shownCardId: adviserIdsOf(player.playerId)[index] }
                    : row
            ),
            peekedRelics:
                player.peekedRelics ?? seenAtSlots(player.peekedRelicSlotIds, vault.relicFacedown),
            peekedSites:
                player.peekedSites ?? seenAtSlots(player.peekedSiteSlotIds, vault.siteFacedown),
            knownWorldDeckTop: player.knownWorldDeckTop ?? [],
            knownDiscardPiles: player.knownDiscardPiles ?? noKnownDiscardPiles(),
            knownWorldDeckBottom: player.knownWorldDeckBottom ?? [],
            knownRelicDeckBottom: player.knownRelicDeckBottom ?? []
        }))
    }
    for (const question of questions) {
        if (
            (question.kind === PowerQuestionKind.KeepOrBottomRelic ||
                question.kind === PowerQuestionKind.BottomRelic) &&
            question.relicCardId === undefined
        )
            question.relicCardId = relics.drawnForQuestions.pop()
        if (question.kind === PowerQuestionKind.TakeOrLeaveRelic)
            question.relicCardId ??= vault.relicFacedown[question.slotId]
        if (question.kind === PowerQuestionKind.OrderDrawnCards)
            question.cardIds ??= world.drawnForQuestions.splice(0, question.cardCount)
    }
    assert(
        OathGameStateValidator.Check(result),
        'Exploration did not produce a complete Oath state'
    )
    return result
}

function dealtCard(cardId: string | undefined): string {
    assertExists(cardId, 'Exploration left a hidden place empty')
    return cardId
}

function required(ids: string[] | undefined): string[] {
    assertExists(ids, 'A card list known to the explorer is missing')
    return ids
}

/** R-6.3, Ivory Eye — a player who peeked at a slot saw what lies there. */
function seenAtSlots(slotIds: readonly string[], facedown: Record<string, string>) {
    return Object.fromEntries(
        slotIds.flatMap((slotId) => (facedown[slotId] ? [[slotId, facedown[slotId]]] : []))
    )
}

interface Slot {
    fill: (cardId: string) => void
    kind?: CardKind
}

/** Fills the slots that need a card back first, then the rest, from a shuffled pool. */
function fillSlots(slots: Slot[], pool: string[]) {
    assert(
        slots.length === pool.length,
        'Exploration dealt a different number of cards than it had slots'
    )
    const byKind = slots.filter((slot) => slot.kind !== undefined)
    for (const slot of byKind) {
        const index = pool.findIndex((cardId) => kindOf(cardId) === slot.kind)
        assert(index >= 0, `No hidden card with a ${slot.kind} back is left for a public back`)
        slot.fill(pool.splice(index, 1)[0])
    }
    for (const slot of slots.filter((slot) => slot.kind === undefined)) {
        const cardId = pool.shift()
        assertExists(cardId, 'Exploration ran out of hidden cards')
        slot.fill(cardId)
    }
}

/** Every player's known positions of one stack, merged; two players never disagree on a position. */
/**
 * Later lists win: a player's own record follows moves the table's cannot (Oracle's Vision, taken from
 * a place only its drawer knew), so where the two differ the player's is the newer. A card it displaces
 * goes back to the hidden cards.
 */
function mergedPositions(lists: readonly KnownPositions[]): KnownPositions {
    const merged: KnownPositions = []
    for (const list of lists)
        for (const [index, cardId] of list.entries()) if (cardId !== null) merged[index] = cardId
    return Array.from(merged, (cardId) => cardId ?? null)
}

/**
 * A stack's remembered positions from its bottom. Each card the table or a player named stays, unless
 * the explorer knows it is somewhere else now. Each place in a set the table saw holds one of its
 * cards not placed elsewhere, dealt in an order the explorer never saw; the set's other cards have
 * left the stack, so they go back to the hidden cards. `taken` collects every card placed so far.
 */
function rememberedPositions(
    table: TablePositions,
    lists: readonly KnownPositions[],
    random: RandomFunction,
    taken: Set<string>,
    top?: { fromBottom: number; back: CardKind | undefined }
): { positions: (string | null)[]; leftovers: string[] } {
    const free = (cardId: string | null) => (cardId !== null && !taken.has(cardId) ? cardId : null)
    const named = mergedPositions([
        table.map((entry) => (typeof entry === 'string' ? free(entry) : null)),
        ...lists.map((list) => list.map(free))
    ])
    const positions: (string | null)[] = Array.from(
        { length: Math.max(named.length, table.length) },
        (_, index) => named[index] ?? null
    )
    for (const cardId of positions) if (cardId !== null) taken.add(cardId)
    const sets = new Map<string, { among: string[]; at: number[] }>()
    for (const [index, entry] of table.entries()) {
        if (entry === null || typeof entry === 'string' || positions[index] !== null) continue
        const key = entry.among.join(',')
        const set = sets.get(key) ?? { among: entry.among, at: [] }
        set.at.push(index)
        sets.set(key, set)
    }
    const leftovers: string[] = []
    for (const { among, at } of sets.values()) {
        const left = shuffled(
            among.filter((cardId) => !taken.has(cardId)),
            random
        )
        // R-9.4 — the pile's top back is public, so the card dealt on top shows it.
        if (top?.back !== undefined && at.includes(top.fromBottom)) {
            const showing = left.findIndex((cardId) => kindOf(cardId) === top.back)
            if (showing >= 0) {
                positions[top.fromBottom] = left.splice(showing, 1)[0]
                at.splice(at.indexOf(top.fromBottom), 1)
            }
        }
        for (const [index, position] of at.entries())
            if (index < left.length) positions[position] = left[index]
        for (const cardId of left.slice(0, at.length)) taken.add(cardId)
        leftovers.push(...left.slice(at.length))
    }
    for (const cardId of positions) if (cardId !== null) taken.add(cardId)
    return { positions, leftovers }
}

function namedWorldCards(
    state: OathProjectedState,
    questions: readonly ProjectedQuestion[]
): Set<string> {
    const named = new Set<string>([...Object.values(state.denizensBySite).flat(), ...state.boxIds])
    for (const player of state.players) {
        for (const row of player.advisers) {
            if (row.cardId) named.add(row.cardId)
            if (row.shownCardId) named.add(row.shownCardId)
        }
        for (const cardId of [...(player.adviserIds ?? []), ...(player.handIds ?? [])])
            named.add(cardId)
        if (player.revealedVisionId) named.add(player.revealedVisionId)
        for (const cardId of player.knownWorldDeckTop ?? []) named.add(cardId)
    }
    for (const question of questions) {
        if (question.kind === PowerQuestionKind.OrderDiscards)
            for (const cardId of question.cardIds) named.add(cardId)
        if (question.kind === PowerQuestionKind.PlayOrDiscardVision)
            named.add(question.visionCardId)
        if (question.kind === PowerQuestionKind.OrderDrawnCards)
            for (const cardId of question.cardIds ?? []) named.add(cardId)
    }
    return named
}

/** R-1.21 — the Curated deck, or nine denizens of each suit, some of which the table has not seen. */
function unnamedWorldCards(
    state: OathProjectedState,
    named: ReadonlySet<string>,
    random: RandomFunction
): { visions: string[]; denizens: string[] } {
    const visions = cardIdsOfKind(CardKind.Vision).filter((cardId) => !named.has(cardId))
    const denizens =
        state.setupVariant === SetupVariant.Curated
            ? PLAYTEST_DECK.filter((cardId) => !named.has(cardId))
            : Object.values(Suit).flatMap((suit) => {
                  const ofSuit = cardIdsOfKind(CardKind.Denizen).filter(
                      (cardId) => suitOf(cardId) === suit
                  )
                  const inPlay = ofSuit.filter((cardId) => named.has(cardId)).length
                  assert(
                      inPlay <= DENIZENS_PER_SUIT_IN_PLAY,
                      `More than ${DENIZENS_PER_SUIT_IN_PLAY} ${suit} denizens are in play`
                  )
                  const unseen = ofSuit.filter((cardId) => !named.has(cardId))
                  shuffle(unseen, random)
                  return unseen.slice(0, DENIZENS_PER_SUIT_IN_PLAY - inPlay)
              })
    shuffle(visions, random)
    shuffle(denizens, random)
    return { visions, denizens }
}

function dealWorldCards(
    state: OathProjectedState,
    questions: readonly ProjectedQuestion[],
    random: RandomFunction
) {
    // What the explorer knows lies elsewhere comes first; the stacks' records then place what is left.
    const taken = namedWorldCards(state, questions)
    const leftovers: string[] = []
    const remembered = (
        table: TablePositions,
        lists: readonly KnownPositions[],
        top?: { fromBottom: number; back: CardKind | undefined }
    ) => {
        const recalled = rememberedPositions(table, lists, random, taken, top)
        leftovers.push(...recalled.leftovers)
        return recalled.positions
    }
    const recalledPiles = new Map(
        Object.values(Region).map((region) => [
            region,
            remembered(
                state.seenDiscardPiles[region],
                state.players.map((player) => player.knownDiscardPiles?.[region] ?? []),
                {
                    fromBottom: state.discardPileCounts[region] - 1,
                    back: state.discardTopBackType[region]
                }
            )
        ])
    )
    const recalledBottom = remembered(
        state.seenWorldDeckBottom,
        state.players.map((player) => player.knownWorldDeckBottom ?? [])
    )
    const returned = [...new Set(leftovers)].filter((cardId) => !taken.has(cardId))
    const { visions, denizens } = unnamedWorldCards(state, new Set([...taken, ...returned]), random)
    visions.push(...returned.filter(isVision))
    denizens.push(...returned.filter((cardId) => !isVision(cardId)))
    shuffle(visions, random)
    shuffle(denizens, random)
    const hands = new Map<string, string[]>()
    const advisers = new Map<string, (string | undefined)[]>()
    const drawnForQuestions: string[] = []
    const slots: Slot[] = []

    for (const player of state.players) {
        if (player.handIds === undefined) {
            const hand: string[] = []
            hands.set(player.playerId, hand)
            for (let i = 0; i < player.handCount; i++)
                slots.push({ fill: (cardId) => hand.push(cardId) })
        }
        if (player.adviserIds === undefined) {
            const ids = player.advisers.map((row) => row.cardId ?? row.shownCardId)
            advisers.set(player.playerId, ids)
            for (const [index, cardId] of ids.entries())
                if (cardId === undefined) slots.push({ fill: (dealt) => (ids[index] = dealt) })
        }
    }
    for (const question of questions)
        if (question.kind === PowerQuestionKind.OrderDrawnCards && question.cardIds === undefined)
            for (let i = 0; i < question.cardCount; i++)
                slots.push({ fill: (cardId) => drawnForQuestions.push(cardId) })

    const piles = new Map<Region, (string | undefined)[]>()
    for (const region of Object.values(Region)) {
        const count = state.discardPileCounts[region]
        const known = recalledPiles.get(region) ?? []
        assert(known.length <= count, `More of the ${region} pile is known than it holds`)
        const pile = Array.from(
            { length: count },
            (_, fromTop) => known[count - 1 - fromTop] ?? undefined
        )
        piles.set(region, pile)
        for (const [fromTop, cardId] of pile.entries())
            if (cardId === undefined)
                slots.push({
                    fill: (dealt) => (pile[fromTop] = dealt),
                    kind: fromTop === 0 ? state.discardTopBackType[region] : undefined
                })
    }

    // Cracked Horn — the cards known under the deck, bottom first; an unknown one among them is dealt.
    const bottom = recalledBottom.map((cardId) => cardId ?? undefined)
    for (const [index, cardId] of bottom.entries())
        if (cardId === undefined) slots.push({ fill: (dealt) => (bottom[index] = dealt) })

    // R-2.7.1 — every Vision drawn so far moved the track, so the rest are still in the deck.
    const knownTop = longestTop(state.players.map((player) => player.knownWorldDeckTop ?? []))
    const deckUnknown = visions.length + denizens.length - slots.length
    assert(deckUnknown >= 0, 'The hidden cards cannot fill every hidden place')
    const size = knownTop.length + deckUnknown + bottom.length
    assert(
        (size === 0) === state.worldDeckExhausted,
        'The world deck’s size disagrees with whether it is exhausted'
    )
    const visionsInDeck = Math.min(
        visions.length,
        deckUnknown,
        Math.max(
            0,
            TOTAL_VISIONS - state.visionsDrawn - knownTop.filter(isVision).length,
            knownTop.length === 0 && state.topCardBackType === CardKind.Vision ? 1 : 0
        )
    )
    const deckVisions = visions.splice(0, visionsInDeck)
    const deckDenizens = denizens.splice(0, deckUnknown - visionsInDeck)
    fillSlots(slots, shuffled([...visions, ...denizens], random))
    const pileOf = (region: Region) => (piles.get(region) ?? []).map(dealtCard)
    const discardPiles = {
        [Region.Cradle]: pileOf(Region.Cradle),
        [Region.Provinces]: pileOf(Region.Provinces),
        [Region.Hinterland]: pileOf(Region.Hinterland)
    }

    const topMustBeVision = knownTop.length === 0 && state.topCardBackType === CardKind.Vision
    const topMustBeDenizen = knownTop.length === 0 && state.topCardBackType === CardKind.Denizen
    const first = knownTop.length + (topMustBeDenizen ? 1 : 0)
    const drawnFromTop = Math.max(0, CARDS_IN_PLAY - setupDrawTotal(state.players.length) - size)
    const reach = Math.min(
        size - bottom.length,
        Math.max(VISION_REACH - drawnFromTop, first + visionsInDeck)
    )
    const open = Array.from({ length: Math.max(0, reach - first) }, (_, i) => first + i)
    shuffle(open, random)
    const at = topMustBeVision ? [first, ...open.filter((position) => position !== first)] : open
    const visionPositions = at.slice(0, visionsInDeck).sort((a, b) => a - b)
    assert(
        visionPositions.length === visionsInDeck,
        'R-8.8 leaves no room for the Visions still in the deck'
    )
    const worldDeck = [...knownTop, ...deckDenizens]
    for (const [index, position] of visionPositions.entries())
        worldDeck.splice(position, 0, deckVisions[index])
    worldDeck.push(...bottom.map(dealtCard).reverse())
    return { worldDeck, discardPiles, hands, advisers, drawnForQuestions }
}

function longestTop(lists: readonly string[][]): string[] {
    const longest = lists.reduce((a, b) => (b.length > a.length ? b : a), [])
    for (const list of lists)
        assert(
            list.every((cardId, index) => longest[index] === cardId),
            'Two players remember different tops of the world deck'
        )
    return [...longest]
}

function shuffled(cards: string[], random: RandomFunction): string[] {
    shuffle(cards, random)
    return cards
}

function dealRelics(
    state: OathProjectedState,
    questions: readonly ProjectedQuestion[],
    random: RandomFunction
) {
    const liveSlots = [...Object.values(state.relicsBySite).flat(), ...state.reliquary].map(
        (slot) => slot.slotId
    )
    const relicFacedown: Record<string, string> = {}
    for (const player of state.players)
        for (const [slotId, relicCardId] of Object.entries(player.peekedRelics ?? {}))
            if (liveSlots.includes(slotId)) relicFacedown[slotId] = relicCardId
    for (const question of questions)
        if (question.kind === PowerQuestionKind.TakeOrLeaveRelic && question.relicCardId)
            relicFacedown[question.slotId] = question.relicCardId

    const knownBottom = mergedPositions(
        state.players.map((player) => [...(player.knownRelicDeckBottom ?? [])].reverse())
    ).reverse()
    const named = new Set<string>([
        ...state.players.flatMap((player) => player.relicIds),
        ...Object.values(relicFacedown),
        ...knownBottom.flatMap((cardId) => (cardId === null ? [] : [cardId]))
    ])
    for (const question of questions)
        if (
            (question.kind === PowerQuestionKind.KeepOrBottomRelic ||
                question.kind === PowerQuestionKind.BottomRelic) &&
            question.relicCardId
        )
            named.add(question.relicCardId)

    const pool = shuffled(
        RELIC_DECK_IDS.filter((cardId) => !named.has(cardId)),
        random
    )
    for (const slotId of liveSlots) {
        if (relicFacedown[slotId]) continue
        const relicCardId = pool.shift()
        assertExists(relicCardId, `No relic is left for ${slotId}`)
        relicFacedown[slotId] = relicCardId
    }
    const drawnForQuestions: string[] = []
    for (const question of questions)
        if (
            (question.kind === PowerQuestionKind.KeepOrBottomRelic ||
                question.kind === PowerQuestionKind.BottomRelic) &&
            question.relicCardId === undefined
        ) {
            const relicCardId = pool.shift()
            assertExists(relicCardId, 'No relic is left for a question')
            drawnForQuestions.push(relicCardId)
        }
    const unknownAbove = pool.length - knownBottom.filter((cardId) => cardId === null).length
    assert(unknownAbove >= 0, 'More of the relic deck is known than it holds')
    const relicDeck = [
        ...pool.splice(0, unknownAbove),
        ...knownBottom.map((cardId) => {
            if (cardId !== null) return cardId
            const dealt = pool.shift()
            assertExists(dealt, 'The relic deck ran short')
            return dealt
        })
    ]
    return { relicFacedown, relicDeck, drawnForQuestions }
}

function dealSites(state: OathProjectedState, random: RandomFunction) {
    const facedownSlots = Object.values(state.map)
        .flat()
        .filter((slotId) => state.siteCards[slotId] === undefined)
    const siteFacedown: Record<string, string> = {}
    for (const player of state.players)
        for (const [slotId, siteCardId] of Object.entries(player.peekedSites ?? {}))
            if (facedownSlots.includes(slotId)) siteFacedown[slotId] = siteCardId
    const named = new Set([...Object.values(state.siteCards), ...Object.values(siteFacedown)])
    const pool = shuffled(
        (state.setupVariant === SetupVariant.Curated ? PLAYTEST_SITES : ALL_SITE_IDS).filter(
            (siteCardId) => !named.has(siteCardId)
        ),
        random
    )
    for (const slotId of facedownSlots) {
        if (siteFacedown[slotId]) continue
        const siteCardId = pool.shift()
        assertExists(siteCardId, `No site is left for ${slotId}`)
        siteFacedown[slotId] = siteCardId
    }
    return { siteFacedown, siteDeck: pool }
}
