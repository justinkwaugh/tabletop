import { assert } from '@tabletop/common'
import {
    AlchemistCartSpaces,
    changeOwnerSupply,
    chickenBeads,
    ChickenSpaces,
    Goods,
    knightRows,
    MarketSpaces,
    moveConcealedSeal,
    placeMarker,
    recordFrom,
    rowSeat,
    ScrollSpaces,
    Seals,
    type ActionCardKind,
    type BeadValue,
    type Character,
    type Good,
    type GoodCounts,
    type GuildId,
    type HydratedFeudumGameState,
    type ScrollSpaceId,
    type SealId,
    type SpaceId,
    type VesselType
} from '@tabletop/feudum'
import type { FeudumGameSession } from '$lib/model/session.svelte.js'
import { atPlayingCards, emptySpace, type TurnTable } from './turnTable.js'

export type GoodAmounts = Readonly<Partial<Record<Good, number>>>

/** R-4.2 A space with no water or road special case; a guild spec's pawns stand here. */
export const StandingSpace: SpaceId = 'space.desert.3'

/** R-4.5.1 The seat's pawns on the board are of these characters, one star each. */
export function setPawns(
    state: HydratedFeudumGameState,
    playerId: string,
    characters: readonly Character[]
): void {
    state.getPlayerState(playerId).pawns.forEach((pawn, index) => {
        const character = characters.at(index)
        if (character) {
            pawn.character = character
            pawn.spaceId = StandingSpace
        } else {
            delete pawn.character
            delete pawn.spaceId
        }
    })
}

/** R-4.5.3 Three pawns outrank two, two outrank one. */
export function setMaster(state: HydratedFeudumGameState, playerId: string, guild: GuildId): void {
    setPawns(state, playerId, [guild, guild, guild])
}

/** R-4.5.3 The master holds the track's top, so a journeyman needs one above it. */
export function setJourneyman(
    state: HydratedFeudumGameState,
    playerId: string,
    guild: GuildId,
    masterId: string
): void {
    setPawns(state, masterId, [guild, guild, guild])
    setPawns(state, playerId, [guild, guild])
}

function setGoods(state: HydratedFeudumGameState, place: GoodCounts, amounts: GoodAmounts): void {
    for (const good of Goods) {
        const target = amounts[good] ?? 0
        state.supply.haversack[good] -= target - place[good]
        place[good] = target
    }
}

export function setBarn(state: HydratedFeudumGameState, amounts: GoodAmounts): void {
    setGoods(state, state.guilds.farmer.barn, amounts)
}

export function setFarmGoods(
    state: HydratedFeudumGameState,
    spaceId: SpaceId,
    amounts: GoodAmounts
): void {
    setGoods(state, state.spaces[spaceId].goods, amounts)
}

/** R-4.6.3 The seat's marker rules a free farm holding these goods. */
export function ruleFarm(
    state: HydratedFeudumGameState,
    playerId: string,
    amounts: GoodAmounts
): SpaceId {
    const spaceId = emptySpace(state, 'farm')
    placeMarker(state, playerId, spaceId)
    setFarmGoods(state, spaceId, amounts)
    return spaceId
}

/** Each bin filled to this many spaces, the rest empty, keeping totals. */
export function setMarket(state: HydratedFeudumGameState, filled: GoodAmounts): void {
    for (const { id, good, space } of MarketSpaces) {
        const wanted = space <= (filled[good] ?? 0)
        const held = state.guilds.merchant.market[id]
        state.supply.haversack[good] += Number(held) - Number(wanted)
        state.guilds.merchant.market[id] = wanted
    }
}

/** Each cart filled to this many spaces, the rest empty, keeping totals. */
export function setCarts(state: HydratedFeudumGameState, filled: GoodAmounts): void {
    for (const { id, good, space } of AlchemistCartSpaces) {
        const wanted = space <= (filled[good] ?? 0)
        const held = state.guilds.alchemist.carts[id]
        state.supply.haversack[good] += Number(held) - Number(wanted)
        state.guilds.alchemist.carts[id] = wanted
    }
}

/** The seat holds exactly this many shillings, keeping totals. */
export function setShillings(
    state: HydratedFeudumGameState,
    playerId: string,
    shillings: number
): void {
    const player = state.getPlayerState(playerId)
    state.supply.shillings -= shillings - player.shillings
    player.shillings = shillings
}

