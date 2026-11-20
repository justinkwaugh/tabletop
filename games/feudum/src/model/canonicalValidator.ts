import { sum } from './collections.js'
import { Spaces } from '../data/board.js'
import { ComponentTotals, GoodRows, MonsterIds, VesselRows } from '../data/components.js'
import type { Good, VesselType } from '../data/components.js'
import { LocationDiscs } from '../data/discs.js'
import { AlchemistCartSpaces, MarketSpaces, ScrollSpaces } from '../data/guilds.js'
import {
    EpochLandscapes,
    LandscapeKinds,
    Landscapes,
    RegionIds,
    RegionTiles,
    TileEpochs,
    type Landscape
} from '../data/regionTiles.js'
import { Seals } from '../data/seals.js'
import { FeudumGameState, FeudumGameStateValidator } from './gameState.js'
import { chickenBeads, type KnightRowOwner } from './guildsState.js'
import { knightRow, knightRows } from './knightRows.js'

export type ConservedComponent =
    'goods' | 'shillings' | 'markers' | 'vessels' | 'targets' | 'seals' | 'discs' | 'tiles'

/** One total that does not add up; `part` names the good, colour or count when there are several. */
export interface ConservationBreak {
    readonly component: ConservedComponent
    readonly part?: string
    readonly expected: number
    readonly found: number
}

function total(
    component: ConservedComponent,
    expected: number,
    found: number,
    part?: string
): ConservationBreak[] {
    return found === expected ? [] : [{ component, expected, found, ...(part ? { part } : {}) }]
}

/** Every id of a catalogue lies in exactly one place. */
function identities(
    component: ConservedComponent,
    catalogue: readonly string[],
    placed: readonly string[]
): ConservationBreak[] {
    return new Set(placed).size === catalogue.length
        ? total(component, catalogue.length, placed.length)
        : [{ component, expected: catalogue.length, found: new Set(placed).size }]
}

function spaceStates(state: FeudumGameState) {
    return Spaces.map((space) => state.spaces[space.id])
}

/** R-4.3.4 What lies on landscapes of the kinds that hold this resource. */
function onLandscapes(state: FeudumGameState, resource: Landscape['resource']): number {
    const kinds = Landscapes.filter((landscape) => landscape.resource === resource).map(
        (landscape) => landscape.kind
    )
    return sum(
        spaceStates(state).flatMap(({ landscape }) =>
            landscape && kinds.includes(state.tileLandscapes[landscape.tileId])
                ? [landscape.amount]
                : []
        )
    )
}

function goodsFound(state: FeudumGameState, good: Good): number {
    const { farmer, merchant, alchemist } = state.guilds
    return sum([
        state.supply.haversack[good],
        ...state.players.map((player) => player.goods[good]),
        // R-3.3
        ...state.players.map((player) => (player.pouch === good ? 1 : 0)),
        // R-4.10.2 Barrel sulfur stays sulfur, in the barrel or on a pawn.
        ...(good === 'sulfur'
            ? state.players.flatMap((player) => [
                  player.barrel,
                  player.pawns.filter((pawn) => pawn.wine !== undefined).length
              ])
            : []),
        ...spaceStates(state).map((space) => space.goods[good]),
        good === 'food' || good === 'sulfur' ? onLandscapes(state, good) : 0,
        farmer.barn[good],
        MarketSpaces.filter((space) => space.good === good && merchant.market[space.id]).length,
        AlchemistCartSpaces.filter((space) => space.good === good && alchemist.carts[space.id])
            .length,
        // R-3.11.3
        state.flow.harvest?.drawn[good] ?? 0
    ])
}

function shillingsFound(state: FeudumGameState): number {
    return sum([
        state.supply.shillings,
        ...state.players.map((player) => player.shillings),
        state.guilds.farmer.purse,
        state.guilds.monk.coffer,
        onLandscapes(state, 'shillings')
    ])
}

/** The markers a seat has out of its supply, apart from those in a Knight row. */
function markersPlaced(state: FeudumGameState, playerId: string): number {
    const { tracks } = state.guilds
    return sum([
        ...spaceStates(state).map(({ ruler, serf }) => {
            const asRuler = ruler?.playerId === playerId ? (ruler.subject ? 2 : 1) : 0
            return asRuler + (serf?.playerId === playerId ? 1 : 0)
        }),
        ...Object.values(tracks).flatMap(({ master, journeyman, apprentice }) =>
            [master, journeyman, apprentice].map((holder) =>
                holder?.playerId === playerId ? 1 : 0
            )
        ),
        MonsterIds.filter((monster) => state.monsters[monster].playerId === playerId).length
    ])
}

/** R-1.1, R-1.4.2 Per seat, and per dummy row: each owner's markers are all somewhere. */
function markersBreaks(state: FeudumGameState): ConservationBreak[] {
    const rows = knightRows(state)
    const rowMarkers = (owner: (row: KnightRowOwner) => boolean) =>
        sum(rows.filter(({ row }) => owner(row.owner)).map(({ row }) => row.markers))
    const seats = state.players.map(({ playerId }) => playerId)
    const inHand = (playerId: string) =>
        state.players.find((player) => player.playerId === playerId)?.influenceSupply ?? 0
    const dummies = rows.flatMap(({ rowId, row }) => ('dummy' in row.owner ? [rowId] : []))
    const strays: [string, number][] = [
        ...Object.entries(state.supply.influence).filter(([key]) => !seats.includes(key)),
        ...Object.entries(state.supply.dummyInfluence).filter(
            ([key]) => !dummies.some((rowId) => rowId === key)
        )
    ]
    return [
        ...seats.flatMap((playerId) =>
            total(
                'markers',
                ComponentTotals.markersPerColour,
                sum([
                    state.supply.influence[playerId] ?? 0,
                    inHand(playerId),
                    markersPlaced(state, playerId),
                    rowMarkers((owner) => 'playerId' in owner && owner.playerId === playerId)
                ]),
                playerId
            )
        ),
        ...dummies.flatMap((rowId) =>
            total(
                'markers',
                ComponentTotals.markersPerColour,
                (state.supply.dummyInfluence[rowId] ?? 0) + knightRow(state, rowId).markers,
                rowId
            )
        ),
        ...strays.flatMap(([key, count]) => total('markers', 0, count, key))
    ]
}

