import { describe, expect, it } from 'vitest'
import { assert, getPrng, type Game, type Visibility } from '@tabletop/common'
import { engine } from '../testing/engine.js'
import { buildAction } from '../testing/actions.js'
import { waitingGame } from '../testing/game.js'
import { OathRuntime } from './runtime.js'
import { MachineState } from './states.js'
import { HydratedOathGameState, OathGameStateValidator, type OathGameState } from '../model/gameState.js'
import { CardKind, Region, SetupVariant } from '../model/oathEnums.js'
import { PowerQuestionKind } from '../model/question.js'
import { cardDefinition, kindOf } from '../data/cardRegistry.js'
import { CARDS_IN_PLAY } from '../data/worldDeck.js'
import { RELIC_DECK_IDS } from '../data/relics.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { TOP_CRADLE_SLOT } from '../data/mapSlots.js'
import { SetupChoice } from '../actions/setupChoice.js'
import { ResolveWake } from '../actions/resolveWake.js'
import { Search, SearchSource } from '../actions/search.js'
import { SearchPlay, SearchResolve } from '../actions/searchResolve.js'
import { UseActionPower } from '../actions/useActionPower.js'
import { AnswerQuestion } from '../actions/answerQuestion.js'
import { EndActPhase } from '../actions/endActPhase.js'
import { modifierUse } from '../testing/choices.js'
import { drawDiscardPile } from '../util/knowledge.js'

// R-9.4 — a player or spectator explores from what they know; everything else is dealt afresh.
const MASTER_SEED = '0123456789abcdef0123456789abcdef'
const DOWSING_STICKS = 'relic.dowsing-sticks'
const ORACULAR_PIG = 'relic.oracular-pig'
const BRASS_HORSE = 'relic.brass-horse'
const TRUTHFUL_HARP = 'relic.truthful-harp'
const CRACKED_HORN = 'relic.cracked-horn'
const PILGRIMAGE = 'denizen.nomad.pilgrimage'

function canonical(state: unknown): OathGameState {
    assert(OathGameStateValidator.Check(state), 'Expected complete canonical state')
    return state
}

/** R-1.23, R-4.1 — setup played through, and the Chancellor into their first Act Phase. */
function started(setupVariant: SetupVariant) {
    const game = waitingGame(3, { setupVariant })
    let state = engine.startGame(game, { masterSeed: MASTER_SEED }).initialState
    while (state.machineState === MachineState.Setup) {
        const hydrated = new HydratedOathGameState(state)
        const [playerId] = state.activePlayerIds
        const hand = hydrated.getPlayerState(playerId).knownHand()
        state = engine.runNext(buildAction(SetupChoice, {
            playerId,
            siteId: playerId === state.chancellorPlayerId ? TOP_CRADLE_SLOT : hydrated.faceupSiteIds()[1],
            adviserCardId: hand[0],
            discardOrder: hand.slice(1)
        }), state, game).updatedState
    }
    const [chancellor] = state.activePlayerIds
    if (state.machineState === MachineState.WakePhase)
        state = engine.runNext(buildAction(ResolveWake, { playerId: chancellor, favorSteps: [] }), state, game).updatedState
    return { game, state: canonical(state), chancellor }
}

/** A relic from the vault into `playerId`'s hand of relics, keeping every card where the vault had it otherwise. */
function giveRelic(state: OathGameState, playerId: string, relicCardId: string): OathGameState {
    const next = structuredClone(state)
    const vault = next.vault
    const slot = Object.keys(vault.relicFacedown).find((slotId) => vault.relicFacedown[slotId] === relicCardId)
    if (slot) {
        const [replacement] = vault.relicDeck.splice(0, 1, relicCardId)
        vault.relicFacedown[slot] = replacement
        for (const player of next.players) if (player.peekedRelics[slot]) player.peekedRelics[slot] = replacement
    }
    vault.relicDeck = vault.relicDeck.filter((id) => id !== relicCardId)
    const holder = next.players.find((player) => player.playerId === playerId)
    assert(holder !== undefined, 'the holder sits at the table')
    holder.relicIds.push(relicCardId)
    return canonical(next)
}

