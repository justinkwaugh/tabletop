import { beforeAll, describe, expect, it } from 'vitest'
import {
    ActionSource,
    Color,
    GameCategory,
    GameContinuationError,
    GameEngine,
    GameResult,
    captureGameContinuation,
    createCallGameAction,
    latestPlayerUndoTarget,
    type Game
} from '@tabletop/common'
import { Definition } from '../runtime.js'
import { MachineState } from '../states.js'
import { ActionType } from '../actions.js'
import type { OathProjectedState } from '../../model/gameState.js'
import { OathType, Region } from '../../model/oathEnums.js'
import { BoardSide, ChronicleStep, OpeningChancellor } from '../../model/chronicle.js'
import { WIN_KIND_OF_RULE, WinKind } from '../../model/ending.js'
import { mapSlotsFor } from '../../data/mapSlots.js'
import { vowableOaths } from '../../util/chronicleChoices.js'
import { OathRevision } from '../../util/revision.js'
import type { Search } from '../../actions/search.js'
import { vaultOf } from '../../testing/engine.js'
import { served, spectator } from '../../testing/projection.js'
import { chronicleCensus, openingCensus } from '../../testing/chronicleWorld.js'
import {
    continuedPlayers,
    createLocalGame,
    forkLocally,
    loadLocally,
    playStep,
    playToWin,
    playUntil,
    saveLocally,
    type LocalGameStore,
    type LocalPlay
} from '../../testing/localGames.js'
import {
    AGAIN_SEED,
    GAME_ONE_SEED,
    OWNER,
    STORY,
    TABLE_NAME,
    chancellorSearches,
    continueGameOne,
    continueLocally,
    continuePinned,
    drawnBy,
    hydrated,
    keepPlainly,
    localGame,
    nextTurn,
    pinnedGameTwo,
    playGameOne,
    playedToTheEnd,
    rhysRenamedBea,
    seated,
    setUp,
    storePinnedGameTwo,
    type PlayedToTheEnd
} from '../../testing/rehearsal.js'
import '../../powers/index.js'

// The chronicle rehearsed end to end as a local hotseat game, through the game's own definition
// and the steps the site takes for a local game: created on the owner's account, every action run
// on the full state, and each step stored as a structured clone and validated.

const GAME_ONE = 'long-table-1'
const g1 = (name: string) => `g1-${name.toLowerCase()}`
const g2 = (name: string) => `g2-${name.toLowerCase()}`
const g3 = (name: string) => `g3-${name.toLowerCase()}`

const typesOf = (play: LocalPlay, from = 0) => play.actions.slice(from).map((action) => action.type)
/** The players' own actions from `from` on: the steps that waited on them. */
const choicesOf = (play: LocalPlay, from = 0) =>
    play.actions
        .slice(from)
        .filter((action) => action.source === ActionSource.User)
        .map((action) => action.type)

/** What every seat and the spectator must be served alike. */
function publicOf(view: OathProjectedState) {
    return {
        openingSeats: view.openingSeats,
        chronicleRecord: view.chronicleRecord,
        table: view.table,
        map: view.map,
        siteCards: view.siteCards,
        denizensBySite: view.denizensBySite,
        relicsBySite: view.relicsBySite,
        ruinedEdificeIds: view.ruinedEdificeIds,
        dispossessedCount: view.dispossessedCount,
        discardPileCounts: view.discardPileCounts,
        worldDeckVisions: view.worldDeckVisions,
        visionsDrawn: view.visionsDrawn,
        handCounts: view.players.map((player) => player.handCount),
        supply: view.players.map((player) => player.supply)
    }
}

function viewsOf(state: OathProjectedState) {
    return [
        ...state.players.map((player) => ({
            playerId: player.playerId,
            view: served(state, { kind: 'player', playerId: player.playerId })
        })),
        { playerId: undefined, view: served(state, spectator) }
    ]
}