function vesselsFound(state: FeudumGameState, vessel: VesselType): number {
    return sum([
        state.supply.vessels[vessel],
        ...state.players.map((player) => player.vessels[vessel]),
        ...state.players.map(
            (player) => player.pawns.filter((pawn) => pawn.vessel === vessel).length
        ),
        ...spaceStates(state).map((space) => space.vessels[vessel]),
        state.guilds.alchemist.vesselsForSale.filter((forSale) => forSale === vessel).length
    ])
}

/** R-5-H1 Identities by place, and the public counts that stand in for them. */
function sealsBreaks(state: FeudumGameState): ConservationBreak[] {
    const { vault, guilds, players, supply } = state
    const occupiedScrolls = ScrollSpaces.filter((space) => guilds.noble.scrolls[space.id])
    return [
        ...identities(
            'seals',
            Seals.map((seal) => seal.id),
            [
                ...vault.sealPile,
                ...Object.values(vault.scrollSeals),
                ...Object.values(vault.heldSeals).flat(),
                ...Object.values(vault.charterSeals).flat(),
                ...Object.values(vault.immunitySeals),
                ...players.flatMap((player) => player.beads),
                ...chickenBeads(guilds.farmer),
                ...guilds.monk.rosary
            ]
        ),
        ...total('seals', vault.sealPile.length, supply.sealPileCount, 'sealPileCount'),
        ...total(
            'seals',
            Object.keys(vault.scrollSeals).length,
            occupiedScrolls.filter((space) => Object.hasOwn(vault.scrollSeals, space.id)).length,
            'scrolls'
        ),
        ...total('seals', occupiedScrolls.length, Object.keys(vault.scrollSeals).length, 'scrolls'),
        ...players.flatMap((player) =>
            total(
                'seals',
                vault.heldSeals[player.playerId]?.length ?? 0,
                player.sealCount,
                `sealCount.${player.playerId}`
            )
        )
    ]
}

/** R-4.3.1, R-4.3.3, R-1.4-H2 */
function tilesBreaks(state: FeudumGameState): ConservationBreak[] {
    const stacked = RegionIds.flatMap((region) => state.regionStacks[region])
    const taken = [
        ...state.players.flatMap((player) => player.regionTiles),
        ...spaceStates(state).flatMap((space) => (space.landscape ? [space.landscape.tileId] : []))
    ]
    const hidden = state.vault.tileLandscapes
    const shown = state.tileLandscapes
    const landscapes = { ...hidden, ...shown }
    return [
        ...identities(
            'tiles',
            RegionTiles.map((tile) => tile.id),
            [...stacked, ...taken, ...state.tilesOutOfGame]
        ),
        ...total(
            'tiles',
            stacked.length,
            stacked.filter((tile) => Object.hasOwn(hidden, tile)).length,
            'hidden landscapes'
        ),
        ...total(
            'tiles',
            taken.length,
            taken.filter((tile) => Object.hasOwn(shown, tile)).length,
            'shown landscapes'
        ),
        ...total(
            'tiles',
            RegionTiles.length,
            Object.keys(hidden).length + Object.keys(shown).length,
            'landscapes'
        ),
        ...TileEpochs.flatMap((epoch) =>
            LandscapeKinds.flatMap((kind) =>
                total(
                    'tiles',
                    EpochLandscapes[epoch].filter((printed) => printed === kind).length,
                    RegionTiles.filter(
                        (tile) => tile.epoch === epoch && landscapes[tile.id] === kind
                    ).length,
                    `${epoch}.${kind}`
                )
            )
        )
    ]
}

/** R-1.1, R-1.1-H1 Every component is somewhere and none is ever created. */
export function conservationBreaks(state: FeudumGameState): ConservationBreak[] {
    return [
        ...GoodRows.flatMap(({ good, count }) =>
            total('goods', count, goodsFound(state, good), good)
        ),
        ...total('shillings', ComponentTotals.shillings, shillingsFound(state)),
        ...markersBreaks(state),
        ...VesselRows.flatMap(({ vessel, count }) =>
            total('vessels', count, vesselsFound(state, vessel), vessel)
        ),
        ...total(
            'targets',
            ComponentTotals.targets,
            state.supply.targets + onLandscapes(state, 'targets')
        ),
        ...sealsBreaks(state),
        ...identities(
            'discs',
            LocationDiscs.map((disc) => disc.id),
            [...state.supply.discs, ...spaceStates(state).map((space) => space.location.discId)]
        ),
        ...tilesBreaks(state)
    ]
}

export const FeudumCanonicalStateValidator = {
    Check(state: unknown): state is FeudumGameState {
        return FeudumGameStateValidator.Check(state) && conservationBreaks(state).length === 0
    }
}