function usePower(game: Game, state: OathGameState, playerId: string, cardId: string) {
    return canonical(engine.runNext(buildAction(UseActionPower, {
        playerId,
        cardId,
        powerIndex: powerIndexOf(cardId, PowerTiming.Action)
    }), state, game).updatedState)
}

function explore(game: Game, state: OathGameState, perspective: Visibility.Perspective, seed = 1): OathGameState {
    const projected = OathRuntime.visibility.state.project(state, perspective, { config: game.config })
    const exploration = OathRuntime.exploration
    assert(exploration.createFromProjectedState !== undefined, 'Oath populates projected state')
    return canonical(exploration.createFromProjectedState({
        game,
        state: projected,
        actions: [],
        perspective,
        random: getPrng(seed)
    }))
}

function worldCards(state: OathGameState): string[] {
    return [
        ...state.vault.worldDeck,
        ...Object.values(state.vault.discardPiles).flat(),
        ...state.vault.dispossessed,
        ...Object.values(state.denizensBySite).flat(),
        ...state.boxIds,
        ...state.players.flatMap((player) => [
            ...player.handIds,
            ...player.adviserIds,
            ...(player.revealedVisionId ? [player.revealedVisionId] : [])
        ]),
        ...(state.pendingQuestions?.queue ?? []).flatMap((question) =>
            question.kind === PowerQuestionKind.OrderDrawnCards ? question.cardIds : []
        )
    ].sort()
}

function relics(state: OathGameState): string[] {
    return [
        ...state.vault.relicDeck,
        ...Object.values(state.vault.relicFacedown),
        ...state.players.flatMap((player) => player.relicIds),
        ...(state.pendingQuestions?.queue ?? []).flatMap((question) =>
            question.kind === PowerQuestionKind.KeepOrBottomRelic ? [question.relicCardId] : []
        )
    ].sort()
}

function sites(state: OathGameState): string[] {
    return [...Object.values(state.siteCards), ...Object.values(state.vault.siteFacedown), ...state.vault.siteDeck].sort()
}

const perspectives = (state: OathGameState): Visibility.Perspective[] => [
    ...state.players.map((player) => ({ kind: 'player', playerId: player.playerId }) as const),
    { kind: 'spectator' }
]

/** Every hidden place holds as many cards as the source's, and every card is somewhere exactly once. */
function expectConserved(source: OathGameState, branch: OathGameState, setupVariant: SetupVariant) {
    expect(branch.vault.worldDeck).toHaveLength(source.vault.worldDeck.length)
    for (const region of Object.values(Region))
        expect(branch.vault.discardPiles[region]).toHaveLength(source.vault.discardPiles[region].length)
    expect(branch.vault.relicDeck).toHaveLength(source.vault.relicDeck.length)
    expect(Object.keys(branch.vault.relicFacedown).sort()).toEqual(Object.keys(source.vault.relicFacedown).sort())
    expect(Object.keys(branch.vault.siteFacedown).sort()).toEqual(Object.keys(source.vault.siteFacedown).sort())
    expect(branch.vault.siteDeck).toHaveLength(source.vault.siteDeck.length)
    const world = worldCards(branch)
    expect(world).toHaveLength(CARDS_IN_PLAY)
    expect(new Set(world).size).toBe(CARDS_IN_PLAY)
    if (setupVariant === SetupVariant.Curated) expect(world).toEqual(worldCards(source))
    expect(relics(branch)).toEqual(relics(source))
    expect(sites(branch)).toEqual(sites(source))
    expect(RELIC_DECK_IDS.every((id) => relics(branch).includes(id))).toBe(true)
}