describe('scene A — "The long table": three seats play to a win, Continue, and a Search', () => {
    const store: LocalGameStore = new Map()
    let one: PlayedToTheEnd
    let two: LocalPlay
    let set: LocalPlay
    let searched: LocalPlay

    beforeAll(async () => {
        one = await playGameOne(store)
    })

    describe('game 1', () => {
        it('is created as the site creates a local game: every seat on the owner’s account', () => {
            expect(one.created.game.players.map((player) => player.userId)).toEqual([
                OWNER.userId,
                OWNER.userId,
                OWNER.userId
            ])
            expect(one.created.state.activePlayerIds).toEqual(one.created.game.activePlayerIds)
            expect(one.created.state.oathType).toBe(OathType.Supremacy)
            // R-1.7 — a first game's Chancellor is random; the seed seats Dana.
            expect(one.created.state.chancellorPlayerId).toBe(g1('Dana'))
        })

        it('R-3.3: with nobody acting, Dana the Chancellor wins on the die; the turn bar reads Chronicle before the result', () => {
            const { won } = one
            expect(won.state.machineState).toBe(MachineState.Chronicle)
            expect(won.state.result).toBeUndefined()
            expect(won.state.round).toBe(6)
            expect(won.state.winningPlayerIds).toEqual([g1('Dana')])
            expect(won.state.chronicle?.ending).toMatchObject({
                rule: 'R-3.3',
                winnerPlayerId: g1('Dana')
            })
            expect(WIN_KIND_OF_RULE['R-3.3']).toBe(WinKind.StableRegime)
            expect(won.state.chronicle?.step).toBe(ChronicleStep.Vow)
        })

        it('R-8: the Vow never offers Supremacy (R-8.1); no Citizenship step for a Chancellor (R-8.2); nothing to build; the suit on a tie; the story', () => {
            const vowable = vowableOaths(hydrated(one.won.state))
            expect(vowable).not.toContain(OathType.Supremacy)
            // The steps that waited, in order: the Vow, the tied suit, the story.
            expect(choicesOf(one.finished, one.won.actions.length)).toEqual([
                ActionType.ChooseOath,
                ActionType.ChooseChronicleSuit,
                ActionType.WriteChronicleStory
            ])
            // Between them, what the rules settle alone, each its own System Action.
            expect(typesOf(one.finished, one.won.actions.length)).toEqual([
                ActionType.ChooseOath,
                ActionType.ChronicleMap,
                ActionType.ChooseChronicleSuit,
                ActionType.ChronicleAddCards,
                ActionType.ChronicleDispossess,
                ActionType.ChronicleRelics,
                ActionType.ChronicleRebuild,
                ActionType.WriteChronicleStory
            ])
            expect(one.finished.state.machineState).toBe(MachineState.EndOfGame)
        })

        it('the census holds on the finished world (every card of the game in one place)', () => {
            expect(chronicleCensus(hydrated(one.finished.state))).toEqual([])
        })

        it('the result and canContinue are set by the same action', () => {
            const steps = one.steps
            const first = steps.findIndex((step) => step.state.result !== undefined)
            expect(first).toBeGreaterThan(0)
            expect(steps.findIndex((step) => step.state.canContinue === true)).toBe(first)
            expect(steps[first - 1].state.canContinue).toBeUndefined()
            const { state } = one.finished
            expect(state.result).toBe(GameResult.Win)
            expect(state.canContinue).toBe(true)
        })

        it('the record holds one entry: game 1, Supremacy, Dana, mark O, the vowed Oath, the story', () => {
            const { state } = one.finished
            expect(state.chronicleRecord).toEqual([
                {
                    gameNumber: 1,
                    sessionName: TABLE_NAME,
                    date: state.table?.date,
                    startingOath: OathType.Supremacy,
                    rule: 'R-3.3',
                    winner: { name: 'Dana', color: Color.Purple },
                    nextOath: OathType.ThePeople,
                    added: { suits: expect.any(Array) },
                    story: STORY
                }
            ])
        })

        it('is stored with canContinue on its record, and loads and validates again', () => {
            const stored = store.get(GAME_ONE)
            expect(stored?.game.canContinue).toBe(true)
            expect(stored?.actions).toHaveLength(one.finished.actions.length)
            const loaded = loadLocally(store, GAME_ONE)
            expect(loaded.state).toEqual(one.finished.state)
            expect(loaded.state).not.toBe(stored?.state)
        })
    })

    describe('game 2: Continue with Dana, Rhys and Ann, and Bea joining', () => {
        beforeAll(async () => {
            two = await continueGameOne(store)
            set = setUp(two)
            searched = chancellorSearches(set)
        })

        describe('Continue: Dana, Rhys and Ann return and Bea joins', () => {
            it('the new game names the one it continues; new ids, the same names; re-validated by the platform', () => {
                expect(two.game.continuedFromGameId).toBe(GAME_ONE)
                const before = one.finished.game.players.map((player) => player.id)
                const after = two.game.players.map((player) => player.id)
                expect(after.filter((id) => before.includes(id))).toEqual([])
                expect(two.game.players.map((player) => player.name)).toEqual([
                    'Dana',
                    'Rhys',
                    'Ann',
                    'Bea'
                ])
                expect(two.state.gameId).toBe('long-table-2')
            })

            it('a stored finished state that no longer validates is refused, not continued', async () => {
                const broken: LocalGameStore = new Map(store)
                const stored = structuredClone(store.get(GAME_ONE))
                if (stored === undefined) throw Error('game 1 is stored')
                Object.assign(stored.state.players[0], { favor: 'all of it' })
                broken.set(GAME_ONE, stored)
                await expect(continueGameOne(broken)).rejects.toThrow(GameContinuationError)
                await expect(continueGameOne(broken)).rejects.toThrow('can no longer continue')
            })
        })

        describe('game 2 opens per R-1.7-H1 and R-1.9-H1 on the world game 1 saved', () => {
            it('Dana is Chancellor as game 1’s winner, first in turn order; Ann and Rhys keep their boards; Bea is dealt a free one, all Exile side up', () => {
                const { state } = two
                expect(state.openingSeats).toEqual({
                    chancellor: { playerId: g2('Dana'), chosen: OpeningChancellor.Winner },
                    boards: [
                        {
                            playerId: g2('Ann'),
                            color: Color.White,
                            side: BoardSide.Exile,
                            kept: true
                        },
                        {
                            playerId: g2('Rhys'),
                            color: Color.Red,
                            side: BoardSide.Exile,
                            kept: true
                        },
                        {
                            playerId: g2('Bea'),
                            color: Color.Black,
                            side: BoardSide.Exile,
                            kept: false
                        }
                    ]
                })
                expect(state.turnManager.turnOrder[0]).toBe(g2('Dana'))
                const gameOneColors = one.finished.state.players.map((player) => player.color)
                expect(gameOneColors).toEqual(
                    expect.arrayContaining([Color.Purple, Color.White, Color.Red])
                )
                expect(gameOneColors).not.toContain(Color.Black)
                expect(state.boxedCitizenColors).toBeUndefined()
            })

            it('the vowed Oath; the map as it lay, with its facing; the decks in their saved order less setup’s draws', () => {
                const before = one.finished.state
                const { state } = two
                expect(state.oathType).toBe(OathType.ThePeople)
                expect(state.oathType).toBe(before.chronicleRecord?.[0].nextOath)
                expect(state.map).toEqual(before.map)
                expect(state.siteCards).toEqual(before.siteCards)
                expect(vaultOf(state).siteFacedown).toEqual(vaultOf(before).siteFacedown)
                // R-1.17, R-1.18 — the Reliquary from the top of the relic deck.
                const relics = vaultOf(before).relicDeck
                expect(
                    state.reliquary.map((slot) => vaultOf(state).relicFacedown[slot.slotId])
                ).toEqual(relics.slice(0, 4))
                expect(vaultOf(state).relicDeck).toEqual(relics.slice(4))
                // R-1.19, R-1.20 — three to each pile and three to each of four hands, from the bottom.
                const world = vaultOf(before).worldDeck
                expect(vaultOf(state).worldDeck).toEqual(world.slice(0, world.length - 15))
            })

            it('the record copied unchanged; the table is game 2’s own; the census holds at open', () => {
                const { state } = two
                expect(state.chronicleRecord).toEqual(one.finished.state.chronicleRecord)
                expect(state.table).toEqual({
                    name: TABLE_NAME,
                    date: state.table?.date,
                    seatNames: {
                        [g2('Dana')]: 'Dana',
                        [g2('Rhys')]: 'Rhys',
                        [g2('Ann')]: 'Ann',
                        [g2('Bea')]: 'Bea'
                    }
                })
                expect(state.chronicle).toBeUndefined()
                expect(state.result).toBeUndefined()
                expect(state.oathRevision).toBe(OathRevision.Chronicle)
                expect(openingCensus(hydrated(state))).toEqual([])
            })

            it('every seat makes its setup choice, and Dana’s turn begins', () => {
                expect(set.state.machineState).toBe(MachineState.WakePhase)
                expect(set.state.activePlayerIds).toEqual([g2('Dana')])
                expect(typesOf(set)).toEqual(Array(4).fill(ActionType.SetupChoice))
            })
        })

        it('one account: Rhys’s seat taken over under the name Bea is that seat renamed, and keeps Rhys’s board', async () => {
            const renamed: LocalGameStore = new Map([
                [GAME_ONE, structuredClone(store.get(GAME_ONE))!]
            ])
            const { state } = await continueGameOne(renamed, GAME_ONE, rhysRenamedBea)
            expect(state.openingSeats?.boards).toEqual([
                { playerId: g2('Bea'), color: Color.Red, side: BoardSide.Exile, kept: true },
                { playerId: g2('Ann'), color: Color.White, side: BoardSide.Exile, kept: true }
            ])
            expect(state.players.map((player) => player.color).sort()).toEqual(
                [Color.Purple, Color.Red, Color.White].sort()
            )
        })

        describe('R-5.1 — Dana’s first Search reaches the carried deck', () => {
            it('the first card drawn is the top of game 1’s rebuilt deck: a Vision, so the Search stops there (R-5.1.2)', () => {
                const top = vaultOf(one.finished.state).worldDeck[0]
                expect(top).toBe('vision.conspiracy')
                expect(drawnBy(searched)).toEqual([top])
                const search = searched.actions.at(-1) as Search
                expect(search.metadata).toMatchObject({
                    stoppedOnVision: true,
                    cardsDrawn: 1,
                    visionsDrawn: 1,
                    // R-5.1.1 — the cost the Visions Drawn track shows before the draw.
                    supplySpent: 2
                })
                expect(set.state.visionsDrawn).toBe(0)
                expect(searched.state.visionsDrawn).toBe(1)
            })

            it('Dana keeps it by the plainest placement their view accepts, and the next seat’s turn begins', () => {
                const kept = keepPlainly(searched)
                expect(kept.actions.at(-1)).toMatchObject({
                    type: ActionType.SearchResolve,
                    keptCardId: 'vision.conspiracy',
                    play: 'adviser',
                    faceUp: false
                })
                expect(nextTurn(kept).state.activePlayerIds).toEqual([g2('Ann')])
            })
        })

        describe('hidden information (R-9.4): every seat’s view and the spectator’s, as the session serves them', () => {
            const atOpen = () => two.state
            const atSearch = () => searched.state

            for (const [when, stateAt] of [
                ['at open', atOpen],
                ['at Dana’s Search', atSearch]
            ] as const) {
                it(`${when}: the same opening seats, record, table, map and public counts`, () => {
                    const [first, ...rest] = viewsOf(stateAt()).map(({ view }) => publicOf(view))
                    for (const view of rest) expect(view).toEqual(first)
                    expect(first.openingSeats).toEqual(stateAt().openingSeats)
                })

                it(`${when}: no view holds the vault or a hidden card it has not seen`, () => {
                    const state = stateAt()
                    const vault = vaultOf(state)
                    const hidden = [
                        ...Object.values(vault.siteFacedown),
                        ...vault.dispossessed,
                        ...vault.relicDeck,
                        ...vault.worldDeck,
                        ...Object.values(vault.discardPiles).flat()
                    ]
                    // A seat knows what it discarded itself (R-1.23).
                    const knownTo = (playerId?: string) =>
                        Object.values(
                            state.players.find((player) => player.playerId === playerId)
                                ?.knownDiscardPiles ?? {}
                        ).flat()
                    for (const { playerId, view } of viewsOf(state)) {
                        expect(view.vault).toBeUndefined()
                        const json = JSON.stringify(view)
                        const known = knownTo(playerId)
                        for (const cardId of hidden.filter((id) => !known.includes(id)))
                            expect(json).not.toContain(`"${cardId}"`)
                    }
                })
            }

            it('the drawn card is on Dana’s view only', () => {
                const [cardId] = drawnBy(searched)
                for (const { playerId, view } of viewsOf(searched.state)) {
                    expect(JSON.stringify(view).includes(`"${cardId}"`)).toBe(
                        playerId === g2('Dana')
                    )
                }
            })
        })

        describe('undo (R-X.3)', () => {
            it('game 2’s opening has nothing to undo; the first setup choice undoes as a first game’s does', async () => {
                expect(two.state.actionCount).toBe(0)
                expect(latestPlayerUndoTarget(two.actions, g2('Dana'))).toBeUndefined()
                const firstChoice = (play: LocalPlay) => {
                    const chosen = playUntil(play, (state) => state.actionCount > 0)
                    const [action] = chosen.actions
                    return [
                        action.type,
                        action.revealsInfo,
                        latestPlayerUndoTarget(chosen.actions, action.playerId ?? '')?.type
                    ]
                }
                const firstGame = await createLocalGame(
                    localGame('first', seated('f', ['Dana', 'Rhys', 'Ann'])),
                    { masterSeed: GAME_ONE_SEED },
                    new Map()
                )
                expect(firstChoice(two)).toEqual(firstChoice(firstGame))
                expect(firstChoice(two)[0]).toBe(ActionType.SetupChoice)
            })

            it('Dana’s Search cannot be undone once a card is drawn', () => {
                expect(searched.actions.at(-1)?.revealsInfo).toBe(true)
                expect(latestPlayerUndoTarget(searched.actions, g2('Dana'))).toBeUndefined()
            })
        })

        describe('branching', () => {
            it('Continue pressed twice gives two independent games; game 1 is unchanged', async () => {
                const before = structuredClone(store.get(GAME_ONE))
                const again = await continueLocally(store, GAME_ONE, {
                    id: 'long-table-2b',
                    prefix: 'g2b',
                    masterSeed: AGAIN_SEED
                })
                expect(again.game.id).not.toBe(two.game.id)
                expect(again.game.continuedFromGameId).toBe(GAME_ONE)
                expect(again.state.chronicleRecord).toEqual(two.state.chronicleRecord)
                expect(store.get(GAME_ONE)).toEqual(before)
                expect(store.get('long-table-2')?.state).toEqual(two.state)
                again.state.players[0].favor = 99
                expect(store.get('long-table-2b')?.state.players[0].favor).not.toBe(99)
            })

            it('a fork taken before the winning die roll cannot continue until it is won again; its entry keeps game 1’s table', async () => {
                const roll = one.won.actions.findLastIndex(
                    (action) => action.type === ActionType.RollEndDie
                )
                const fork = forkLocally(store, GAME_ONE, roll - 1, 'The long table, again')
                expect(fork.game.canContinue).toBeUndefined()
                expect(store.get(fork.game.id)?.game.canContinue).toBeUndefined()
                expect(fork.state.result).toBeUndefined()
                await expect(
                    continueLocally(store, fork.game.id, {
                        id: 'fork-next',
                        prefix: 'fork',
                        masterSeed: AGAIN_SEED
                    })
                ).rejects.toThrow('not ready to continue')

                const replayed = playedToTheEnd(store, fork)
                expect(store.get(fork.game.id)?.game.canContinue).toBe(true)
                const [entry] = replayed.finished.state.chronicleRecord ?? []
                expect(entry.sessionName).toBe(TABLE_NAME)
                expect(entry.date).toBe(one.finished.state.table?.date)
                const next = await continueLocally(store, fork.game.id, {
                    id: 'fork-next',
                    prefix: 'fork',
                    masterSeed: AGAIN_SEED
                })
                expect(next.state.openingSeats?.chancellor.playerId).toBe('fork-dana')
            })
        })
    })
})

