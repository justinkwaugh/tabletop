import { assertExists, GameEngine, type UninitializedGameState } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Regions, Spaces } from '../data/board.js'
import { ComponentTotals, GoodRows, StartingSupply, VesselRows } from '../data/components.js'
import { DoubleSidedDiscs, FeudumDiscs, StartingDiscs } from '../data/discs.js'
import {
    AlchemistCartSpaces,
    ChickenSpaces,
    GuildSetupSpaces,
    MarketSpaces,
    MinimumKnightRows,
    ScrollSpaces
} from '../data/guilds.js'
import { ProvisionalGuilds } from '../data/provisional.guilds.js'
import { EpochLandscapes, RegionTiles, TileEpochs, type TileId } from '../data/regionTiles.js'
import { SealBeadCounts, Seals, type SealId } from '../data/seals.js'
import { RoyalWrits } from '../data/writs.js'
import { FeudumCanonicalStateValidator } from '../model/canonicalValidator.js'
import { HydratedFeudumGameState, type FeudumGameState } from '../model/gameState.js'
import { chickenBeads } from '../model/guildsState.js'
import { canonicalOf, testGame } from '../testing/state.js'
import { FeudumColors } from './colors.js'
import { FeudumGameInitializer } from './initializer.js'
import { FeudumRuntime } from './runtime.js'
import { MachineState } from './states.js'

const engine = new GameEngine(FeudumRuntime)
const MasterSeed = '0123456789abcdef0123456789abcdef'
const OtherMasterSeed = 'fedcba9876543210fedcba9876543210'
const PlayerCounts = [2, 3, 4, 5]

function start(numPlayers = 4, masterSeed = MasterSeed): FeudumGameState {
    const { initialState } = engine.startGame(testGame(numPlayers), { masterSeed })
    return canonicalOf(new HydratedFeudumGameState(initialState))
}

/** The initializer on two known streams, so a spec can vary one and hold the other. */
function initialized(
    numPlayers: number,
    streams: { publicSeed: number; protectedSeed: number },
    playerIds?: string[]
): FeudumGameState {
    const state: UninitializedGameState = {
        systemVersion: 3,
        id: 'state-1',
        gameId: 'game-1',
        activePlayerIds: [],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: streams.publicSeed, invocations: 0 },
        protectedPrng: { seed: streams.protectedSeed, invocations: 0 },
        winningPlayerIds: []
    }
    return canonicalOf(
        new FeudumGameInitializer().initializeGameState(
            testGame(numPlayers),
            state,
            playerIds && { playerIds }
        )
    )
}

/** What the protected stream decides, none of it from the public one. */
function protectedDraws(state: FeudumGameState) {
    return {
        spaces: state.spaces,
        vault: state.vault,
        barn: state.guilds.farmer.barn,
        chickens: state.guilds.farmer.chickens,
        rosary: state.guilds.monk.rosary,
        vesselsForSale: state.guilds.alchemist.vesselsForSale
    }
}

function counted<T extends string | number>(items: readonly T[]): Map<T, number> {
    const counts = new Map<T, number>()
    for (const item of items) {
        counts.set(item, (counts.get(item) ?? 0) + 1)
    }
    return counts
}

function discKinds(state: FeudumGameState, startingSpaces: boolean) {
    return counted(
        Spaces.filter((space) => space.startingSpace === startingSpaces).map(
            (space) => state.spaces[space.id].location.kind
        )
    )
}

function beadValue(sealId: SealId): number {
    const seal = Seals.find((candidate) => candidate.id === sealId)
    assertExists(seal, `${sealId} is not a seal`)
    return seal.beadValue
}

function goodsTotal(counts: Record<string, number>): number {
    return Object.values(counts).reduce((sum, count) => sum + count, 0)
}

