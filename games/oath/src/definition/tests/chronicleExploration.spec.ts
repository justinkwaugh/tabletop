import { beforeAll, describe, expect, it } from 'vitest'
import { assert, assertExists, getPrng, type Visibility } from '@tabletop/common'
import { OathGameExploration } from '../gameExploration.js'
import { HydratedOathGameState, type OathProjectedState } from '../../model/gameState.js'
import { CardKind, Region, Suit } from '../../model/oathEnums.js'
import { ChronicleStep } from '../../model/chronicle.js'
import { WinKind } from '../../model/ending.js'
import {
    PRINTED_DENIZENS_BY_SUIT,
    PRINTED_DENIZEN_IDS,
    isVision,
    kindOf,
    suitOf
} from '../../data/cardRegistry.js'
import { BuildOrRepairEdifice } from '../../actions/buildOrRepairEdifice.js'
import { chronicleSuitLeaders, edificeChoices } from '../../util/chronicleChoices.js'
import { rulesSite } from '../../util/rule.js'
import { buildAction } from '../../testing/actions.js'
import { plainestChronicleAnswer, wonTable } from '../../testing/chronicle.js'
import { vaultOf } from '../../testing/engine.js'
import { served, spectator } from '../../testing/projection.js'
import {
    playStep,
    playUntil,
    type LocalGameStore,
    type LocalPlay
} from '../../testing/localGames.js'
import { MachineState } from '../states.js'
import {
    continueGameOne,
    playGameOne,
    playedToTheEnd,
    setUp,
    type PlayedToTheEnd
} from '../../testing/rehearsal.js'
import '../../powers/index.js'

// R-9.4 — a seat or a spectator explores the Chronicle phase from what it is served: the hidden
// cards are the world as it stands at the step being written. A first game holds nine denizens of
// each suit and each chronicle's 3/2/1 adds its suits (R-1.21, R-8.4); R-8.5 moves six to the
// Dispossessed, still in the game; a heal (R-8.4.a) returns the Dispossessed to the Archive.

const SEEDS = [1, 2]

/** Where the game's cards lie, as the host holds them. */
function census(state: OathProjectedState) {
    const vault = vaultOf(state)
    const hydrated = new HydratedOathGameState(structuredClone(state))
    const returned = hydrated.chronicle?.returnedDenizenId
    const placed = [
        ...vault.worldDeck,
        ...Object.values(vault.discardPiles).flat(),
        ...vault.dispossessed,
        ...Object.values(hydrated.denizensBySite).flat(),
        ...hydrated.players.flatMap((p) => [...p.knownAdviserIds(), ...p.knownHand()]),
        ...hydrated.boxIds,
        ...(returned !== undefined ? [returned] : [])
    ]
    const denizens = placed.filter((cardId) => kindOf(cardId) === CardKind.Denizen)
    const held = new Set(denizens)
    return {
        worldDeck: vault.worldDeck.length,
        worldDeckVisions: vault.worldDeck.filter(isVision).length,
        dispossessed: vault.dispossessed.length,
        piles: Object.values(Region).map((region) => vault.discardPiles[region].length),
        denizens: denizens.length,
        placedTwice: denizens.length - held.size,
        archive: PRINTED_DENIZEN_IDS.length - held.size,
        bySuit: Object.fromEntries(
            Object.values(Suit).map((suit) => [
                suit,
                denizens.filter((cardId) => suitOf(cardId) === suit).length
            ])
        ),
        visions: placed.filter(isVision).length
    }
}

function perspectivesOf(state: OathProjectedState): Visibility.Perspective[] {
    return [
        ...state.players.map((player) => ({
            kind: 'player' as const,
            playerId: player.playerId
        })),
        spectator
    ]
}

function explored(
    state: OathProjectedState,
    perspective: Visibility.Perspective,
    seed: number
): OathProjectedState {
    return new OathGameExploration().createFromProjectedState({
        state: served(state, perspective),
        random: getPrng(seed)
    } as never)
}

/**
 * Every seat's and the spectator's exploration of `state`: the host's counts, every card in one
 * place, the suits as the table can name them (when it can), what the view names kept where it
 * lies, and the Dispossessed never the host's.
 */