describe('scene B — the pinned finished game 2 (an edifice and a ruin on its map), stored locally and continued', () => {
    const [C1, C2] = mapSlotsFor(Region.Cradle)
    const [P1, P2, P3] = mapSlotsFor(Region.Provinces)
    const [H1, H2, H3] = mapSlotsFor(Region.Hinterland)
    const store: LocalGameStore = new Map()
    let three: LocalPlay

    beforeAll(async () => {
        three = await continuePinned(store)
    })

    it('opens on the world game 2 saved: its map, the Reliquary’s four and the Grand Mask on top', () => {
        const { state } = three
        expect(state.siteCards).toEqual({
            [C1]: 'site.fertile-valley',
            [C2]: 'site.the-tribunal',
            [P1]: 'site.mountain',
            [P2]: 'site.lush-coast',
            [H3]: 'site.steppe'
        })
        expect(vaultOf(state).siteFacedown).toEqual({
            [P3]: 'site.buried-giant',
            [H1]: 'site.river',
            [H2]: 'site.charming-valley'
        })
        expect(state.denizensBySite[P1]).toEqual(['edifice.order.sprawling-rampart'])
        expect(state.ruinedEdificeIds).toEqual(['edifice.nomad.ancient-forge'])
        expect(state.reliquary.map((slot) => vaultOf(state).relicFacedown[slot.slotId])).toEqual(
            ['obsidian-cage', 'dragonskin-drum', 'truthful-harp', 'ring-of-devotion'].map(
                (id) => `relic.${id}`
            )
        )
        expect(vaultOf(state).relicDeck[0]).toBe('relic.grand-mask')
        expect(openingCensus(hydrated(state))).toEqual([])
    })

    it('Dana is Chancellor; Ann keeps yellow and Rhys red; Bea is dealt a free colour; all Exile side up', () => {
        expect(three.state.openingSeats).toEqual({
            chancellor: { playerId: g3('Dana'), chosen: OpeningChancellor.Winner },
            boards: [
                { playerId: g3('Bea'), color: Color.White, side: BoardSide.Exile, kept: false },
                { playerId: g3('Ann'), color: Color.Yellow, side: BoardSide.Exile, kept: true },
                { playerId: g3('Rhys'), color: Color.Red, side: BoardSide.Exile, kept: true }
            ]
        })
        // R-1.22's marker is not reached here: no Vision came to a setup hand.
        expect(three.state.visionsDrawn).toBe(0)
    })

    it('R-5.1 — Dana’s first Search draws the top of the rebuilt deck, and Dana keeps it', () => {
        const top = vaultOf(pinnedGameTwo()).worldDeck[0]
        const searched = chancellorSearches(setUp(three))
        expect(drawnBy(searched)[0]).toBe(top)
        expect(top).toBe('denizen.order.bear-traps')
        const kept = keepPlainly(searched)
        expect(kept.actions.at(-1)).toMatchObject({
            type: ActionType.SearchResolve,
            keptCardId: top
        })
    })
})