describe.each(PlayerCounts)('R-1.4 setup at %i players', (numPlayers) => {
    it('R-1.4.1 gives each seat its personal supply, the scoring disc at 0', () => {
        const state = start(numPlayers)
        expect(state.players.map((player) => player.playerId).toSorted()).toEqual(
            testGame(numPlayers)
                .players.map((player) => player.id)
                .toSorted()
        )
        for (const player of state.players) {
            expect(player.influenceSupply).toBe(StartingSupply.markers)
            expect(player.shillings).toBe(StartingSupply.shillings)
            expect(player.goods).toEqual({
                saltpeter: 0,
                sulfur: 0,
                iron: 0,
                wood: 0,
                food: StartingSupply.food
            })
            expect(player.score).toBe(0)
            expect(player.barrel).toBe(0)
            expect(player.pawns).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }])
            expect(player.sealCount).toBe(0)
            expect(player.beads).toEqual([])
            expect(player.writs).toEqual([])
        }
    })

    it('R-1.4.2 leaves the rest in the general supplies', () => {
        const { supply, monsters, players, guilds } = start(numPlayers)
        expect(supply.shillings).toBe(
            ComponentTotals.shillings - numPlayers * StartingSupply.shillings
        )
        expect(supply.targets).toBe(ComponentTotals.targets)
        expect(goodsTotal(supply.vessels)).toBe(
            ComponentTotals.vessels - GuildSetupSpaces.alchemist.vessels
        )
        expect(monsters).toEqual({ behemoth: {}, 'sea-serpent': {} })
        for (const { color } of players) {
            expect(supply.influence[color]).toBe(
                ComponentTotals.markersPerColour -
                    StartingSupply.markers -
                    GuildSetupSpaces.knight.markersPerRow
            )
        }
        for (const { colour } of guilds.knight.rows.filter((row) => !row.playerId)) {
            expect(supply.influence[colour]).toBe(
                ComponentTotals.markersPerColour - GuildSetupSpaces.knight.markersPerRow
            )
        }
    })

    it('R-1.4.3 shuffles the writ deck into slots 0 to 15, its order only in the vault', () => {
        const { vault, writDeck } = start(numPlayers)
        expect(writDeck).toEqual({ top: 0, nextBottom: RoyalWrits.length })
        expect(vault.writDeck.map(({ slot }) => slot)).toEqual(RoyalWrits.map((_, slot) => slot))
        expect(vault.writDeck.map(({ writId }) => writId).toSorted()).toEqual(
            RoyalWrits.map((writ) => writ.id).toSorted()
        )
        expect(vault.writDeck.map(({ writId }) => writId)).not.toEqual(
            RoyalWrits.map((writ) => writ.id)
        )
    })

    it('R-1.4.3 puts the ringed discs on the 6 starting spaces and the rest on the other 16', () => {
        const state = start(numPlayers)
        const placed = Spaces.map((space) => state.spaces[space.id].location.discId)
        expect(placed.toSorted()).toEqual(StartingDiscs.map((disc) => disc.id).toSorted())
        for (const space of Spaces) {
            const { discId, kind, face } = state.spaces[space.id].location
            const disc = StartingDiscs.find((starting) => starting.id === discId)
            expect(disc?.circleMark, space.id).toBe(space.startingSpace)
            expect(disc?.kind, space.id).toBe(kind)
            expect(face).toBe('a')
        }
    })

    it('R-1.4.3 keeps the 22 double-sided discs, the feudums among them, in the general supply', () => {
        expect(start(numPlayers).supply.discs.toSorted()).toEqual(
            [...DoubleSidedDiscs, ...FeudumDiscs].map((disc) => disc.id).toSorted()
        )
    })

    it('R-1.4-H2 deals each epoch its six landscapes in the vault, top first I to IV', () => {
        const { vault, tileLandscapes, regionStacks } = start(numPlayers)
        expect(tileLandscapes).toEqual({})
        for (const epoch of TileEpochs) {
            const dealt = RegionTiles.filter((tile) => tile.epoch === epoch).map(
                (tile) => vault.tileLandscapes[tile.id]
            )
            expect(counted(dealt)).toEqual(counted(EpochLandscapes[epoch]))
        }
        for (const stack of Object.values(regionStacks)) {
            expect(stack.map((tile: TileId) => tile.split('.')[2])).toEqual([
                'i',
                'ii',
                'iii',
                'iv'
            ])
        }
    })

    it('R-1.3 fills the market and the carts from the haversack', () => {
        const { guilds } = start(numPlayers)
        for (const space of MarketSpaces) {
            expect(guilds.merchant.market[space.id], space.id).toBe(space.filledAtSetup)
        }
        for (const space of AlchemistCartSpaces) {
            expect(guilds.alchemist.carts[space.id], space.id).toBe(space.filledAtSetup)
        }
        expect(MarketSpaces.filter((space) => space.filledAtSetup)).toHaveLength(18)
        expect(AlchemistCartSpaces.filter((space) => space.filledAtSetup)).toHaveLength(11)
    })

    it('R-1.3 draws 2 vessels for sale from the general supply', () => {
        const { guilds, supply } = start(numPlayers)
        expect(guilds.alchemist.vesselsForSale).toHaveLength(GuildSetupSpaces.alchemist.vessels)
        for (const { vessel, count } of VesselRows) {
            expect(
                supply.vessels[vessel] +
                    guilds.alchemist.vesselsForSale.filter((sale) => sale === vessel).length
            ).toBe(count)
        }
    })

    it('R-1.4-H1 seats a Knight row each, and dummy rows in unused colours to exactly 4 below 4', () => {
        const { guilds, players } = start(numPlayers)
        const { rows } = guilds.knight
        expect(rows).toHaveLength(Math.max(numPlayers, MinimumKnightRows))
        expect(new Set(rows.map((row) => row.colour)).size).toBe(rows.length)
        for (const row of rows) {
            expect(row.markers).toBe(GuildSetupSpaces.knight.markersPerRow)
        }
        for (const player of players) {
            expect(rows.find((row) => row.playerId === player.playerId)?.colour).toBe(player.color)
        }
        const dummies = rows.filter((row) => row.playerId === undefined)
        expect(dummies).toHaveLength(Math.max(MinimumKnightRows - numPlayers, 0))
        for (const dummy of dummies) {
            expect(FeudumColors).toContain(dummy.colour)
            expect(players.map((player) => player.color)).not.toContain(dummy.colour)
        }
    })

    it('R-1.4.5 shuffles the seals: 4 to the scrolls, 4 beads, 1 bead on a chicken, 8 in the pile', () => {
        const { guilds, vault, supply } = start(numPlayers)
        const { chickens } = guilds.farmer
        expect(
            ScrollSpaces.filter((space) => guilds.noble.scrolls[space.id]).map(({ id }) => id)
        ).toEqual([...GuildSetupSpaces.noble.scrollSpaces])
        expect(Object.keys(vault.scrollSeals).toSorted()).toEqual(
            [...GuildSetupSpaces.noble.scrollSpaces].toSorted()
        )
        expect(guilds.monk.rosary).toHaveLength(4)
        expect(Object.values(chickens).filter((chicken) => chicken !== null)).toHaveLength(1)
        expect(vault.sealPile).toHaveLength(8)
        expect(supply.sealPileCount).toBe(8)
        for (const held of [
            ...Object.values(vault.heldSeals),
            ...Object.values(vault.charterSeals)
        ]) {
            expect(held).toEqual([])
        }
        expect(vault.immunitySeals).toEqual({})
        expect(vault.sealPile).not.toEqual(
            Seals.map((seal) => seal.id).slice(Seals.length - vault.sealPile.length)
        )
    })

    it('R-1.4.5 draws 10 random goods into the barn', () => {
        expect(goodsTotal(start(numPlayers).guilds.farmer.barn)).toBe(10)
    })

    it("R-1.4.6 puts one random good beside each region's N space and nowhere else", () => {
        const { spaces, epoch } = start(numPlayers)
        expect(epoch).toBe(1)
        for (const space of Spaces) {
            expect(goodsTotal(spaces[space.id].goods), space.id).toBe(
                space.letters.includes('N') ? 1 : 0
            )
        }
        expect(
            Regions.map(
                (region) => region.spaces.filter((space) => space.letters.includes('N')).length
            )
        ).toEqual(Regions.map(() => 1))
    })

    it('R-1.4.4 takes every good it places out of the haversack', () => {
        const { supply } = start(numPlayers)
        const dealt = numPlayers * StartingSupply.food + 18 + 11 + 10 + Regions.length
        expect(goodsTotal(supply.haversack)).toBe(ComponentTotals.goods - dealt)
        for (const { good, count } of GoodRows) {
            expect(supply.haversack[good], good).toBeLessThanOrEqual(count)
        }
    })

    it('R-1.4.7 enters ChoosingStartingGoods with the starting player choosing first (R-1.4.8)', () => {
        const state = start(numPlayers)
        const [startingPlayer] = state.turnManager.turnOrder
        expect(state.machineState).toBe(MachineState.ChoosingStartingGoods)
        expect(state.activePlayerIds).toEqual([startingPlayer])
        expect(state.flow.setupOrder).toEqual({ playerId: startingPlayer })
        expect(state.players.map((player) => player.playerId)).toEqual(state.turnManager.turnOrder)
    })

    it('R-1.1 passes the canonical validator and round-trips, across seeds', () => {
        for (const masterSeed of [MasterSeed, OtherMasterSeed]) {
            const state = start(numPlayers, masterSeed)
            expect(FeudumCanonicalStateValidator.Check(state)).toBe(true)
            const rehydrated = new HydratedFeudumGameState(structuredClone(state))
            expect(rehydrated.dehydrate()).toEqual(state)
        }
    })

    it('R-1.4 is reproducible from a master seed', () => {
        const first = start(numPlayers)
        expect({ ...start(numPlayers), id: first.id }).toEqual(first)
        expect(protectedDraws(start(numPlayers, OtherMasterSeed))).not.toEqual(
            protectedDraws(first)
        )
    })
})

