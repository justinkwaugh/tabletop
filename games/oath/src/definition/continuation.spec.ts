import { describe, expect, it } from 'vitest'
import {
    Color,
    GameContinuationError,
    GameEngine,
    GameStatus,
    PlayerStatus as SeatStatus,
    captureGameContinuation,
    latestPlayerUndoTarget,
    type Game,
    type GameConfig,
    type GameContinuation,
    type Player
} from '@tabletop/common'
import { Definition } from './runtime.js'
import { OathGameInitializer } from './initializer.js'
import { OathGameExploration } from './gameExploration.js'
import { MachineState } from './states.js'
import { engine } from '../testing/engine.js'
import { buildAction } from '../testing/actions.js'
import { seatIds, testGame } from '../testing/game.js'
import { served, spectator } from '../testing/projection.js'
import { openingCensus } from '../testing/chronicleWorld.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import {
    Banner,
    CardKind,
    OathType,
    PlayerStatus,
    Region,
    SetupVariant
} from '../model/oathEnums.js'
import { BoardSide, OpeningChancellor, type ChronicleEntry } from '../model/chronicle.js'
import { WinKind } from '../model/ending.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { mapSlotsFor, TOP_CRADLE_SLOT } from '../data/mapSlots.js'
import { GRAND_SCEPTER_ID } from '../data/relics.js'
import { SetupChoice, reasonCannotSetupChoice } from '../actions/setupChoice.js'
import { OathRevision } from '../util/revision.js'
import GAME_TWO_FINISHED from './tests/chronicle-game-2-finished.json'
import '../powers/index.js'

// R-8.7 to R-1: a won game continued into the next game of its chronicle, through the platform's
// continuation. Game 2 of the Law's example (the pinned finished state: Dana, the Chancellor, won
// by a Stable Regime and vowed The People) opens game 3 on the world it saved.

const [C1, C2] = mapSlotsFor(Region.Cradle)
const [P1, P2, P3] = mapSlotsFor(Region.Provinces)
const [H1, H2, H3] = mapSlotsFor(Region.Hinterland)
const den = (id: string) => `denizen.${id}`
const site = (id: string) => `site.${id}`
const relic = (id: string) => `relic.${id}`
const FORGE = 'edifice.nomad.ancient-forge'
const RAMPART = 'edifice.order.sprawling-rampart'

const finished = (): OathProjectedState =>
    structuredClone(GAME_TWO_FINISHED) as unknown as OathProjectedState

interface Person {
    name: string
    userId?: string
}
const DANA: Person = { name: 'Dana', userId: 'u-dana' }
const RHYS: Person = { name: 'Rhys', userId: 'u-rhys' }
const ANN: Person = { name: 'Ann', userId: 'u-ann' }

/** Game 2's seats: the finished state's players, in its order. */
const GAME_TWO_PEOPLE = [DANA, RHYS, ANN]

function seated(people: readonly Person[], ids: readonly string[]): Player[] {
    return people.map((person, index) => ({
        id: ids[index],
        isHuman: true,
        ...(person.userId !== undefined ? { userId: person.userId } : {}),
        name: person.name,
        status: SeatStatus.Joined
    }))
}

/** The finished game as the platform stores it. */
function sourceOf(previous: OathProjectedState, people: readonly Person[] = GAME_TWO_PEOPLE): Game {
    return testGame([], {
        id: previous.gameId,
        name: 'Thursday table',
        status: GameStatus.Finished,
        hotseat: false,
        players: seated(
            people,
            previous.players.map((player) => player.playerId)
        )
    })
}

const idOf = (person: Person) => `g3-${person.name.toLowerCase()}`

/** Game 3, made by Continue: new ids for everyone. */
function nextGame(people: readonly Person[], config: GameConfig = {}): Game {
    return testGame([], {
        id: 'game-3',
        name: 'Friday table',
        status: GameStatus.WaitingToStart,
        hotseat: false,
        createdAt: new Date('2026-11-05T19:00:00Z'),
        continuedFromGameId: 'game-1',
        players: seated(people, people.map(idOf)),
        config
    })
}

function continuationOf(
    previous: OathProjectedState,
    previousPeople: readonly Person[] = GAME_TWO_PEOPLE
): GameContinuation<OathProjectedState> {
    return captureGameContinuation(
        sourceOf(previous, previousPeople),
        previous,
        Definition as never
    ) as GameContinuation<OathProjectedState>
}

/** The Law's §1.7 example: clockwise from Dana, Ann, then Rhys. */
const SEED = '00000000000000000000000000000001'

/** Game 3 opened through the platform, as Continue opens it. */
function open(
    people: readonly Person[] = [DANA, RHYS, ANN],
    previous: OathProjectedState = finished(),
    seed = SEED,
    previousPeople: readonly Person[] = GAME_TWO_PEOPLE
): OathProjectedState {
    return new GameEngine(Definition.runtime).startGame(nextGame(people), {
        masterSeed: seed,
        continuation: continuationOf(previous, previousPeople)
    }).initialState
}

const hydrated = (state: OathProjectedState) => new HydratedOathGameState(structuredClone(state))
const vaultOf = (state: OathProjectedState) => {
    const vault = state.vault
    if (!vault) throw Error('the host holds the vault')
    return vault
}