function expectExplorationsMatch(state: OathProjectedState, suitsPublic: boolean) {
    const host = census(state)
    for (const perspective of perspectivesOf(state))
        for (const seed of SEEDS) {
            const who = perspective.kind === 'player' ? perspective.playerId : 'the spectator'
            const ex = explored(state, perspective, seed)
            const got = census(ex)
            const counts = ({ bySuit, ...rest }: typeof host) =>
                suitsPublic ? { bySuit, ...rest } : rest
            expect(counts(got), `${who}'s exploration`).toEqual(counts(host))
            expect(ex.denizensBySite, who).toEqual(state.denizensBySite)
            expect(ex.chronicle, who).toEqual(served(state, perspective).chronicle)
            const view = served(state, perspective)
            for (const player of view.players) {
                const exPlayer = ex.players.find((p) => p.playerId === player.playerId)
                if (player.handIds !== undefined)
                    expect(exPlayer?.handIds, who).toEqual(player.handIds)
                if (player.adviserIds !== undefined)
                    expect(exPlayer?.adviserIds, who).toEqual(player.adviserIds)
            }
            if (host.dispossessed > 0)
                expect([...vaultOf(ex).dispossessed].sort(), who).not.toEqual(
                    [...vaultOf(state).dispossessed].sort()
                )
        }
}

/** The first saved state that waits on `step`. */
function waitingOn(steps: readonly LocalPlay[], step: ChronicleStep): OathProjectedState {
    const found = steps.find(
        (play) =>
            play.state.machineState === MachineState.Chronicle &&
            play.state.chronicle?.step === step
    )
    assertExists(found, `No saved step waits on ${step}`)
    return found.state
}

/** The steps the saved states wait on, in order. */
function waitedOn(steps: readonly LocalPlay[]): (ChronicleStep | undefined)[] {
    return steps
        .filter((play) => play.state.machineState === MachineState.Chronicle)
        .map((play) => play.state.chronicle?.step)
}

/** The chronicle written plainly from `from`, each step kept. */
function chronicledFrom(from: LocalPlay): { steps: LocalPlay[]; finished: LocalPlay } {
    const steps = [from]
    const finished = playUntil(
        from,
        (state) => state.machineState !== MachineState.Chronicle,
        (play) => steps.push(play)
    )
    return { steps, finished }
}

/** A copy of the saved step with `change` made to its full state. */
function edited(play: LocalPlay, change: (state: HydratedOathGameState) => void): LocalPlay {
    const state = new HydratedOathGameState(structuredClone(play.state))
    change(state)
    return { ...play, state: state.dehydrate() }
}

/** Every served view of `state`, as JSON. */
function viewsOf(state: OathProjectedState): string[] {
    return perspectivesOf(state).map((perspective) => JSON.stringify(served(state, perspective)))
}

