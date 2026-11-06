import { assertExists } from '@tabletop/common'
import { Spaces } from '../data/board.js'
import { ComponentTotals, GoodRows, VesselRows } from '../data/components.js'
import { DoubleSidedDiscs, FeudumDiscs, StartingDiscs } from '../data/discs.js'
import { AlchemistCartSpaces, ChickenSpaces, MarketSpaces, ScrollSpaces } from '../data/guilds.js'
import {
    EpochLandscapes,
    RegionIds,
    RegionTiles,
    type LandscapeKind,
    type TileId
} from '../data/regionTiles.js'
import { Seals } from '../data/seals.js'
import { RoyalWrits } from '../data/writs.js'
import type { FeudumGameState } from './gameState.js'
import type { GuildsState } from './guildsState.js'
import type { FeudumPlayerState } from './playerState.js'
import { goodCounts, recordFrom, vesselCounts } from './stateSchemas.js'

type BoxContents = Pick<
    FeudumGameState,
    | 'epoch'
    | 'spaces'
    | 'monsters'
    | 'guilds'
    | 'regionStacks'
    | 'tilesOutOfGame'
    | 'tileLandscapes'
    | 'supply'
    | 'writDeck'
    | 'publicDeckWrits'
    | 'voyageTrack'
    | 'militaryService'
    | 'vault'
    | 'flow'
>

function perPlayer<V>(players: FeudumPlayerState[], value: () => V): Record<string, V> {
    return Object.fromEntries(players.map((player) => [player.playerId, value()]))
}

/** R-1.4.3 Ringed discs on the starting spaces, the others on the rest. */
function placeStartingDiscs(): FeudumGameState['spaces'] {
    const ringed = StartingDiscs.filter((disc) => disc.circleMark)
    const plain = StartingDiscs.filter((disc) => !disc.circleMark)
    const discs = Spaces.map((space) => {
        const disc = (space.startingSpace ? ringed : plain).shift()
        assertExists(disc, `R-1.4.3 No starting disc left for ${space.id}`)
        return disc
    })
    return recordFrom(
        Spaces.map((space) => space.id),
        (_, index) => ({
            location: { kind: discs[index].kind, discId: discs[index].id, face: 'a' },
            goods: goodCounts(),
            vessels: vesselCounts()
        })
    )
}

/** R-1.4-H2 One of each epoch's six landscapes per tile, in catalogue order. */
function dealLandscapes(): Record<string, LandscapeKind> {
    return Object.fromEntries(
        RegionTiles.map((tile): [TileId, LandscapeKind] => [
            tile.id,
            EpochLandscapes[tile.epoch][RegionIds.indexOf(tile.region)]
        ])
    )
}

function emptyGuilds(): GuildsState {
    return {
        tracks: {
            farmer: {},
            merchant: {},
            alchemist: {},
            knight: {},
            noble: {},
            monk: {}
        },
        farmer: { barn: goodCounts(), chickens: ChickenSpaces.map(() => null), purse: 0 },
        merchant: {
            market: recordFrom(
                MarketSpaces.map((space) => space.id),
                () => false
            )
        },
        alchemist: {
            carts: recordFrom(
                AlchemistCartSpaces.map((space) => space.id),
                () => false
            ),
            vesselsForSale: []
        },
        knight: { rows: [], monsterIcons: { behemoth: null, 'sea-serpent': null } },
        noble: {
            scrolls: recordFrom(
                ScrollSpaces.map((space) => space.id),
                () => false
            )
        },
        monk: { rosary: [], coffer: 0 }
    }
}

/**
 * R-1.1 Every component in its general supply, unshuffled, each disc and tile in catalogue order:
 * the table R-1.4's setup steps deal from. Conservation already holds here.
 */
export function boxContents(players: FeudumPlayerState[]): BoxContents {
    const haversack = goodCounts()
    for (const row of GoodRows) {
        haversack[row.good] = row.count
    }
    const vessels = vesselCounts()
    for (const row of VesselRows) {
        vessels[row.vessel] = row.count
    }

    return {
        epoch: 1,
        spaces: placeStartingDiscs(),
        monsters: { behemoth: {}, 'sea-serpent': {} },
        guilds: emptyGuilds(),
        regionStacks: recordFrom(RegionIds, (region) =>
            RegionTiles.filter((tile) => tile.region === region).map((tile) => tile.id)
        ),
        tilesOutOfGame: [],
        tileLandscapes: {},
        supply: {
            haversack,
            shillings: ComponentTotals.shillings,
            influence: Object.fromEntries(
                players.map((player) => [player.color, ComponentTotals.markersPerColour])
            ),
            vessels,
            targets: ComponentTotals.targets,
            discs: [...DoubleSidedDiscs, ...FeudumDiscs].map((disc) => disc.id),
            sealPileCount: Seals.length
        },
        writDeck: { top: 0, nextBottom: RoyalWrits.length },
        publicDeckWrits: [],
        voyageTrack: {},
        militaryService: perPlayer(players, () => 0),
        vault: {
            writDeck: RoyalWrits.map((writ, slot) => ({ slot, writId: writ.id })),
            sealPile: Seals.map((seal) => seal.id),
            scrollSeals: {},
            heldSeals: perPlayer(players, () => []),
            charterSeals: perPlayer(players, () => []),
            immunitySeals: {},
            tileLandscapes: dealLandscapes()
        },
        flow: {}
    }
}