describe('The Law’s example — game 3 opens on the world game 2 saved', () => {
    it('R-1.1: the stack dealt slot by slot with its facing; R-8.3.5 step 7’s flip finds a faceup site in every region', () => {
        const state = open()
        const vault = vaultOf(state)
        expect(state.siteCards).toEqual({
            [C1]: site('fertile-valley'),
            [C2]: site('the-tribunal'),
            [P1]: site('mountain'),
            [P2]: site('lush-coast'),
            [H3]: site('steppe')
        })
        expect(vault.siteFacedown).toEqual({
            [P3]: site('buried-giant'),
            [H1]: site('river'),
            [H2]: site('charming-valley')
        })
        expect(state.denizensBySite).toEqual({
            [C1]: [den('hearth.armed-mob'), den('order.curfew')],
            [C2]: [den('order.forced-labor')],
            [P1]: [RAMPART],
            [P2]: [den('nomad.oracle'), den('hearth.hospital'), den('arcane.wizard-school')],
            [H3]: [FORGE]
        })
        expect(state.ruinedEdificeIds).toEqual([FORGE])
        // The site deck is derived: the 15 sites in no slot, shuffled afresh.
        expect(vault.siteDeck).toHaveLength(15)
        expect(vault.siteDeck).not.toContain(site('river'))
    })

    it('R-1.12: two at the top Cradle site, one at each other site with a denizen or an intact edifice, none at a bare ruin', () => {
        const state = open()
        const imperial = (slotId: string) => state.warbandsBySite[slotId]?.[IMPERIAL_WARBANDS] ?? 0
        expect([C1, C2, P1, P2, P3, H1, H2, H3].map(imperial)).toEqual([2, 1, 1, 1, 0, 0, 0, 0])
        const dana = hydrated(state).getPlayerState(idOf(DANA))
        expect(dana.warbandsOnBoard).toEqual({ [IMPERIAL_WARBANDS]: 3 })
        expect(dana.warbandsInPersonalBank).toEqual({ [IMPERIAL_WARBANDS]: 16 })
    })

    it('R-1.13, R-1.14: the Oath Dana vowed, with The People’s Favor and the title', () => {
        const state = open()
        expect(state.oathType).toBe(OathType.ThePeople)
        expect(state.banners[Banner.PeoplesFavor].holderPlayerId).toBe(idOf(DANA))
        expect(state.banners[Banner.DarkestSecret].holderPlayerId).toBeUndefined()
        expect(state.oathkeeperPlayerId).toBe(idOf(DANA))
    })

    it('R-1.17, R-1.18: the Reliquary from the top of the carried relic deck; 13 left, the Grand Mask on top', () => {
        const state = open()
        const vault = vaultOf(state)
        expect(state.reliquary.map((slot) => vault.relicFacedown[slot.slotId])).toEqual(
            ['obsidian-cage', 'dragonskin-drum', 'truthful-harp', 'ring-of-devotion'].map(relic)
        )
        expect(vault.relicDeck).toHaveLength(13)
        expect(vault.relicDeck[0]).toBe(relic('grand-mask'))
        // The sites keep the relics R-8.6.2 gave them; none is drawn again.
        const atSite = (slotId: string) =>
            (state.relicsBySite[slotId] ?? []).map((slot) => vault.relicFacedown[slot.slotId])
        expect([C2, P1, H3].map(atSite)).toEqual([
            [relic('oracular-pig')],
            [relic('ivory-eye')],
            [relic('brass-horse')]
        ])
        expect(Object.keys(state.relicsBySite).sort()).toEqual([C2, H3, P1].sort())
        // R-1.8 — the Grand Scepter, boxed by R-8.6.1, goes to the new Chancellor.
        expect(hydrated(state).getPlayerState(idOf(DANA)).relicIds).toEqual([GRAND_SCEPTER_ID])
    })

    it('R-1.19 to R-1.22: three to the piles and three to each hand from the bottom; 41 left; no Vision drawn', () => {
        const state = open()
        const vault = vaultOf(state)
        expect(vault.discardPiles).toEqual({
            [Region.Cradle]: [den('beast.errand-boy')],
            [Region.Provinces]: [den('beast.wild-cry')],
            [Region.Hinterland]: [den('order.palanquin')]
        })
        const hand = (person: Person) => hydrated(state).getPlayerState(idOf(person)).knownHand()
        expect(state.turnManager.turnOrder).toEqual([idOf(DANA), idOf(ANN), idOf(RHYS)])
        expect(hand(DANA)).toEqual(
            ['beast.forest-paths', 'hearth.traveling-doctor', 'hearth.homesteaders'].map(den)
        )
        expect(hand(ANN)).toEqual(
            ['nomad.horse-archers', 'arcane.tutor', 'arcane.alchemist'].map(den)
        )
        expect(hand(RHYS)).toEqual(
            ['order.outriders', 'nomad.storm-caller', 'hearth.crop-rotation'].map(den)
        )
        expect(vault.worldDeck).toHaveLength(41)
        expect(state.visionsDrawn).toBe(0)
        expect(state.worldDeckVisions).toBe(5)
    })

    it('R-1.7-H1, R-1.9-H1: Dana the Chancellor as game 1’s winner; Rhys keeps red and Ann yellow, both Exiles', () => {
        const state = open()
        const seat = (person: Person) => {
            const player = hydrated(state).getPlayerState(idOf(person))
            return { color: player.color, status: player.status }
        }
        expect(seat(DANA)).toEqual({ color: Color.Purple, status: PlayerStatus.Chancellor })
        expect(seat(RHYS)).toEqual({ color: Color.Red, status: PlayerStatus.Exile })
        expect(seat(ANN)).toEqual({ color: Color.Yellow, status: PlayerStatus.Exile })
        expect(state.openingSeats).toEqual({
            chancellor: {
                playerId: idOf(DANA),
                chosen: OpeningChancellor.Winner,
                gameNumber: 1
            },
            boards: [
                { playerId: idOf(ANN), color: Color.Yellow, side: BoardSide.Exile, kept: true },
                { playerId: idOf(RHYS), color: Color.Red, side: BoardSide.Exile, kept: true }
            ]
        })
        expect(state.boxedCitizenColors).toBeUndefined()
        // R-1.11, R-1.15
        const tokens = (person: Person) => {
            const player = hydrated(state).getPlayerState(idOf(person))
            return [player.favor, player.secrets, player.warbandsOnBoard]
        }
        expect(tokens(DANA)).toEqual([2, 1, { [IMPERIAL_WARBANDS]: 3 }])
        expect(tokens(ANN)).toEqual([1, 1, { [idOf(ANN)]: 3 }])
        expect(tokens(RHYS)).toEqual([1, 1, { [idOf(RHYS)]: 3 }])
        // R-1.16 — no faceup site prompts favor or secrets.
        expect(state.cardTokens).toEqual({})
    })

    it('the world copied in the class it had; the record unchanged; nothing else of game 2 carried', () => {
        const previous = finished()
        const state = open()
        const vault = vaultOf(state)
        expect(state.chronicleRecord).toEqual(previous.chronicleRecord)
        expect(state.table).toEqual({
            name: 'Friday table',
            date: '2026-11-05',
            seatNames: { 'g3-dana': 'Dana', 'g3-rhys': 'Rhys', 'g3-ann': 'Ann' }
        })
        expect(state.chronicle).toBeUndefined()
        expect(state.result).toBeUndefined()
        expect(state.canContinue).toBeUndefined()
        expect(state.boxIds).toEqual([])
        expect(state.dispossessedCount).toBe(12)
        expect(vault.dispossessed).toEqual(vaultOf(previous).dispossessed)
        expect(state.machineState).toBe(MachineState.Setup)
        expect(state.oathRevision).toBe(OathRevision.Chronicle)
        expect(state.round).toBe(1)
        // Knowledge is not carried: what anyone saw starts empty, but for what this game's setup
        // shows — the Grand Scepter's holder knows the Reliquary (R-6.4-H1).
        expect(state.seenRelics).toEqual({})
        expect(state.seenWorldDeckBottom).toEqual([])
        expect(state.seenRelicDeckBottom).toEqual([])
        for (const player of state.players) {
            expect(player.peekedRelicSlotIds).toEqual(
                player.playerId === idOf(DANA) ? state.reliquary.map((slot) => slot.slotId) : []
            )
            expect(player.peekedSiteSlotIds).toEqual([])
            expect(player.knownWorldDeckTop).toEqual([])
            expect(player.knownRelicDeckBottom).toEqual([])
            expect(player.revealedVisionId).toBeUndefined()
        }
        // R-1.12 — the carried world is the only thing on the map but the new garrisons.
        expect(Object.keys(state.warbandsBySite).sort()).toEqual([C1, C2, P1, P2].sort())
    })

    it('the census holds at open: 198 denizens, 5 Visions, 23 sites, 21 relics, 6 edifices', () => {
        expect(openingCensus(hydrated(open()))).toEqual([])
    })
})