describe('scene C — what cannot be continued', () => {
    const threeSeats = (id: string) => localGame(id, seated('c', ['Dana', 'Rhys', 'Ann']))

    it('a game won below the chronicle revision has a result, no canContinue and no chronicle: refused', async () => {
        const store: LocalGameStore = new Map()
        const created = await createLocalGame(
            threeSeats('older'),
            { masterSeed: GAME_ONE_SEED },
            store
        )
        // A game recorded under an earlier release.
        created.state.oathRevision = OathRevision.Chronicle - 1
        const won = playToWin(created, (step) => saveLocally(store, step))
        expect(won.state.machineState).toBe(MachineState.EndOfGame)
        expect(won.state.result).toBe(GameResult.Win)
        expect(won.state.canContinue).toBeUndefined()
        expect(won.state.chronicle).toBeUndefined()
        expect(won.state.chronicleRecord).toBeUndefined()
        expect(store.get('older')?.game.canContinue).toBeUndefined()
        await expect(
            continueLocally(store, 'older', { id: 'older-2', prefix: 'o', masterSeed: AGAIN_SEED })
        ).rejects.toThrow('The game being continued is not ready to continue')
    })

    it('a game called at the chronicle revision is refused the same way', async () => {
        const store: LocalGameStore = new Map()
        const created = await createLocalGame(
            threeSeats('called'),
            { masterSeed: GAME_ONE_SEED },
            store
        )
        const underway = playUntil(created, (state) => state.round === 2)
        const call = createCallGameAction({
            gameId: underway.state.gameId,
            ballot: {
                initiatorPlayerId: 'c-dana',
                declaredWinnerId: 'c-ann',
                approvingPlayerIds: ['c-dana', 'c-rhys', 'c-ann'],
                decliningPlayerIds: []
            },
            players: [{}, {}, {}]
        })
        const result = new GameEngine(Definition.runtime).executeCanonicalAction({
            action: call,
            state: underway.state,
            game: underway.game
        })
        const called: LocalPlay = {
            game: underway.game,
            state: result.updatedState,
            actions: [...underway.actions, ...result.processedActions]
        }
        expect(called.state.result).toBe(GameResult.Win)
        expect(called.state.canContinue).toBeUndefined()
        saveLocally(store, called)
        await expect(
            continueLocally(store, 'called', {
                id: 'called-2',
                prefix: 'o',
                masterSeed: AGAIN_SEED
            })
        ).rejects.toThrow('The game being continued is not ready to continue')
    })

    it('an exploration, and a deleted game, are refused before the state is read', () => {
        const store: LocalGameStore = new Map()
        const { game, state } = storePinnedGameTwo(store)
        const exploration: Game = { ...game, category: GameCategory.Exploration }
        expect(() => captureGameContinuation(exploration, state, Definition as never)).toThrow(
            'Explorations and deleted games cannot be continued'
        )
        expect(() =>
            captureGameContinuation({ ...game, deleted: true }, state, Definition as never)
        ).toThrow('Explorations and deleted games cannot be continued')
        expect(() => captureGameContinuation(game, state, Definition as never)).not.toThrow()
    })
})

