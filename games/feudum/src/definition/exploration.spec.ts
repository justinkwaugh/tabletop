import { assertExists, deriveGameSeeds, ExplorationHistory, GameEngine } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { ChickenSpaces, ScrollSpaces } from '../data/guilds.js'
import { RegionTiles, TileEpochs } from '../data/regionTiles.js'
import type { SealId } from '../data/seals.js'
import type { FeudumGameState, FeudumProjectedState } from '../model/gameState.js'
import { placeMarker } from '../model/locationControl.js'
import { beadToSeal, flipSeal, moveConcealedSeal } from '../model/seals.js'
import { drawWrits, putWritsUnderInView, putWritsUnderUnseen } from '../model/writDeck.js'
import { Charter, tableInWindow } from '../testing/atWill.js'
import { Battlefield, buildFeudum, holdWrit } from '../testing/combat.js'
import { setPawns } from '../testing/guilds.js'
import { giveSeal } from '../testing/improving.js'
import { canonical, realGames, seedOf, started } from '../testing/protected.js'
import { walkFrom, type GameWalk } from '../testing/walk.js'
import { FeudumRuntime } from './runtime.js'
import { MachineState } from './states.js'
import { epochNumber } from '../model/tracks.js'

const engine = new GameEngine(FeudumRuntime)
const history = new ExplorationHistory(engine)

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

function reshuffled(source: FeudumProjectedState, stream = 7): FeudumGameState {
    return canonical(FeudumRuntime.exploration.createFromCanonicalState(prepared(source, stream)))
}

function sorted<T extends string>(values: readonly T[]): T[] {
    return [...values].sort()
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
            epochNumber({ epoch }) >= 3 &&
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

/** R-3.11.2, R-3.13.2 Beads the table saw, flipped back: one as a held seal, one into the pile. */
function tableWithReturnedBeads() {
    let favoured = ''
    let held: SealId | undefined
    let piled: SealId | null | undefined
    const { table } = tableInWindow('before a card', (state, seat) => {
        favoured = seat
        held = flipSeal(state, { kind: 'pile' }, { kind: 'player', playerId: seat })
        beadToSeal(
            state,
            held,
            { kind: 'player', playerId: seat },
            { kind: 'held', playerId: seat }
        )
        const chicken = ChickenSpaces.find(({ id }) => state.guilds.farmer.chickens[id])
        assertExists(chicken, 'R-1.3 A chicken holds a bead')
        piled = state.guilds.farmer.chickens[chicken.id]
        assertExists(piled, 'R-1.3 A chicken holds a bead')
        beadToSeal(state, piled, { kind: 'chicken', space: chicken.id }, { kind: 'pile' })
    })
    assertExists(held, 'R-3.11.2 A bead went back as a held seal')
    assertExists(piled, 'R-3.13.2 A bead went back into the pile')
    return { table, favoured, held, piled }
}

describe('R-5-H1 exploring from a projection', () => {
    it('is not offered: where a returned seal can lie needs concealed moves no Action records', () => {
        expect(FeudumRuntime.exploration).not.toHaveProperty('createFromProjectedState')
    })
})

describe('R-5.1 exploring from canonical state', () => {
    const canonicalSources = [
        ...Scenes.flatMap((scene) => sourcesOf(scene)),
        { source: tableWithEveryPlace().table.state },
        { source: tableWithReturnedBeads().table.state }
    ]

    it('R-3.11.2, R-3.13.2 keeps a seal returned from a bead where it went', () => {
        const { table, favoured, held, piled } = tableWithReturnedBeads()
        const { vault } = reshuffled(table.state)
        expect(vault.heldSeals[favoured]).toContain(held)
        expect(vault.sealPile).toContain(piled)
    })

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