describe('the carried sites’ own facts', () => {
    it('R-7-H1 — a Salt the Earth still at its site keeps the site’s capacity in the next game', () => {
        const previous = finished()
        previous.denizensBySite[P2] = [
            den('nomad.oracle'),
            den('hearth.hospital'),
            den('discord.salt-the-earth')
        ]
        previous.siteCapacityOverrides = { [P2]: 1 }
        const state = open([DANA, RHYS, ANN], previous)
        expect(state.siteCapacityOverrides).toEqual({ [P2]: 1 })
        expect(state.denizensBySite[P2]).toContain(den('discord.salt-the-earth'))
        expect(openingCensus(hydrated(state))).toEqual([])
    })

    it('R-1.16 — a carried faceup site gets its reveal prompt’s favor and secrets, as any faceup site does', () => {
        const previous = finished()
        // The Salt Flats in the Tribunal's place, with its denizen and relic.
        previous.siteCards[C2] = site('salt-flats')
        const state = open([DANA, RHYS, ANN], previous)
        expect(state.cardTokens[site('salt-flats')]).toEqual({ favor: 2, secrets: 1 })
        // Its relic stays, though the Salt Flats print none: setup only adds what a site lacks.
        expect(state.relicsBySite[C2]).toHaveLength(1)
        expect(vaultOf(state).siteDeck).toContain(site('the-tribunal'))
        expect(openingCensus(hydrated(state))).toEqual([])
    })
})