/** What the explorer knows, and what the table shows, is the same in the branch. */
function expectKnownKept(source: OathGameState, branch: OathGameState, perspective: Visibility.Perspective) {
    expect(branch.denizensBySite).toEqual(source.denizensBySite)
    expect(branch.siteCards).toEqual(source.siteCards)
    expect(branch.discardPileCounts).toEqual(source.discardPileCounts)
    expect(branch.worldDeckExhausted).toBe(source.worldDeckExhausted)
    expect(kindOf(branch.vault.worldDeck[0])).toBe(source.topCardBackType)
    for (const region of Object.values(Region))
        if (source.discardPileCounts[region] > 0)
            expect(kindOf(branch.vault.discardPiles[region][0])).toBe(source.discardTopBackType[region])
    // Every pile position the table or the explorer remembers holds the card they saw there.
    const explorer = source.players.find((player) => perspective.kind === 'player' && player.playerId === perspective.playerId)
    for (const region of Object.values(Region)) {
        const size = source.discardPileCounts[region]
        for (const known of [source.seenDiscardPiles[region], explorer?.knownDiscardPiles[region] ?? []])
            for (const [fromBottom, entry] of known.entries()) {
                const dealt = branch.vault.discardPiles[region][size - 1 - fromBottom]
                if (typeof entry === 'string') expect(dealt).toBe(entry)
                else if (entry !== null) expect(entry.among).toContain(dealt)
            }
    }
    const deck = branch.vault.worldDeck
    for (const known of [source.seenWorldDeckBottom, explorer?.knownWorldDeckBottom ?? []])
        for (const [fromBottom, entry] of known.entries()) {
            const dealt = deck[deck.length - 1 - fromBottom]
            if (typeof entry === 'string') expect(dealt).toBe(entry)
            else if (entry !== null) expect(entry.among).toContain(dealt)
        }
    for (const [index, player] of source.players.entries()) {
        // R-9.4 — every held card and facedown adviser keeps the back the table sees.
        expect(branch.players[index].handIds.filter((id) => kindOf(id) === CardKind.Vision)).toHaveLength(player.handVisions)
        expect(branch.players[index].advisers.map((row) => row.vision === true)).toEqual(player.advisers.map((row) => row.vision === true))
        for (const [row, cardId] of branch.players[index].adviserIds.entries())
            if (!player.advisers[row].faceUp)
                expect(kindOf(cardId) === CardKind.Vision).toBe(player.advisers[row].vision === true)
        expect(branch.players[index].advisers.map((row) => row.faceUp)).toEqual(player.advisers.map((row) => row.faceUp))
        expect(branch.players[index].handIds).toHaveLength(player.handIds.length)
        if (perspective.kind !== 'player' || perspective.playerId !== player.playerId) continue
        expect(branch.players[index]).toMatchObject({
            handIds: player.handIds,
            adviserIds: player.adviserIds,
            peekedRelics: player.peekedRelics,
            peekedSites: player.peekedSites,
            knownWorldDeckTop: player.knownWorldDeckTop,
            knownDiscardPiles: player.knownDiscardPiles,
            knownRelicDeckBottom: player.knownRelicDeckBottom
        })
        expect(branch.vault.worldDeck.slice(0, player.knownWorldDeckTop.length)).toEqual(player.knownWorldDeckTop)
        for (const [slotId, relicCardId] of Object.entries(player.peekedRelics))
            if (branch.vault.relicFacedown[slotId]) expect(branch.vault.relicFacedown[slotId]).toBe(relicCardId)
    }
}

function expectExplorable(game: Game, source: OathGameState, setupVariant: SetupVariant) {
    for (const perspective of perspectives(source)) {
        const branch = explore(game, source, perspective)
        expectConserved(source, branch, setupVariant)
        expectKnownKept(source, branch, perspective)
        expect(() => OathRuntime.hydrator.hydrateState(branch)).not.toThrow()
        expect(explore(game, source, perspective)).toEqual(branch)
        expect(explore(game, source, perspective, 2).vault).not.toEqual(branch.vault)
    }
}

