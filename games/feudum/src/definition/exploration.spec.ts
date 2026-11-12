import {
    assertExists,
    deriveGameSeeds,
    ExplorationHistory,
    GameEngine,
    getPrng,
    type Visibility
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { HandSize } from '../actions/finaliseHand.js'
import { Spaces } from '../data/board.js'
import { ActionCards } from '../data/cards.js'
import { ScrollSpaces } from '../data/guilds.js'
import { EpochLandscapes, RegionTiles, TileEpochs } from '../data/regionTiles.js'
import { Seals } from '../data/seals.js'
import { Charters, RoyalWrits, type WritId } from '../data/writs.js'
import { FeudumCanonicalStateValidator } from '../model/canonicalValidator.js'
import type { FeudumGameState, FeudumProjectedState } from '../model/gameState.js'
import { chickenBeads } from '../model/guildsState.js'
import { placeMarker } from '../model/locationControl.js'
import { flipSeal, immunityKey, moveConcealedSeal } from '../model/seals.js'
import { drawWrits, putWritsUnderInView, putWritsUnderUnseen } from '../model/writDeck.js'
import { Charter, tableInWindow } from '../testing/atWill.js'
import { Battlefield, buildFeudum, holdWrit } from '../testing/combat.js'
import { setPawns } from '../testing/guilds.js'
import { giveSeal } from '../testing/improving.js'
import {
    canonical,
    concealedSeals,
    perspectivesOf,
    processedOf,
    realGames,
    recordFor,
    seedOf,
    Spectator,
    started,
    viewOf
} from '../testing/protected.js'
import { walkFrom, type GameWalk } from '../testing/walk.js'
import { FeudumRuntime } from './runtime.js'
import { MachineState } from './states.js'

const engine = new GameEngine(FeudumRuntime)
const history = new ExplorationHistory(engine)

type Tabled = Pick<GameWalk, 'game'>

/**
 * R-5.1 What the shared client does before population, with the branch's fresh streams pinned so a
 * spec plays the same branch every run.
 */
function prepared(state: FeudumProjectedState, stream = 7): FeudumProjectedState {
    const branch = history.prepareState(structuredClone(state))
    branch.prng = { seed: stream, invocations: 0 }
    branch.protectedPrng = {
        algorithm: 'chacha20-v1',
        seed: deriveGameSeeds(seedOf(stream)).protectedSeed,
        invocations: 0
    }
    return branch
}

function explore(
    source: FeudumProjectedState,
    perspective: Visibility.Perspective,
    tabled: Tabled,
    sample = 1
): FeudumGameState {
    return canonical(
        FeudumRuntime.exploration.createFromProjectedState({
            game: started(tabled),
            state: prepared(viewOf(source, perspective, tabled)),
            actions: [],
            perspective,
            random: getPrng(sample)
        })
    )
}

function reshuffled(source: FeudumProjectedState, stream = 7): FeudumGameState {
    return canonical(FeudumRuntime.exploration.createFromCanonicalState(prepared(source, stream)))
}

/** The projection less the streams, which every branch replaces. */
function tableIn(state: FeudumProjectedState, perspective: Visibility.Perspective, tabled: Tabled) {
    const { prng: _prng, protectedPrng: _protected, ...table } = viewOf(state, perspective, tabled)
    return table
}

function explorerOf(perspective: Visibility.Perspective): string | undefined {
    return perspective.kind === 'player' ? perspective.playerId : undefined
}

function sorted<T extends string>(values: readonly T[]): T[] {
    return [...values].sort()
}

/** R-5.1 Everywhere a writ can lie. */
function everyWrit(state: FeudumGameState): WritId[] {
    return [
        ...state.vault.writDeck.map(({ writId }) => writId),
        ...state.players.flatMap((player) => [...player.writs, ...player.sealedCharters]),
        ...(state.flow.writDraw?.drawn ?? [])
    ]
}

/** R-5-H1 Everywhere a seal can lie: concealed, or a bead. */
function everySeal(state: FeudumGameState): string[] {
    const { farmer, monk } = state.guilds
    return [
        ...concealedSeals(state.vault),
        ...state.players.flatMap((player) => player.beads),
        ...chickenBeads(farmer),
        ...monk.rosary
    ]
}

function immuneMarkers(state: FeudumGameState): string[] {
    return Spaces.flatMap(({ id }) => {
        const { ruler, serf } = state.spaces[id]
        return [
            ...(ruler?.subjectImmune ? [immunityKey(id, 'subject')] : []),
            ...(serf?.immune ? [immunityKey(id, 'serf')] : [])
        ]
    })
}

/** R-5.1 Which deck slots this seat, or everyone's own and the table's, can place. */
function knownSlots(state: FeudumGameState, seats: readonly string[]) {
    return [
        ...state.publicDeckWrits,
        ...state.players
            .filter(({ playerId }) => seats.includes(playerId))
            .flatMap((player) => player.deckKnowledge)
    ]
}

/** Every hidden value in its place, each writ and seal once, by what `perspective` was shown. */
function expectDealtWithin(
    source: FeudumProjectedState,
    branch: FeudumGameState,
    perspective: Visibility.Perspective,
    tabled: Tabled
) {
    const explorer = explorerOf(perspective)
    expect(() => engine.validateCanonicalState(branch)).not.toThrow()
    expect(FeudumCanonicalStateValidator.Check(branch)).toBe(true)
    expect(branch).not.toHaveProperty('masterSeed')

    // R-5.1 Everything the projection names is kept, down to the explorer's own knowledge.
    expect(tableIn(branch, perspective, tabled)).toEqual(tableIn(source, perspective, tabled))

    for (const player of branch.players.filter(({ playerId }) => playerId !== explorer)) {
        // R-3.1, R-3.2 A hand of different kinds, none of them played this round; one finalised
        // before the reveal is of untold size, so it is dealt with no pouch (R-3.1-H1).
        const played = player.played.map(({ kind }) => kind)
        const size = branch.flow.selection?.finalised.includes(player.playerId)
            ? HandSize
            : player.handCount
        expect(player.hand).toHaveLength(size)
        expect(new Set(player.hand).size).toBe(size)
        expect(player).not.toHaveProperty('committedPouch')
        expect(player.hand.filter((kind) => played.includes(kind))).toEqual([])
        expect(player.hand.every((kind) => ActionCards.some((card) => card.kind === kind))).toBe(
            true
        )
        // R-4.4.3, R-4.4.4 `writCount` includes sealed charters, and only a charter is sealed.
        expect(player.writs).toHaveLength(player.writCount - player.sealedCharterCount)
        expect(player.sealedCharters).toHaveLength(player.sealedCharterCount)
        expect(
            player.sealedCharters.every((writId) => Charters.some(({ id }) => id === writId))
        ).toBe(true)
        // R-4.4.1 The projection doesn't say what they saw.
        expect(player.deckKnowledge).toEqual([])
    }

    // R-3.10 A pending draw holds what it counts.
    const { writDraw } = branch.flow
    if (writDraw) {
        expect(writDraw.drawn).toHaveLength(writDraw.drawnCount)
    }

    // R-5.1 Each writ once, and the deck by slot from `top` to `nextBottom`.
    expect(sorted(everyWrit(branch))).toEqual(sorted(RoyalWrits.map(({ id }) => id)))
    expect(branch.vault.writDeck.map(({ slot }) => slot)).toEqual(
        Array.from(
            { length: branch.writDeck.nextBottom - branch.writDeck.top },
            (_, index) => branch.writDeck.top + index
        )
    )
    for (const known of knownSlots(branch, explorer ? [explorer] : [])) {
        expect(branch.vault.writDeck).toContainEqual(known)
    }

    // R-5-H1 Each seal once, and every place holds what public state counts.
    expect(sorted(everySeal(branch))).toEqual(sorted(Seals.map(({ id }) => id)))
    expect(branch.vault.sealPile).toHaveLength(branch.supply.sealPileCount)
    expect(sorted(Object.keys(branch.vault.scrollSeals))).toEqual(
        sorted(ScrollSpaces.filter(({ id }) => branch.guilds.noble.scrolls[id]).map(({ id }) => id))
    )
    expect(sorted(Object.keys(branch.vault.immunitySeals))).toEqual(sorted(immuneMarkers(branch)))
    for (const player of branch.players) {
        expect(branch.vault.heldSeals[player.playerId]).toHaveLength(player.sealCount)
        expect(branch.vault.charterSeals[player.playerId]).toHaveLength(player.sealedCharterCount)
    }

    // R-1.4-H2 Each tile in a stack has a landscape left in its epoch's printed mix.
    for (const tile of RegionTiles) {
        expect(
            Object.hasOwn(branch.vault.tileLandscapes, tile.id) !==
                Object.hasOwn(branch.tileLandscapes, tile.id)
        ).toBe(true)
    }
    for (const epoch of TileEpochs) {
        const landscapes = { ...branch.vault.tileLandscapes, ...branch.tileLandscapes }
        expect(
            sorted(
                RegionTiles.filter((tile) => tile.epoch === epoch).map(
                    (tile) => landscapes[tile.id]
                )
            )
        ).toEqual(sorted(EpochLandscapes[epoch]))
    }
}

/** The states a seat could explore from: a selected cascade always runs to its end first. */
function positionsOf(walk: GameWalk): FeudumProjectedState[] {
    return walk.steps.map(({ after }) => after[after.length - 1])
}

interface Scene {
    readonly name: string
    at(state: FeudumProjectedState): boolean
}

const Scenes: readonly Scene[] = [
    {
        name: 'hand selection',
        at: ({ machineState, flow }) =>
            machineState === MachineState.SelectingHands &&
            (flow.selection?.finalised.length ?? 0) > 0
    },
    {
        name: 'a pending writ draw',
        at: ({ machineState }) => machineState === MachineState.KeepingWrits
    },
    {
        name: 'an attack awaiting defence',
        at: ({ machineState }) => machineState === MachineState.AwaitingDefence
    },
    {
        name: 'a later epoch',
        at: ({ machineState, epoch, players }) =>
            machineState === MachineState.PlayingCards &&
            epoch >= 3 &&
            players.some(({ played }) => played.length > 0)
    },
    {
        name: 'final scoring',
        at: ({ machineState }) => machineState === MachineState.EndOfGame
    }
]

const Games = realGames()

/** The scene in each real game that reaches it, each with the game it came from. */
function sourcesOf(scene: Scene): { walk: GameWalk; source: FeudumProjectedState }[] {
    return Games.flatMap((walk) => {
        const source = positionsOf(walk).find((state) => scene.at(state))
        return source ? [{ walk, source }] : []
    })
}

/** A table with a seal in every place one can lie, known writs under the deck and a bead shown. */
function tableWithEveryPlace() {
    let holder = ''
    const { table, playerId } = tableInWindow('before a card', (state, seat) => {
        const other = state.turnManager.turnOrder.find((id) => id !== seat) ?? ''
        holder = other

        giveSeal(state, seat)
        flipSeal(state, { kind: 'pile' }, { kind: 'player', playerId: seat })

        const free = ScrollSpaces.find(({ id }) => !state.guilds.noble.scrolls[id])
        assertExists(free, 'A scroll space is free')
        moveConcealedSeal(state, { kind: 'pile' }, { kind: 'scroll', spaceId: free.id })

        holdWrit(state, other, Charter)
        const holding = state.getPlayerState(other)
        const writs = holding.requireWrits()
        writs.splice(writs.indexOf(Charter), 1)
        holding.requireSealedCharters().push(Charter)
        moveConcealedSeal(state, { kind: 'pile' }, { kind: 'charter', playerId: other })

        setPawns(state, seat, ['knight'])
        buildFeudum(state, other)
        placeMarker(state, seat, Battlefield)
        moveConcealedSeal(
            state,
            { kind: 'pile' },
            { kind: 'immunity', spaceId: Battlefield, role: 'serf' }
        )

        putWritsUnderUnseen(state, seat, drawWrits(state, 1))
        putWritsUnderInView(state, drawWrits(state, 1))
    })
    return { table, explorer: playerId, holder }
}

describe('R-5.1, R-5-H1 exploring from a projection', () => {
    describe.each(Scenes)('at $name', (scene) => {
        const sources = sourcesOf(scene)

        it('is reached by a real game', () => {
            expect(sources.length).toBeGreaterThan(0)
        })

        it('deals every hidden value within the public constraints, for each seat and a spectator', () => {
            for (const { walk, source } of sources) {
                for (const perspective of perspectivesOf(walk)) {
                    expectDealtWithin(source, explore(source, perspective, walk), perspective, walk)
                }
            }
        })

        it('gives the same branch from sources differing only in hidden values', () => {
            for (const { walk, source } of sources) {
                for (const perspective of perspectivesOf(walk)) {
                    const twin = explore(source, perspective, walk, 99)
                    expect(tableIn(twin, perspective, walk)).toEqual(
                        tableIn(source, perspective, walk)
                    )
                    expect(twin.vault).not.toEqual(canonical(source).vault)
                    expect(explore(twin, perspective, walk, 5)).toEqual(
                        explore(source, perspective, walk, 5)
                    )
                }
            }
        })
    })

    it('R-5.1 deals afresh: another sample is another world', () => {
        const [walk] = Games
        const source = positionsOf(walk)[Math.floor(walk.steps.length / 2)]
        const first = explore(source, Spectator, walk, 1)
        const second = explore(source, Spectator, walk, 2)
        expect(first.vault.writDeck).not.toEqual(second.vault.writDeck)
        expect(first.vault.sealPile).not.toEqual(second.vault.sealPile)
        expect(first.vault.tileLandscapes).not.toEqual(second.vault.tileLandscapes)
    })

    describe('R-5-H1 with a seal in every place', () => {
        const { table, explorer, holder } = tableWithEveryPlace()

        it('deals to each, for each seat and a spectator', () => {
            for (const perspective of perspectivesOf(table)) {
                const branch = explore(table.state, perspective, table)
                expectDealtWithin(table.state, branch, perspective, table)
                expect(Object.keys(branch.vault.immunitySeals)).toEqual([
                    immunityKey(Battlefield, 'serf')
                ])
                expect(branch.vault.charterSeals[holder]).toHaveLength(1)
                expect(branch.vault.heldSeals[explorer]).toHaveLength(1)
            }
        })

        it('never conceals a seal shown as a bead', () => {
            const [bead] = canonical(table.state).players.flatMap(({ beads }) => beads)
            assertExists(bead, 'The table shows a bead')
            for (const perspective of perspectivesOf(table)) {
                const branch = explore(table.state, perspective, table)
                expect(concealedSeals(branch.vault)).not.toContain(bead)
            }
        })

        it('R-4.4.3 keeps the explorer’s own sealed charter', () => {
            const branch = explore(table.state, { kind: 'player', playerId: holder }, table)
            expect(branch.players.find(({ playerId }) => playerId === holder)).toMatchObject({
                sealedCharters: [Charter]
            })
        })

        it('R-4.4.1 keeps the slot its owner knows, and only for its owner', () => {
            const [known] = canonical(table.state).players.flatMap(
                ({ deckKnowledge }) => deckKnowledge
            )
            assertExists(known, 'A seat knows a slot')
            const samples = [1, 2, 3, 4, 5, 6, 7, 8]
            for (const sample of samples) {
                const own = explore(
                    table.state,
                    { kind: 'player', playerId: explorer },
                    table,
                    sample
                )
                expect(own.vault.writDeck).toContainEqual(known)
            }
            const seen = samples.map(
                (sample) =>
                    explore(table.state, Spectator, table, sample).vault.writDeck.find(
                        ({ slot }) => slot === known.slot
                    )?.writId
            )
            expect(new Set(seen).size).toBeGreaterThan(1)
        })

        it('R-4.4.2 keeps the slot the table saw', () => {
            const [shown] = table.state.publicDeckWrits
            assertExists(shown, 'The table saw a writ go under')
            for (const perspective of perspectivesOf(table)) {
                const branch = explore(table.state, perspective, table)
                expect(branch.vault.writDeck).toContainEqual(shown)
            }
        })
    })

    it('R-5.1 survives the shared client’s checkpoint, with the projected history', () => {
        const [walk] = Games
        const source = positionsOf(walk)[Math.floor(walk.steps.length / 2)]
        const perspective: Visibility.Perspective = { kind: 'player', playerId: 'p1' }
        const view = viewOf(source, perspective, walk)
        const count = source.actionCount
        const actions = processedOf(walk)
            .slice(0, count)
            .map((action) => recordFor(action, perspective, walk))
        const branch = explore(source, perspective, walk)
        const { checkpoint } = history.checkpoint(view, branch, actions, started(walk), 'projected')
        assertExists(checkpoint, 'A branch keeps its checkpoint')
        expect(checkpoint.undoLimit).toBeLessThanOrEqual(count)
    })
})

describe('R-5.1 a branch plays on', () => {
    it.each(Scenes.map((scene, index) => ({ scene, index })))(
        'to the end of the game from $scene.name',
        ({ scene, index }) => {
            const sources = sourcesOf(scene)
            const { walk, source } = sources[index % sources.length]
            for (const perspective of [Spectator, perspectivesOf(walk)[1]]) {
                const branch = explore(source, perspective, walk)
                const { final } = walkFrom(started(walk), branch)
                expect(final.machineState).toBe(MachineState.EndOfGame)
                expect(final.result).toBeDefined()
                expect(() => engine.validateCanonicalState(final)).not.toThrow()
            }
        },
        120_000
    )

    it('from a table with a seal in every place', { timeout: 120_000 }, () => {
        const { table } = tableWithEveryPlace()
        const { final } = walkFrom(started(table), explore(table.state, Spectator, table))
        expect(final.machineState).toBe(MachineState.EndOfGame)
    })
})

describe('R-5.1 exploring from canonical state', () => {
    const canonicalSources = [
        ...Scenes.flatMap((scene) => sourcesOf(scene)),
        { source: tableWithEveryPlace().table.state }
    ]

    it('reshuffles every hidden list within itself, known slots kept', () => {
        for (const { source } of canonicalSources) {
            const before = canonical(source)
            const branch = reshuffled(source)
            expect(() => engine.validateCanonicalState(branch)).not.toThrow()
            expect(branch).not.toHaveProperty('masterSeed')

            // R-5.1 The deck: the same writs in the same slots, anything anyone knows where it was.
            const { vault } = branch
            const everySeat = branch.players.map(({ playerId }) => playerId)
            expect(vault.writDeck.map(({ slot }) => slot)).toEqual(
                before.vault.writDeck.map(({ slot }) => slot)
            )
            expect(sorted(vault.writDeck.map(({ writId }) => writId))).toEqual(
                sorted(before.vault.writDeck.map(({ writId }) => writId))
            )
            for (const known of knownSlots(before, everySeat)) {
                expect(vault.writDeck).toContainEqual(known)
            }

            // R-5-H1 The pile holds the same seals; no one knows the others apart, so they stay.
            expect(sorted(vault.sealPile)).toEqual(sorted(before.vault.sealPile))
            expect(vault.scrollSeals).toEqual(before.vault.scrollSeals)
            expect(vault.heldSeals).toEqual(before.vault.heldSeals)
            expect(vault.charterSeals).toEqual(before.vault.charterSeals)
            expect(vault.immunitySeals).toEqual(before.vault.immunitySeals)

            // R-1.4-H2 The same tiles, and within each epoch the same landscapes.
            expect(sorted(Object.keys(vault.tileLandscapes))).toEqual(
                sorted(Object.keys(before.vault.tileLandscapes))
            )
            for (const epoch of TileEpochs) {
                const inEpoch = (landscapes: FeudumGameState['vault']['tileLandscapes']) =>
                    sorted(
                        RegionTiles.filter(
                            (tile) => tile.epoch === epoch && Object.hasOwn(landscapes, tile.id)
                        ).map((tile) => landscapes[tile.id])
                    )
                expect(inEpoch(vault.tileLandscapes)).toEqual(inEpoch(before.vault.tileLandscapes))
            }

            // Nothing but the vault and the streams moves: hands and writs included.
            const { vault: _vault, prng: _prng, protectedPrng: _stream, ...table } = branch
            const {
                vault: _sourceVault,
                prng: _sourcePrng,
                protectedPrng: _sourceStream,
                masterSeed: _seed,
                ...sourceTable
            } = before
            expect(table).toEqual(sourceTable)
        }
    })

    it('draws from the branch’s own protected stream and leaves its source alone', () => {
        const { source } = canonicalSources[0]
        const copy = structuredClone(source)
        const first = reshuffled(source, 7)
        expect(source).toEqual(copy)
        expect(reshuffled(source, 7)).toEqual(first)

        const other = reshuffled(source, 8)
        expect(other.vault.sealPile).not.toEqual(first.vault.sealPile)
        expect(other.vault.writDeck).not.toEqual(first.vault.writDeck)
        expect(other.vault.tileLandscapes).not.toEqual(first.vault.tileLandscapes)
        expect(first.protectedPrng?.invocations).toBeGreaterThan(0)
        expect(first.prng.invocations).toBe(0)
    })

    it('really moves the order: the deck, the pile and the landscapes all change', () => {
        const { source } = canonicalSources[0]
        const before = canonical(source)
        const branch = reshuffled(source)
        expect(branch.vault.sealPile).not.toEqual(before.vault.sealPile)
        expect(branch.vault.writDeck).not.toEqual(before.vault.writDeck)
        expect(branch.vault.tileLandscapes).not.toEqual(before.vault.tileLandscapes)
    })

    it('plays on to the end of the game', { timeout: 120_000 }, () => {
        const { walk, source } = sourcesOf(Scenes[1])[0]
        const { final } = walkFrom(started(walk), reshuffled(source))
        expect(final.machineState).toBe(MachineState.EndOfGame)
        expect(final.result).toBeDefined()
    })
})