describe('through the platform, as Continue opens it', () => {
    it('Oath supports continuation through defineGame’s configured runtime', () => {
        expect(Definition.runtime.initializer.supportsContinuation).toBe(true)
    })

    it('hosted: each player matched by account, whatever their id or place in the list', () => {
        const state = open([ANN, RHYS, DANA])
        expect(state.openingSeats?.chancellor.playerId).toBe(idOf(DANA))
        const colors = Object.fromEntries(state.players.map((p) => [p.playerId, p.color]))
        expect(colors).toEqual({
            [idOf(DANA)]: Color.Purple,
            [idOf(RHYS)]: Color.Red,
            [idOf(ANN)]: Color.Yellow
        })
        expect(openingCensus(hydrated(state))).toEqual([])
    })

    it('local: every seat on the owner’s account, the stored state through JSON — matched by name', () => {
        const owner = 'u-owner'
        const local = (person: Person): Person => ({ name: person.name, userId: owner })
        const previous = JSON.parse(JSON.stringify(finished())) as OathProjectedState
        const state = open(
            [local(RHYS), local(ANN), local(DANA)],
            previous,
            SEED,
            GAME_TWO_PEOPLE.map(local)
        )
        expect(state.openingSeats?.chancellor).toEqual({
            playerId: idOf(DANA),
            chosen: OpeningChancellor.Winner,
            gameNumber: 1
        })
        expect(state.openingSeats?.boards.map((b) => [b.playerId, b.color, b.kept])).toEqual(
            expect.arrayContaining([
                [idOf(RHYS), Color.Red, true],
                [idOf(ANN), Color.Yellow, true]
            ])
        )
        expect(openingCensus(hydrated(state))).toEqual([])
    })

    it('a finished game below the chronicle revision never set canContinue: refused', () => {
        const previous = finished()
        previous.oathRevision = OathRevision.Chronicle - 1
        delete previous.canContinue
        expect(() => continuationOf(previous)).toThrow(GameContinuationError)
        expect(() => continuationOf(previous)).toThrow('not ready to continue')
    })

    it('a called game has a result and no canContinue: refused', () => {
        const previous = finished()
        delete previous.canContinue
        expect(() => continuationOf(previous)).toThrow('not ready to continue')
    })

    it('a game that has not finished: refused', () => {
        const previous = finished()
        delete previous.result
        delete previous.canContinue
        expect(() => continuationOf(previous)).toThrow('not ready to continue')
    })

    it('without supportsContinuation the platform refuses to continue', () => {
        const runtime = {
            ...Definition.runtime,
            initializer: { ...Definition.runtime.initializer, supportsContinuation: undefined }
        }
        expect(() =>
            new GameEngine(runtime as never).validateContinuation('game-1', {
                previousState: finished(),
                previousPlayers: sourceOf(finished()).players
            })
        ).toThrow('does not support continuation')
    })

    it('R-8.1 — a continued game plays the vowed Oath, whatever Oath its copied config names', () => {
        // The state's own id is drawn fresh at every start; everything else is set up from the seed.
        const start = (config: GameConfig) => ({
            ...new GameEngine(Definition.runtime).startGame(nextGame([DANA, RHYS, ANN], config), {
                masterSeed: SEED,
                continuation: continuationOf(finished())
            }).initialState,
            id: 'state'
        })
        const withoutConfig = start({})
        expect(withoutConfig.oathType).toBe(OathType.ThePeople)
        for (const oathType of Object.values(OathType)) {
            expect(start({ setupVariant: SetupVariant.Randomized, oathType })).toEqual(
                withoutConfig
            )
        }
        expect(start({ setupVariant: SetupVariant.Curated })).toEqual(withoutConfig)
    })

    it('Continue pressed twice makes two independent games', () => {
        const continuation = continuationOf(finished())
        const start = () =>
            new GameEngine(Definition.runtime).startGame(nextGame([DANA, RHYS, ANN]), {
                masterSeed: SEED,
                continuation
            }).initialState
        const first = start()
        first.players[0].favor = 99
        expect(start().players[0].favor).not.toBe(99)
        expect(vaultOf(start()).worldDeck).toHaveLength(41)
    })
})

describe('the initializer’s own refusals (a direct call; the platform makes these unreachable)', () => {
    const call = (previous: OathProjectedState, assignment?: { playerIds: string[] }) =>
        new OathGameInitializer().initializeGameState(
            nextGame([DANA, RHYS, ANN]),
            {
                id: 'state-3',
                gameId: 'game-3',
                activePlayerIds: [],
                actionCount: 0,
                actionChecksum: 0,
                prng: { seed: 1, invocations: 0 },
                winningPlayerIds: []
            },
            assignment,
            { previousState: previous, previousPlayers: sourceOf(previous).players }
        )

    it('a state below the chronicle revision', () => {
        const previous = finished()
        previous.oathRevision = OathRevision.Chronicle - 1
        expect(() => call(previous)).toThrow('predates the chronicle')
    })

    it('a chronicle that never vowed or never rebuilt', () => {
        const previous = finished()
        delete previous.chronicle
        expect(() => call(previous)).toThrow('no chronicle that vowed an Oath')
    })

    it('a chronicle with a step still open', () => {
        const previous = finished()
        if (previous.chronicle) previous.chronicle.step = 'story' as never
        expect(() => call(previous)).toThrow('still at its story step')
    })

    it('a state handed over without its vault', () => {
        const previous = finished()
        delete previous.vault
        expect(() => call(previous)).toThrow('without its hidden cards')
    })

    it('a starting-position assignment: R-1.7-H1 decides the Chancellor', () => {
        expect(() => call(finished(), { playerIds: [idOf(RHYS), idOf(ANN), idOf(DANA)] })).toThrow(
            'cannot be assigned'
        )
    })
})