describe('R-1.4 randomness', () => {
    const streams = { publicSeed: 11, protectedSeed: 22 }

    it('R-1.4.7 draws colours and seat order from the public stream, and nothing else', () => {
        const base = initialized(4, streams)
        const other = initialized(4, { ...streams, protectedSeed: 33 })
        expect(other.turnManager.turnOrder).toEqual(base.turnManager.turnOrder)
        expect(other.players.map((player) => player.color)).toEqual(
            base.players.map((player) => player.color)
        )
        // Shuffling the 5 colours and the 4 seats.
        expect(base.prng.invocations).toBe(FeudumColors.length - 1 + 3)
        expect(other.prng.invocations).toBe(base.prng.invocations)
    })

    it('R-1.4.3, R-1.4.5, R-1.4.6 draw everything else from the protected stream', () => {
        const base = initialized(4, streams)
        expect(base.protectedPrng?.invocations).toBeGreaterThan(0)
        expect(protectedDraws(initialized(4, { ...streams, publicSeed: 44 }))).toEqual(
            protectedDraws(base)
        )
        expect(protectedDraws(initialized(4, { ...streams, protectedSeed: 33 }))).not.toEqual(
            protectedDraws(base)
        )
    })

    it('R-1.4-H2 deals different landscapes on the same tiles from another seed', () => {
        expect(start(4).vault.tileLandscapes).not.toEqual(
            start(4, OtherMasterSeed).vault.tileLandscapes
        )
    })

    it('R-1.4.7 honours an assignment and still consumes the public draw', () => {
        const seats = testGame(4)
            .players.map((player) => player.id)
            .toReversed()
        const free = initialized(4, streams)
        const assigned = initialized(4, streams, seats)
        expect(assigned.turnManager.turnOrder).toEqual(seats)
        expect(assigned.players.map((player) => player.playerId)).toEqual(seats)
        expect(assigned.prng).toEqual(free.prng)
        expect(assigned.protectedPrng).toEqual(free.protectedPrng)
        expect(protectedDraws(assigned)).toEqual(protectedDraws(free))
    })

    it('R-1.4.7 the engine accepts starting positions', () => {
        const seats = testGame(3)
            .players.map((player) => player.id)
            .toReversed()
        const { initialState } = engine.startGame(testGame(3), {
            masterSeed: MasterSeed,
            startingPositions: { playerIds: seats }
        })
        expect(new FeudumGameInitializer().supportsStartingPositions).toBe(true)
        expect(initialState.turnManager.turnOrder).toEqual(seats)
        expect(initialState.activePlayerIds).toEqual([seats[0]])
    })
})