describe.each([SetupVariant.Curated, SetupVariant.Randomized])('Exploration from a projection, %s deck', (setupVariant) => {
    it('at the first Act Phase: complete, conserved, and fixed where the explorer knows', () => {
        const { game, state } = started(setupVariant)
        expectExplorable(game, state, setupVariant)
    })

    it('mid-Search, with the drawn cards in the searcher’s hand', () => {
        const { game, state, chancellor } = started(setupVariant)
        const searching = canonical(engine.runNext(buildAction(Search, {
            playerId: chancellor,
            drawFrom: SearchSource.WorldDeck,
            revealsInfo: true
        }), state, game).updatedState)
        expect(searching.machineState).toBe(MachineState.Searching)
        const searcher = searching.players.find((player) => player.playerId === chancellor)
        expect(searcher?.handVisions).toBe(searcher?.handIds.filter((id) => kindOf(id) === CardKind.Vision).length)
        expectExplorable(game, searching, setupVariant)
    })

    it('after a Search whose cards went to a discard pile', () => {
        const { game, state, chancellor } = started(setupVariant)
        const searching = canonical(engine.runNext(buildAction(Search, {
            playerId: chancellor,
            drawFrom: SearchSource.WorldDeck,
            revealsInfo: true
        }), state, game).updatedState)
        const hand = new HydratedOathGameState(searching).getPlayerState(chancellor).knownHand()
        const resolved = canonical(engine.runNext(buildAction(SearchResolve, {
            playerId: chancellor,
            keptCardId: hand[0],
            discardOrder: hand.slice(1),
            play: SearchPlay.Discard
        }), searching, game).updatedState)
        expect(Object.values(resolved.discardPileCounts).reduce((a, b) => a + b, 0)).toBeGreaterThan(
            Object.values(state.discardPileCounts).reduce((a, b) => a + b, 0)
        )
        const searcher = resolved.players.find((player) => player.playerId === chancellor)
        expect(Object.values(searcher?.knownDiscardPiles ?? {}).flat().filter((id) => id !== null)).toEqual(expect.arrayContaining(hand.slice(1)))
        expectExplorable(game, resolved, setupVariant)
    })

    it('after a Truthful Harp Search, whose discards the table saw but not their order', () => {
        const { game, state, chancellor } = started(setupVariant)
        const harped = giveRelic(state, chancellor, TRUTHFUL_HARP)
        const searching = canonical(engine.runNext(buildAction(Search, {
            playerId: chancellor,
            drawFrom: SearchSource.WorldDeck,
            revealsInfo: true,
            modifiers: [modifierUse(TRUTHFUL_HARP)]
        }), harped, game).updatedState)
        const hand = new HydratedOathGameState(searching).getPlayerState(chancellor).knownHand()
        const resolved = canonical(engine.runNext(buildAction(SearchResolve, {
            playerId: chancellor,
            keptCardId: hand[0],
            discardOrder: hand.slice(1),
            play: SearchPlay.Discard
        }), searching, game).updatedState)
        const sets = Object.values(resolved.seenDiscardPiles).flat().filter((entry) => entry !== null && typeof entry === 'object')
        expect(sets.length).toBe(hand.length)
        expectExplorable(game, resolved, setupVariant)

        // A later draw takes part of the set: another player now holds one of its cards, unseen.
        const drawing = new HydratedOathGameState(structuredClone(resolved))
        const region = Object.values(Region).find((r) => resolved.seenDiscardPiles[r].some((entry) => entry !== null && typeof entry === 'object'))
        assert(region !== undefined, 'the Harp set lies on a pile')
        const other = drawing.players.find((player) => player.playerId !== chancellor)
        assert(other !== undefined, 'another player sits at the table')
        const drawn = drawDiscardPile(drawing, region, 1, false)
        other.setHand([...other.knownHand(), ...drawn])
        // R-9.4 — as a Search's draw does, the public count and top back follow the pile.
        const [newTop] = drawing.requireVault().discardPiles[region]
        drawing.discardPileCounts[region] -= drawn.length
        drawing.discardTopBackType = { ...drawing.discardTopBackType, [region]: newTop === undefined ? undefined : kindOf(newTop) }
        expectExplorable(game, canonical(drawing.dehydrate()), setupVariant)
    })

    it.each([
        { harp: false, table: 0 },
        { harp: true, table: 1 }
    ])('after a Cracked Horn Search sends the discards under the world deck (Truthful Harp: $harp)', ({ harp, table }) => {
        const { game, state, chancellor } = started(setupVariant)
        const relics = harp ? [CRACKED_HORN, TRUTHFUL_HARP] : [CRACKED_HORN]
        const holding = relics.reduce((current, relic) => giveRelic(current, chancellor, relic), state)
        const searching = canonical(engine.runNext(buildAction(Search, {
            playerId: chancellor,
            drawFrom: SearchSource.WorldDeck,
            revealsInfo: true,
            modifiers: relics.map((relic) => modifierUse(relic))
        }), holding, game).updatedState)
        const hand = new HydratedOathGameState(searching).getPlayerState(chancellor).knownHand()
        const resolved = canonical(engine.runNext(buildAction(SearchResolve, {
            playerId: chancellor,
            keptCardId: hand[0],
            discardOrder: hand.slice(1),
            play: SearchPlay.Discard
        }), searching, game).updatedState)
        const searcher = resolved.players.find((player) => player.playerId === chancellor)
        // Played as a discard, the kept card goes under with the rest.
        expect(searcher?.knownWorldDeckBottom.toSorted()).toEqual(hand.toSorted())
        expect(resolved.seenWorldDeckBottom.length > 0 ? 1 : 0).toBe(table)
        expectExplorable(game, resolved, setupVariant)
    })

    it('after Brass Horse reveals the top of a discard pile to the table', () => {
        const { game, state, chancellor } = started(setupVariant)
        const revealed = usePower(game, giveRelic(state, chancellor, BRASS_HORSE), chancellor, BRASS_HORSE)
        const seen = Object.values(revealed.seenDiscardPiles).flat().filter((id) => id !== null)
        expect(seen).toHaveLength(1)
        expectExplorable(game, revealed, setupVariant)
    })

    it('after Oracular Pig’s peek, with the relic Dowsing Sticks drew waiting on its question', () => {
        const { game, state, chancellor } = started(setupVariant)
        let current = giveRelic(giveRelic(state, chancellor, ORACULAR_PIG), chancellor, DOWSING_STICKS)
        current = usePower(game, current, chancellor, ORACULAR_PIG)
        const seer = current.players.find((player) => player.playerId === chancellor)
        expect(seer?.knownWorldDeckTop).toHaveLength(3)
        current = usePower(game, current, chancellor, DOWSING_STICKS)
        expect(current.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.KeepOrBottomRelic, askedPlayerId: chancellor })
        expectExplorable(game, current, setupVariant)
        const other = current.players.find((player) => player.playerId !== chancellor)?.playerId
        assert(other !== undefined, 'another player sits at the table')
        const branch = explore(game, current, { kind: 'player', playerId: other })
        expect(branch.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.KeepOrBottomRelic })
    })

    it('an action applies in the branch', () => {
        const { game, state, chancellor } = started(setupVariant)
        const branch = explore(game, state, { kind: 'player', playerId: chancellor })
        const result = engine.runNext(buildAction(EndActPhase, { playerId: chancellor }), branch, game)
        expect(result.updatedState.machineState).not.toBe(MachineState.ActPhase)
    })
})