describe('the pinned finished state', () => {
    it('still validates, and continues', () => {
        const pinned = finished()
        expect(() =>
            new GameEngine(Definition.runtime).validateCanonicalState(pinned)
        ).not.toThrow()
        expect(open().openingSeats).toBeDefined()
    })
})

// ---------------------------------------------------------------------------------------------
// The seats and boards (R-1.7-H1, R-1.9-H1): game 2's world, with the people and statuses of each
// scene. Colours dealt at random are pinned by the seed each scene names.

interface SeatScene {
    /** The finished game's seats, in its order: id, colour, status. */
    seats: [string, Color, PlayerStatus][]
    winner: string
    gameNumber?: number
    boxed?: Color[]
}

/** The pinned world, with the seats, winner and box of a scene. */
function sceneOf(scene: SeatScene): OathProjectedState {
    const previous = finished()
    const template = previous.players[0]
    previous.players = scene.seats.map(([playerId, color, status]) => ({
        ...structuredClone(template),
        playerId,
        color,
        status
    }))
    previous.turnManager = {
        ...previous.turnManager,
        turnOrder: scene.seats.map(([id]) => id),
        turnCounts: Object.fromEntries(scene.seats.map(([id]) => [id, 0]))
    }
    const chancellor = scene.seats.find(([, , status]) => status === PlayerStatus.Chancellor)
    previous.chancellorPlayerId = chancellor?.[0]
    if (previous.chronicle) {
        previous.chronicle.ending.winnerPlayerId = scene.winner
        previous.winningPlayerIds = [scene.winner]
    }
    const record = previous.chronicleRecord as ChronicleEntry[]
    const last = record[record.length - 1]
    record[record.length - 1] = { ...last, gameNumber: scene.gameNumber ?? 1 }
    if (scene.boxed) previous.boxedCitizenColors = scene.boxed
    previous.table = {
        ...(previous.table as NonNullable<OathProjectedState['table']>),
        seatNames: Object.fromEntries(scene.seats.map(([id]) => [id, id]))
    }
    return previous
}

const people = (...names: string[]) => names.map((name) => ({ name, userId: `u-${name}` }))
const opened = (scene: SeatScene, at: Person[], seed = SEED) =>
    open(
        at,
        sceneOf(scene),
        seed,
        scene.seats.map(([id]) => ({ name: id, userId: `u-${id}` }))
    )
const g3 = (name: string) => `g3-${name.toLowerCase()}`
const boardsOf = (state: OathProjectedState) =>
    state.openingSeats?.boards.map(
        (b) => `${b.playerId} ${b.color} ${b.side} ${b.kept ? 'kept' : 'dealt'}`
    )