describe('the local steps, in the site’s order', () => {
    it('createLocalGame puts every seat on the owner’s account before the game starts', async () => {
        const store: LocalGameStore = new Map()
        const players = seated('s', ['Dana', 'Rhys'])
        players[1].userId = 'u-someone-else'
        const { game } = await createLocalGame(
            localGame('s', players),
            { masterSeed: AGAIN_SEED },
            store
        )
        expect(game.players.map((player) => player.userId)).toEqual([OWNER.userId, OWNER.userId])
    })

    it('continuedPlayers gives every seat a new id and its name; only the owner’s seat has an account', () => {
        const store: LocalGameStore = new Map()
        const { game } = storePinnedGameTwo(store)
        const players = continuedPlayers(game, OWNER, (name) => `n-${name}`)
        expect(players.map((player) => [player.id, player.name, player.userId])).toEqual([
            ['n-Dana', 'Dana', OWNER.userId],
            ['n-Rhys', 'Rhys', undefined],
            ['n-Ann', 'Ann', undefined]
        ])
    })

    it('saveLocally copies canContinue to the stored record, and refuses a state that fails validation', () => {
        const store: LocalGameStore = new Map()
        const play = storePinnedGameTwo(store)
        expect(store.get(play.game.id)?.game.canContinue).toBe(true)
        const broken = structuredClone(play)
        Object.assign(broken.state.players[0], { favor: 'all of it' })
        expect(() => saveLocally(new Map(), broken)).toThrow('Complete canonical state is required')
    })

    it('loadLocally hands out a copy, never the stored object', () => {
        const store: LocalGameStore = new Map()
        const { game } = storePinnedGameTwo(store)
        const loaded = loadLocally(store, game.id)
        loaded.state.players[0].favor = 99
        expect(store.get(game.id)?.state.players[0].favor).not.toBe(99)
    })

    it('playStep takes only a step the acting seat’s own view accepts', async () => {
        const store: LocalGameStore = new Map()
        const created = await createLocalGame(
            localGame('p', seated('p', ['Dana', 'Rhys', 'Ann'])),
            { masterSeed: GAME_ONE_SEED },
            store
        )
        const [onClock] = created.state.activePlayerIds
        const other = created.state.players.find((player) => player.playerId !== onClock)
        expect(() =>
            playStep(created, { type: ActionType.EndActPhase, playerId: other?.playerId } as never)
        ).toThrow('is not accepted on their own view')
    })
})