describe('R-1.4 the real components', () => {
    it('R-1.4.3 the ringed discs are 2 farms, 2 towns, 2 outposts; the rest 5, 3 and 8', () => {
        const state = start()
        expect(discKinds(state, true)).toEqual(
            new Map([
                ['farm', 2],
                ['town', 2],
                ['outpost', 2]
            ])
        )
        expect(discKinds(state, false)).toEqual(
            new Map([
                ['farm', 5],
                ['town', 3],
                ['outpost', 8]
            ])
        )
    })

    it('R-1.1, R-1.4.5 the 17 seals keep their bead values wherever setup puts them', () => {
        for (const masterSeed of [MasterSeed, OtherMasterSeed]) {
            const { guilds, vault } = start(4, masterSeed)
            const everySeal = [
                ...guilds.monk.rosary,
                ...chickenBeads(guilds.farmer),
                ...Object.values(vault.scrollSeals),
                ...vault.sealPile
            ]
            expect(counted(everySeal.map(beadValue))).toEqual(
                new Map(SealBeadCounts.map(({ beadValue, count }) => [beadValue, count]))
            )
        }
    })

    it('R-1.4-H3 provisional: the chickens are known by their space ids, the setup bead on the first of 4', () => {
        const { chickens } = start().guilds.farmer
        const { spaces, setupBeadSpace } = ProvisionalGuilds.chickenSpaces.placeholder
        expect(Object.keys(chickens).toSorted()).toEqual(
            ChickenSpaces.map(({ id }) => id).toSorted()
        )
        expect(ChickenSpaces).toHaveLength(spaces)
        for (const space of ChickenSpaces) {
            expect(chickens[space.id] !== null, space.id).toBe(space.id === setupBeadSpace)
        }
    })
})