describe('R-1.7-H1, R-1.9-H1 — the seats and boards as a continued game opens', () => {
    /** Game 1: Rhys the Chancellor; Dana won as Usurper; Ann accepted Citizenship. */
    const GAME_ONE: SeatScene = {
        seats: [
            ['dana', Color.Red, PlayerStatus.Exile],
            ['rhys', Color.Purple, PlayerStatus.Chancellor],
            ['ann', Color.Blue, PlayerStatus.Citizen]
        ],
        winner: 'dana',
        gameNumber: 1
    }

    it('game 2 from game 1: Dana the Chancellor as its winner; Ann keeps blue on its Citizen side; Rhys is dealt red', () => {
        const state = opened(GAME_ONE, people('dana', 'rhys', 'ann'), GAME_TWO_SEED)
        expect(state.openingSeats?.chancellor).toEqual({
            playerId: g3('dana'),
            chosen: OpeningChancellor.Winner,
            gameNumber: 1
        })
        expect(boardsOf(state)).toEqual(
            expect.arrayContaining([
                `${g3('ann')} blue citizen kept`,
                `${g3('rhys')} red exile dealt`
            ])
        )
        // R-1.15 — a Citizen: their own 14 in the bank, 3 purple warbands on the board.
        const ann = hydrated(state).getPlayerState(g3('ann'))
        expect(ann.status).toBe(PlayerStatus.Citizen)
        expect(ann.warbandsInPersonalBank).toEqual({ [g3('ann')]: 14 })
        expect(ann.warbandsOnBoard).toEqual({ [IMPERIAL_WARBANDS]: 3 })
        expect([ann.favor, ann.secrets]).toEqual([1, 1])
        // R-1.12 then R-1.15: 24 less 3 on Dana's board, 5 at the sites, 3 on Ann's.
        expect(
            hydrated(state).getPlayerState(g3('dana')).warbandsInPersonalBank[IMPERIAL_WARBANDS]
        ).toBe(13)
        expect(openingCensus(hydrated(state))).toEqual([])
    })

    /** Game 2: Dana the Chancellor, Ann (blue) a Citizen who won as Successor, Rhys red. */
    const GAME_TWO: SeatScene = {
        seats: [
            ['dana', Color.Purple, PlayerStatus.Chancellor],
            ['rhys', Color.Red, PlayerStatus.Exile],
            ['ann', Color.Blue, PlayerStatus.Citizen]
        ],
        winner: 'ann',
        gameNumber: 2
    }

    it('game 3 from game 2, Rhys gone and Bea new: Ann the Chancellor; Dana dealt blue, a Citizen; Bea dealt yellow', () => {
        const state = opened(GAME_TWO, people('ann', 'dana', 'bea'), GAME_THREE_SEED)
        expect(state.openingSeats?.chancellor).toEqual({
            playerId: g3('ann'),
            chosen: OpeningChancellor.Winner,
            gameNumber: 2
        })
        expect(state.turnManager.turnOrder).toEqual([g3('ann'), g3('dana'), g3('bea')])
        expect(boardsOf(state)).toEqual([
            `${g3('dana')} blue citizen dealt`,
            `${g3('bea')} yellow exile dealt`
        ])
        expect(hydrated(state).getPlayerState(g3('dana')).status).toBe(PlayerStatus.Citizen)
        expect(state.boxedCitizenColors).toBeUndefined()
        expect(openingCensus(hydrated(state))).toEqual([])
    })

    it('the winner absent, two Citizens returning: the Chancellor is drawn between them', () => {
        const scene: SeatScene = {
            seats: [
                ['dana', Color.Purple, PlayerStatus.Chancellor],
                ['rhys', Color.Red, PlayerStatus.Citizen],
                ['ann', Color.Blue, PlayerStatus.Citizen]
            ],
            winner: 'dana'
        }
        const chancellors = new Set(
            ['01', '02', '03', '04', '05', '06'].map((seed) => {
                const state = opened(scene, people('rhys', 'ann', 'bea'), seed.padStart(32, '0'))
                expect(state.openingSeats?.chancellor.chosen).toBe(OpeningChancellor.Citizen)
                return state.openingSeats?.chancellor.playerId
            })
        )
        expect(chancellors).toEqual(new Set([g3('rhys'), g3('ann')]))
    })

    it('the winner absent and no Citizen returning: a player at random', () => {
        const scene: SeatScene = {
            seats: [
                ['dana', Color.Purple, PlayerStatus.Chancellor],
                ['rhys', Color.Red, PlayerStatus.Exile],
                ['ann', Color.Blue, PlayerStatus.Citizen]
            ],
            winner: 'dana'
        }
        const chancellors = new Set(
            ['01', '02', '03', '04', '05', '06', '07', '08'].map((seed) => {
                const state = opened(scene, people('rhys', 'bea', 'eli'), seed.padStart(32, '0'))
                expect(state.openingSeats?.chancellor.chosen).toBe(OpeningChancellor.Random)
                expect(state.openingSeats?.chancellor.gameNumber).toBeUndefined()
                return state.openingSeats?.chancellor.playerId
            })
        )
        expect(chancellors.size).toBeGreaterThan(1)
    })

    it('a winner who was a Citizen or an Exile is Chancellor; their colour is a free board on its saved side', () => {
        // Game 1's Dana, an Exile Usurper: red is free, on its Exile side.
        const fromExile = opened(GAME_ONE, people('dana', 'ann', 'bea'))
        expect(fromExile.openingSeats?.chancellor.playerId).toBe(g3('dana'))
        expect(fromExile.openingSeats?.boards.find((b) => b.playerId === g3('ann'))).toMatchObject({
            color: Color.Blue,
            side: BoardSide.Citizen,
            kept: true
        })
        // Game 2's Ann, a Citizen: blue is free, on its Citizen side; nobody takes it, so it is boxed.
        const fromCitizen = opened(GAME_TWO, people('ann', 'rhys', 'bea'), BOX_BLUE_SEED)
        expect(fromCitizen.openingSeats?.chancellor.playerId).toBe(g3('ann'))
        expect(fromCitizen.openingSeats?.boards.map((b) => b.color)).not.toContain(Color.Blue)
        expect(fromCitizen.boxedCitizenColors).toEqual([Color.Blue])
    })

    it('a Citizen who refused the winner’s offer was flipped to Exile (R-8.2): their board is kept on its Exile side', () => {
        const scene: SeatScene = {
            seats: [
                ['dana', Color.Red, PlayerStatus.Exile],
                ['rhys', Color.Purple, PlayerStatus.Chancellor],
                ['ann', Color.Blue, PlayerStatus.Exile]
            ],
            winner: 'dana'
        }
        const state = opened(scene, people('dana', 'rhys', 'ann'))
        expect(state.openingSeats?.boards.find((b) => b.playerId === g3('ann'))).toMatchObject({
            color: Color.Blue,
            side: BoardSide.Exile,
            kept: true
        })
    })

    it('six seats: the Chancellor and five boards, every colour taken', () => {
        const state = opened(GAME_TWO, people('ann', 'dana', 'rhys', 'bea', 'eli', 'fay'))
        const boards = state.openingSeats?.boards ?? []
        expect(boards).toHaveLength(5)
        expect(new Set(boards.map((b) => b.color))).toEqual(
            new Set([Color.White, Color.Yellow, Color.Blue, Color.Red, Color.Black])
        )
        expect(boards.find((b) => b.playerId === g3('rhys'))).toMatchObject({
            color: Color.Red,
            kept: true
        })
        expect(boards.find((b) => b.color === Color.Blue)?.side).toBe(BoardSide.Citizen)
        expect(state.boxedCitizenColors).toBeUndefined()
        expect(openingCensus(hydrated(state))).toEqual([])
    })

    it('a Citizen board in the box, dealt to a newcomer, makes them a Citizen', () => {
        const scene = { ...GAME_TWO, boxed: [Color.White] }
        const state = opened(scene, people('ann', 'dana', 'bea'), BOXED_WHITE_SEED)
        const bea = state.openingSeats?.boards.find((b) => b.playerId === g3('bea'))
        expect(bea).toEqual({
            playerId: g3('bea'),
            color: Color.White,
            side: BoardSide.Citizen,
            kept: false
        })
        expect(hydrated(state).getPlayerState(g3('bea')).status).toBe(PlayerStatus.Citizen)
        expect(state.boxedCitizenColors).toEqual([Color.Blue])
    })

    it('R-9.3 — the Imperial bank runs short of the Citizens’ purple warbands: the last takes what is left', () => {
        // Every slot faceup with a denizen, and every board in the box on its Citizen side.
        const previous = sceneOf({
            ...GAME_TWO,
            boxed: [Color.White, Color.Yellow, Color.Red, Color.Black]
        })
        const vault = vaultOf(previous)
        const moved = vault.worldDeck.splice(-3, 3)
        for (const [i, slotId] of [P3, H1, H2].entries()) {
            previous.siteCards[slotId] = vault.siteFacedown[slotId]
            delete vault.siteFacedown[slotId]
            previous.denizensBySite[slotId] = [moved[i]]
        }
        const state = open(
            people('ann', 'dana', 'rhys', 'bea', 'eli', 'fay'),
            previous,
            SEED,
            GAME_TWO.seats.map(([id]) => ({ name: id, userId: `u-${id}` }))
        )
        const s = hydrated(state)
        // 24, less 3 on Ann's board, 2 at the top Cradle site and 1 at each of the other six.
        const purple = state.turnManager.turnOrder
            .slice(1)
            .map((id) => s.getPlayerState(id).warbandsOnBoard[IMPERIAL_WARBANDS] ?? 0)
        expect(purple).toEqual([3, 3, 3, 3, 1])
        expect(s.getPlayerState(g3('ann')).warbandsInPersonalBank[IMPERIAL_WARBANDS]).toBe(0)
        expect(openingCensus(s)).toEqual([])
    })
})