describe('R-9.4 — explorations in the Chronicle phase deal the world as the step leaves it', () => {
    const store: LocalGameStore = new Map()
    let one: PlayedToTheEnd
    let two: PlayedToTheEnd

    beforeAll(async () => {
        one = await playGameOne(store)
        two = playedToTheEnd(store, setUp(await continueGameOne(store)))
    })

    describe('a first game, Dana the Chancellor winning', () => {
        it('waits on the Vow, the tie for the suit and the story', () => {
            expect(waitedOn(one.steps)).toEqual([
                ChronicleStep.Vow,
                ChronicleStep.Suit,
                ChronicleStep.Story
            ])
        })

        it('R-8.1 the Vow: nothing has moved; 54 denizens, nine of each suit', () => {
            const state = waitingOn(one.steps, ChronicleStep.Vow)
            expect(census(state).denizens).toBe(54)
            expectExplorationsMatch(state, true)
        })

        it('R-8.4 the tie for the suit: nothing has moved yet', () => {
            expectExplorationsMatch(waitingOn(one.steps, ChronicleStep.Suit), true)
        })

        it('the story: the six added (3/2/1), six in the Dispossessed, the deck rebuilt of 59', () => {
            const state = waitingOn(one.steps, ChronicleStep.Story)
            expect(census(state)).toMatchObject({
                worldDeck: 59,
                dispossessed: 6,
                denizens: 60,
                archive: 138
            })
            expectExplorationsMatch(state, true)
        })

        it('the result, the record written', () => {
            expectExplorationsMatch(one.finished.state, true)
        })
    })

    describe('a first game whose winner builds (R-8.3.1): the replaced denizen is public', () => {
        let steps: LocalPlay[]

        beforeAll(() => {
            // A card from the middle of the world deck dealt to a site Dana rules, so the build is offered.
            const atVow = edited(one.won, (state) => {
                const vault = state.requireVault()
                const winnerId = state.chronicle?.ending.winnerPlayerId ?? ''
                const siteId = state
                    .allSiteIds()
                    .find(
                        (slotId) =>
                            rulesSite(state, winnerId, slotId) &&
                            !state.denizensAt(slotId).some((id) => state.isEdifice(id))
                    )
                assertExists(siteId, 'Dana rules a site')
                const at = vault.worldDeck.findIndex(
                    (cardId, index) => index > 10 && kindOf(cardId) === CardKind.Denizen
                )
                const [cardId] = vault.worldDeck.splice(at, 1)
                state.denizensBySite[siteId] = [...state.denizensAt(siteId), cardId]
            })
            const vowed = playStep(atVow, plainestChronicleAnswer(atVow.state))
            expect(vowed.state.chronicle?.step).toBe(ChronicleStep.BuildOrRepair)
            const hydrated = new HydratedOathGameState(structuredClone(vowed.state))
            const [choice] = edificeChoices(hydrated)
            assertExists(choice, 'R-8.3.1 — a build is offered')
            const built = playStep(
                vowed,
                buildAction(BuildOrRepairEdifice, {
                    playerId: hydrated.chronicle?.ending.winnerPlayerId ?? '',
                    choice: { siteId: choice.siteId, cardId: choice.cardId }
                })
            )
            expect(built.state.chronicle?.returnedDenizenId).toBe(choice.cardId)
            steps = [vowed, ...chronicledFrom(built).steps]
        })

        it('waits on the build, the tie for the suit and the story', () => {
            expect(waitedOn(steps)).toEqual([
                ChronicleStep.BuildOrRepair,
                ChronicleStep.Suit,
                ChronicleStep.Story
            ])
        })

        it('R-8.3.1 the build offered: nothing has moved', () => {
            expectExplorationsMatch(waitingOn(steps, ChronicleStep.BuildOrRepair), true)
        })

        it('R-8.4 the tie for the suit, after the build: the replaced denizen is where the chronicle names it, and nowhere else', () => {
            const state = waitingOn(steps, ChronicleStep.Suit)
            expect(state.chronicle?.returnedDenizenId).toBeDefined()
            expectExplorationsMatch(state, true)
        })

        it('the story: the returned denizen is in the rebuilt deck', () => {
            expectExplorationsMatch(waitingOn(steps, ChronicleStep.Story), true)
        })
    })

    describe('a first game won by an Exile, Rhys (R-8.2)', () => {
        let steps: LocalPlay[]

        beforeAll(() => {
            const before = one.steps[one.steps.indexOf(one.won) - 1]
            const won = wonTable(new HydratedOathGameState(structuredClone(before.state)), {
                winnerPlayerId: 'g1-rhys',
                kind: WinKind.Usurper,
                rule: 'R-3.1'
            })
            steps = chronicledFrom({ ...before, state: won }).steps
        })

        it('waits on the Vow, Citizenship, the tie for the suit and the story', () => {
            expect(waitedOn(steps)).toEqual([
                ChronicleStep.Vow,
                ChronicleStep.Citizenship,
                ChronicleStep.Suit,
                ChronicleStep.Story
            ])
        })

        it('R-8.1 the Vow', () => {
            expectExplorationsMatch(waitingOn(steps, ChronicleStep.Vow), true)
        })

        it('R-8.2 Citizenship, Ann the Exile who may be offered it', () => {
            expectExplorationsMatch(waitingOn(steps, ChronicleStep.Citizenship), true)
        })

        it('R-8.4 the tie for the suit', () => {
            expectExplorationsMatch(waitingOn(steps, ChronicleStep.Suit), true)
        })

        it('the story', () => {
            expectExplorationsMatch(waitingOn(steps, ChronicleStep.Story), true)
        })
    })

    describe('a continued game: game 1 added its 3/2/1, so every suit’s count is public', () => {
        it('waits on the Vow, the tie for the suit and the story', () => {
            expect(waitedOn(two.steps)).toEqual([
                ChronicleStep.Vow,
                ChronicleStep.Suit,
                ChronicleStep.Story
            ])
        })

        it('R-8.1 the Vow: 60 denizens, six of them in the Dispossessed', () => {
            const state = waitingOn(two.steps, ChronicleStep.Vow)
            expect(census(state)).toMatchObject({ denizens: 60, dispossessed: 6 })
            expectExplorationsMatch(state, true)
        })

        it('R-8.4 the tie for the suit', () => {
            expectExplorationsMatch(waitingOn(two.steps, ChronicleStep.Suit), true)
        })

        it('the story: 66 denizens, twelve in the Dispossessed', () => {
            const state = waitingOn(two.steps, ChronicleStep.Story)
            expect(census(state)).toMatchObject({ denizens: 66, dispossessed: 12 })
            expectExplorationsMatch(state, true)
        })

        it('the result', () => {
            expectExplorationsMatch(two.finished.state, true)
        })
    })

    describe('a continued game that heals the Archive (R-8.4.a) from a stack under six (R-9.3)', () => {
        let steps: LocalPlay[]
        let count: number

        beforeAll(() => {
            // Game 1 healed rather than added, so no suit's count is public; this game's world deck
            // holds all but two of the winner's suit, so the Archive cannot give its three.
            const atVow = two.won
            const vowViews = viewsOf(atVow.state)
            const swapped = edited(atVow, (state) => {
                const record = state.chronicleRecord ?? []
                state.chronicleRecord = record.map((entry) => ({
                    ...entry,
                    added: { heal: { suit: Suit.Arcane, count: 6 } }
                }))
                const [suit] = chronicleSuitLeaders(state)
                const vault = state.requireVault()
                const inGame = new Set([
                    ...vault.worldDeck,
                    ...Object.values(vault.discardPiles).flat(),
                    ...vault.dispossessed,
                    ...Object.values(state.denizensBySite).flat(),
                    ...state.players.flatMap((p) => [...p.knownAdviserIds(), ...p.knownHand()]),
                    ...state.boxIds
                ])
                const archive = PRINTED_DENIZENS_BY_SUIT[suit].filter((id) => !inGame.has(id))
                for (const [index, cardId] of vault.worldDeck.entries()) {
                    if (archive.length <= 2) break
                    if (index === 0 || isVision(cardId) || suitOf(cardId) === suit) continue
                    vault.worldDeck[index] = archive.pop() ?? cardId
                }
                assert(archive.length <= 2, 'The world deck takes the suit’s Archive')
            })
            // Only the record changed in what anyone is served.
            const recordless = (views: string[]) =>
                views.map((view) => {
                    const parsed = JSON.parse(view) as OathProjectedState
                    delete parsed.chronicleRecord
                    return JSON.stringify(parsed)
                })
            expect(recordless(viewsOf(swapped.state))).toEqual(recordless(vowViews))
            const written = chronicledFrom(swapped)
            steps = written.steps
            const heal = written.finished.state.chronicleRecord?.at(-1)?.added?.heal
            assertExists(heal, 'R-8.4.a — the Archive was healed')
            count = heal.count
        })

        it('the heal took fewer than six', () => {
            expect(count).toBeLessThan(6)
        })

        it('the story: the heal’s cards and the six Dispossessed counted, the rest back in the Archive', () => {
            const state = waitingOn(steps, ChronicleStep.Story)
            expect(census(state).denizens).toBe(54 + count)
            expectExplorationsMatch(state, false)
        })

        it('waits on the Vow, the tie for the suit, the tie for the largest stack and the story', () => {
            expect(waitedOn(steps)).toEqual([
                ChronicleStep.Vow,
                ChronicleStep.Suit,
                ChronicleStep.HealStack,
                ChronicleStep.Story
            ])
        })

        it('R-8.1 the Vow and R-8.4 the tie for the suit: nothing has moved', () => {
            expectExplorationsMatch(waitingOn(steps, ChronicleStep.Vow), false)
            expectExplorationsMatch(waitingOn(steps, ChronicleStep.Suit), false)
        })

        it('R-8.4.a-H1 the tie for the largest stack: nothing has moved yet', () => {
            expectExplorationsMatch(waitingOn(steps, ChronicleStep.HealStack), false)
        })
    })
})