/** Exactly these vessels are for sale, the rest in the general supply. */
export function setVesselsForSale(
    state: HydratedFeudumGameState,
    vessels: readonly VesselType[]
): void {
    const { alchemist } = state.guilds
    for (const vessel of alchemist.vesselsForSale) {
        state.supply.vessels[vessel] += 1
    }
    for (const vessel of vessels) {
        state.supply.vessels[vessel] -= 1
    }
    alchemist.vesselsForSale = [...vessels]
}

/** Each Knight row, in order, holds this many markers, keeping totals. */
export function setRowMarkers(state: HydratedFeudumGameState, markers: readonly number[]): void {
    knightRows(state).forEach((entry, index) => {
        const { row } = entry
        const wanted = markers.at(index) ?? 0
        changeOwnerSupply(state, entry, row.markers - wanted)
        row.markers = wanted
    })
}

/** The place among the Knight rows of this seat's own row (R-1.4-H1). */
export function seatRowIndex(state: HydratedFeudumGameState, playerId: string): number {
    return knightRows(state).findIndex(({ row }) => rowSeat(row.owner) === playerId)
}

/** A seal of this value out of the pile. */
function sealOfValue(state: HydratedFeudumGameState, value: BeadValue): SealId {
    const vault = state.requireVault()
    const sealId = Seals.filter((seal) => seal.beadValue === value)
        .map((seal) => seal.id)
        .find((id) => vault.sealPile.includes(id))
    assert(sealId, `The pile holds a seal showing ${value}`)
    vault.sealPile.splice(vault.sealPile.indexOf(sealId), 1)
    state.supply.sealPileCount -= 1
    return sealId
}

/**
 * R-1.3 The rosary and the chickens hold beads of exactly these values, keeping totals: the
 * chickens' values fill their spaces in order.
 */
export function setBeads(
    state: HydratedFeudumGameState,
    { rosary, chickens }: { rosary: readonly BeadValue[]; chickens: readonly BeadValue[] }
): void {
    const vault = state.requireVault()
    const { farmer, monk } = state.guilds
    const held = [...monk.rosary, ...chickenBeads(farmer)]
    vault.sealPile.push(...held)
    state.supply.sealPileCount += held.length
    monk.rosary = rosary.map((value) => sealOfValue(state, value))
    farmer.chickens = recordFrom(
        ChickenSpaces.map(({ id }) => id),
        (_, index) => {
            const value = chickens.at(index)
            return value === undefined ? null : sealOfValue(state, value)
        }
    )
}

/** R-5-H1 Exactly these scroll spaces hold a concealed seal, keeping totals. */
export function setScrolls(state: HydratedFeudumGameState, filled: readonly ScrollSpaceId[]): void {
    for (const { id } of ScrollSpaces) {
        const wanted = filled.includes(id)
        if (state.guilds.noble.scrolls[id] && !wanted) {
            moveConcealedSeal(state, { kind: 'scroll', spaceId: id }, { kind: 'pile' })
        } else if (!state.guilds.noble.scrolls[id] && wanted) {
            moveConcealedSeal(state, { kind: 'pile' }, { kind: 'scroll', spaceId: id })
        }
    }
}

/** Nothing on the guild boards, so a spec's offers are only those it arranges. */
export function clearGuilds(state: HydratedFeudumGameState): void {
    setBarn(state, {})
    setMarket(state, {})
    setCarts(state, {})
    setRowMarkers(state, [])
    setScrolls(state, [])
    setVesselsForSale(state, [])
}

export interface GuildTable extends TurnTable {
    readonly session: FeudumGameSession
    /** The seat after `other`. */
    readonly third: string
}

export type GuildArrange = (state: HydratedFeudumGameState, table: GuildSeats) => void

export interface GuildSeats {
    readonly seat: string
    readonly other: string
    readonly third: string
}

/** R-3.2 The seat asked holds these cards, the guild boards hold what `arrange` puts there. */
export async function guildTable(
    arrange: GuildArrange = () => {},
    cards: readonly ActionCardKind[] = ['guild', 'move', 'tax']
): Promise<GuildTable> {
    const turn = await atPlayingCards(cards)
    const { host, seat, other } = turn
    const third = host.order.find((id) => id !== seat && id !== other)
    assert(third, 'Three seats play')
    host.edit((state) => {
        clearGuilds(state)
        arrange(state, { seat, other, third })
        state.recomputeRanks()
    })
    return { ...turn, third, session: await host.openSeat(seat) }
}