// Seeds pinning the colours each scene names (found by trying seeds in order).
const GAME_TWO_SEED = '00000000000000000000000000000002'
const GAME_THREE_SEED = '0000000000000000000000000000003f'
const BOX_BLUE_SEED = '00000000000000000000000000000001'
const BOXED_WHITE_SEED = '00000000000000000000000000000001'

// ---------------------------------------------------------------------------------------------

describe('R-1.19 to R-1.22, read as written — a continued game’s setup reaches a Vision, and deals it as the Law says', () => {
    /**
     * Three earlier games each healed from a stack of one (R-8.4.a, R-9.3), so 15 fewer denizens
     * circulate (R-8.5) and the rebuilt deck's denizen-only bottom holds 8: setup's 12 draws reach
     * the 18-card pile, whose bottom card R-8.8's shuffle made the Vision of Sanctuary.
     */
    function shortWorld(): OathProjectedState {
        const previous = finished()
        const vault = vaultOf(previous)
        vault.worldDeck.splice(30, 15)
        const second = vault.worldDeck.splice(12, 18)
        const sanctuary = second.splice(second.indexOf('vision.sanctuary'), 1)
        vault.worldDeck.splice(12, 0, ...second, ...sanctuary)
        const record = previous.chronicleRecord as ChronicleEntry[]
        const own = record[0]
        const healed = (gameNumber: number): ChronicleEntry => ({
            ...own,
            gameNumber,
            kind: WinKind.StableRegime,
            nextOath: OathType.Supremacy,
            added: { heal: { suit: own.added?.suits?.[0] ?? ('hearth' as never), count: 1 } }
        })
        previous.chronicleRecord = [healed(1), healed(2), healed(3), { ...own, gameNumber: 4 }]
        return previous
    }

    it('Ann’s third card is the Vision: Visions Drawn advances, the deck counts four', () => {
        const state = open([DANA, RHYS, ANN], shortWorld())
        const s = hydrated(state)
        expect(vaultOf(state).worldDeck).toHaveLength(38 - 12)
        expect(s.getPlayerState(idOf(ANN)).knownHand()).toContain('vision.sanctuary')
        expect(state.visionsDrawn).toBe(1)
        expect(state.worldDeckVisions).toBe(4)
        expect(openingCensus(s)).toEqual([])
    })

    it('R-1.23: Ann may keep the Vision as their facedown adviser, or discard it', () => {
        const state = open([DANA, RHYS, ANN], shortWorld())
        const game = nextGame([DANA, RHYS, ANN])
        const dana = hydrated(state).getPlayerState(idOf(DANA)).knownHand()
        let current = engine.runNext(
            buildAction(SetupChoice, {
                gameId: 'game-3',
                playerId: idOf(DANA),
                siteId: TOP_CRADLE_SLOT,
                adviserCardId: dana[0],
                discardOrder: [dana[1], dana[2]]
            }),
            state,
            game
        ).updatedState
        const hand = hydrated(current).getPlayerState(idOf(ANN)).knownHand()
        const others = hand.filter((cardId) => cardId !== 'vision.sanctuary')
        const keep = buildAction(SetupChoice, {
            gameId: 'game-3',
            playerId: idOf(ANN),
            siteId: P2,
            adviserCardId: 'vision.sanctuary',
            discardOrder: others
        })
        const kept = engine.runNext(keep, current, game).updatedState
        expect(kept.players.find((p) => p.playerId === idOf(ANN))?.advisers).toEqual([
            { faceUp: false, vision: true }
        ])
        const discard = buildAction(SetupChoice, {
            gameId: 'game-3',
            playerId: idOf(ANN),
            siteId: P2,
            adviserCardId: others[0],
            discardOrder: [others[1], 'vision.sanctuary']
        })
        current = engine.runNext(discard, current, game).updatedState
        // From the Provinces, R-10.5 discards to the Hinterland's pile; the Vision shows its back on top.
        expect(current.discardTopBackType[Region.Hinterland]).toBe(CardKind.Vision)
        expect(current.discardPileCounts[Region.Hinterland]).toBe(3)
        // R-2.7.1 — a discard is not a draw: the marker and the deck's count stay.
        expect([current.visionsDrawn, current.worldDeckVisions]).toEqual([1, 4])
    })
})