// Pilgrimage is not in the Curated deck, so its case runs on a random one.
describe('Exploration from a projection, around Pilgrimage', () => {
    it('with a Pilgrimage waiting on its order, and after the cards are stacked', () => {
        const setupVariant = SetupVariant.Randomized
        const { game, state, chancellor } = started(setupVariant)
        const staged = structuredClone(state)
        const deck = staged.vault.worldDeck
        // R-1.21 — nine nomads are in play: Pilgrimage takes the place of one deep in the deck, unless it is there already.
        if (!worldCards(staged).includes(PILGRIMAGE))
            deck.splice(deck.findLastIndex((id) => id.startsWith('denizen.nomad.')), 1, PILGRIMAGE)
        expect(deck).toContain(PILGRIMAGE)
        // Pilgrimage on top, a denizen back as before; two denizens from deep in the deck at the Chancellor's site.
        const movable = (id: string) => kindOf(id) === CardKind.Denizen && id !== PILGRIMAGE && !cardDefinition(id)?.locked
        const moved = [0, 1].map(() => deck.splice(deck.findLastIndex(movable), 1)[0])
        deck.splice(deck.indexOf(PILGRIMAGE), 1)
        deck.unshift(PILGRIMAGE)
        const siteId = staged.players.find((player) => player.playerId === chancellor)?.siteId
        assert(siteId !== undefined, 'the Chancellor has a pawn on the map')
        staged.denizensBySite[siteId] = [...(staged.denizensBySite[siteId] ?? []), ...moved]
        const searching = canonical(engine.runNext(buildAction(Search, { playerId: chancellor, drawFrom: SearchSource.WorldDeck, revealsInfo: true }), canonical(staged), game).updatedState)
        const hand = new HydratedOathGameState(searching).getPlayerState(chancellor).knownHand()
        expect(hand).toContain(PILGRIMAGE)
        const resolvedRun = engine.runNext(buildAction(SearchResolve, {
            playerId: chancellor,
            keptCardId: PILGRIMAGE,
            discardOrder: hand.filter((id) => id !== PILGRIMAGE),
            play: SearchPlay.Adviser,
            faceUp: true
        }), searching, game)
        const waiting = canonical(resolvedRun.updatedState)
        const question = waiting.pendingQuestions?.queue[0]
        assert(question?.kind === PowerQuestionKind.OrderDrawnCards, 'Pilgrimage waits on the order of its cards')
        expect(question.among).toEqual(question.cardIds.toSorted())
        expectExplorable(game, waiting, setupVariant)
        for (const perspective of perspectives(waiting)) {
            const branch = explore(game, waiting, perspective)
            const dealt = branch.pendingQuestions?.queue[0]
            assert(dealt?.kind === PowerQuestionKind.OrderDrawnCards, 'the branch keeps the question')
            expect(dealt.cardIds.toSorted()).toEqual(question.among)
        }
        const stacked = canonical(engine.runNext(buildAction(AnswerQuestion, {
            playerId: chancellor,
            answer: { kind: PowerQuestionKind.OrderDrawnCards, order: question.cardIds.map((_, index) => index) }
        }), waiting, game).updatedState)
        expect(Object.values(stacked.seenDiscardPiles).flat().filter((entry) => entry !== null && typeof entry === 'object')).toHaveLength(question.cardIds.length)
        expectExplorable(game, stacked, setupVariant)
    })
})

describe('the branch depends only on what the explorer may know', () => {
    it('two sources that differ only in hidden cards give the same branch for one seed', () => {
        const { game, state, chancellor } = started(SetupVariant.Curated)
        const deck = state.vault.worldDeck
        const [a, b] = [20, 30]
        expect(kindOf(deck[a])).toBe(CardKind.Denizen)
        expect(kindOf(deck[b])).toBe(CardKind.Denizen)
        const swapped = structuredClone(state)
        ;[swapped.vault.worldDeck[a], swapped.vault.worldDeck[b]] = [deck[b], deck[a]]
        for (const perspective of perspectives(state))
            expect(explore(game, swapped, perspective)).toEqual(explore(game, state, perspective))
        expect(swapped.vault.worldDeck).not.toEqual(state.vault.worldDeck)
        expect(chancellor).toBe(state.chancellorPlayerId)
    })
})