// ---------------------------------------------------------------------------------------------

describe('hidden information at open (R-9.4)', () => {
    const SEATS = [idOf(DANA), idOf(ANN), idOf(RHYS)]
    const views = (state: OathProjectedState) => [
        ...SEATS.map((playerId) => served(state, { kind: 'player', playerId })),
        served(state, spectator)
    ]

    it('every seat and the spectator are served the same opening seats, record, table, map and counts', () => {
        const state = open()
        const publicOf = (view: OathProjectedState) => ({
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
            handCounts: view.players.map((p) => p.handCount)
        })
        const [first, ...rest] = views(state).map(publicOf)
        for (const view of rest) expect(view).toEqual(first)
        expect(first.openingSeats).toEqual(state.openingSeats)
    })

    it('no served view holds the vault or a carried hidden card', () => {
        const state = open()
        const vault = vaultOf(state)
        const reliquary = state.reliquary.map((slot) => vault.relicFacedown[slot.slotId])
        const hidden = [
            ...Object.values(vault.siteFacedown),
            ...vault.dispossessed,
            ...vault.relicDeck,
            ...Object.values(vault.relicFacedown),
            ...vault.worldDeck,
            ...Object.values(vault.discardPiles).flat()
        ]
        for (const [index, view] of views(state).entries()) {
            expect(view.vault).toBeUndefined()
            const json = JSON.stringify(view)
            // Dana, the first seat, holds the Grand Scepter and so knows the Reliquary (R-6.4-H1).
            const unknown = index === 0 ? hidden.filter((id) => !reliquary.includes(id)) : hidden
            for (const cardId of unknown) expect(json).not.toContain(`"${cardId}"`)
        }
    })

    it('the setup choice’s check runs on each seat’s projected state', () => {
        const state = open()
        const dana = served(state, { kind: 'player', playerId: idOf(DANA) })
        const own = hydrated(dana)
        const hand = own.getPlayerState(idOf(DANA)).knownHand()
        expect(
            reasonCannotSetupChoice(own, idOf(DANA), {
                siteId: TOP_CRADLE_SLOT,
                adviserCardId: hand[0],
                discardOrder: [hand[1], hand[2]]
            })
        ).toBeUndefined()
        // Ann's view holds Dana's hand as a count only.
        const ann = hydrated(served(state, { kind: 'player', playerId: idOf(ANN) }))
        expect(ann.getPlayerState(idOf(DANA)).handIds).toBeUndefined()
    })

    it('an exploration from a seat’s view deals only what that seat cannot see, with no suit quota', () => {
        const state = open()
        const view = served(state, { kind: 'player', playerId: idOf(ANN) })
        const explored = new OathGameExploration().createFromProjectedState({
            state: view,
            random: () => 0.5
        } as never)
        const s = hydrated(explored)
        // What Ann sees stays where it is; the rest is dealt to the public counts.
        expect(s.getPlayerState(idOf(ANN)).knownHand()).toEqual(
            hydrated(state).getPlayerState(idOf(ANN)).knownHand()
        )
        expect(explored.siteCards).toEqual(state.siteCards)
        expect(explored.denizensBySite).toEqual(state.denizensBySite)
        expect(vaultOf(explored).worldDeck).toHaveLength(41)
        expect(vaultOf(explored).dispossessed).toHaveLength(12)
        expect(openingCensus(s)).toEqual([])
    })
})

describe('undo at open (R-X.3)', () => {
    it('the opening has nothing to undo; the first setup choice undoes as a first game’s does', () => {
        const state = open()
        expect(state.actionCount).toBe(0)
        const choose = (from: OathProjectedState, game: Game, playerId: string) => {
            const hand = hydrated(from).getPlayerState(playerId).knownHand()
            return engine.runNext(
                buildAction(SetupChoice, {
                    gameId: from.gameId,
                    playerId,
                    siteId: TOP_CRADLE_SLOT,
                    adviserCardId: hand[0],
                    discardOrder: [hand[1], hand[2]]
                }),
                from,
                game
            )
        }
        const continued = choose(state, nextGame([DANA, RHYS, ANN]), idOf(DANA))
        const firstGame = testGame(seatIds(3), { status: GameStatus.WaitingToStart })
        const first = engine.startGame(firstGame, { masterSeed: SEED })
        const firstChoice = choose(
            first.initialState,
            first.startedGame,
            first.initialState.turnManager.turnOrder[0]
        )
        expect(latestPlayerUndoTarget(continued.processedActions, idOf(DANA))?.type).toEqual(
            latestPlayerUndoTarget(
                firstChoice.processedActions,
                first.initialState.turnManager.turnOrder[0]
            )?.type
        )
        expect(continued.processedActions[0].revealsInfo).toBe(
            firstChoice.processedActions[0].revealsInfo
        )
    })
})
