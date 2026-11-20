import { assert, type GameAction } from '@tabletop/common'
import type { SpaceId } from '../data/board.js'
import type { ActionCardKind } from '../data/cards.js'
import { Goods, type Good, type GuildId, type VesselType } from '../data/components.js'
import {
    AlchemistCartSpaces,
    ChickenSpaces,
    MarketSpaces,
    ScrollSpaces,
    type ScrollSpaceId
} from '../data/guilds.js'
import { Seals, type BeadValue, type SealId } from '../data/seals.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { changeOwnerSupply, knightRows } from '../model/knightRows.js'
import { placeMarker } from '../model/locationControl.js'
import { moveConcealedSeal } from '../model/seals.js'
import { chickenBeads } from '../model/guildsState.js'
import { recordFrom, type GoodCounts } from '../model/stateSchemas.js'
import { setUp, spaceOfKind } from './improving.js'
import { tableAtPlayingCards, type Table } from './table.js'

export const StandingSpace: SpaceId = 'space.desert.3'

export type GoodAmounts = Readonly<Partial<Record<Good, number>>>

/** R-4.5.1 The seat's pawns on the board are of these characters, one star each. */
export function setPawns(
    state: HydratedFeudumGameState,
    playerId: string,
    characters: readonly GuildId[]
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

/** R-4.5.3 Real stars, so a recompute keeps it: three pawns outrank two, two outrank one. */
export function setMaster(state: HydratedFeudumGameState, playerId: string, guild: GuildId): void {
    setPawns(state, playerId, [guild, guild, guild])
    state.recomputeRanks(playerId)
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
    state.recomputeRanks(playerId)
}

/** Moves goods between a place and the haversack, keeping totals. */
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
    knightRows(state).forEach(({ row }, index) => {
        const wanted = markers.at(index) ?? row.markers
        changeOwnerSupply(state, row.owner, row.markers - wanted)
        row.markers = wanted
    })
}

/** A seal of this value out of the pile, swapped off a scroll first if one lies there. */
function takeSealOfValue(state: HydratedFeudumGameState, value: BeadValue): SealId {
    const vault = state.requireVault()
    const ofValue = Seals.filter((seal) => seal.beadValue === value).map((seal) => seal.id)
    const inPile = ofValue.find((sealId) => vault.sealPile.includes(sealId))
    if (inPile) {
        vault.sealPile.splice(vault.sealPile.indexOf(inPile), 1)
        state.supply.sealPileCount -= 1
        return inPile
    }
    const scroll = ScrollSpaces.find(({ id }) => {
        const sealId = vault.scrollSeals[id]
        return sealId !== undefined && ofValue.includes(sealId)
    })
    assert(scroll, `No free seal shows ${value}`)
    const sealId = vault.scrollSeals[scroll.id]
    const replacement = vault.sealPile.shift()
    assert(sealId && replacement, 'A swap takes a seal from each')
    vault.scrollSeals[scroll.id] = replacement
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
    monk.rosary = rosary.map((value) => takeSealOfValue(state, value))
    farmer.chickens = recordFrom(
        ChickenSpaces.map(({ id }) => id),
        (_, index) => {
            const value = chickens.at(index)
            return value === undefined ? null : takeSealOfValue(state, value)
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

/** R-5-H1 The seal on this scroll space shows this value, swapped with another, keeping totals. */
export function setScrollSeal(
    state: HydratedFeudumGameState,
    spaceId: ScrollSpaceId,
    value: BeadValue
): void {
    const vault = state.requireVault()
    const held = vault.scrollSeals[spaceId]
    assert(held, `No seal lies on ${spaceId}`)
    delete vault.scrollSeals[spaceId]
    vault.sealPile.push(held)
    state.supply.sealPileCount += 1
    vault.scrollSeals[spaceId] = takeSealOfValue(state, value)
}

/** The general supply holds this many seals; the rest go to this seat, keeping totals. */
export function setSealPile(state: HydratedFeudumGameState, playerId: string, count: number): void {
    while (state.supply.sealPileCount > count) {
        moveConcealedSeal(state, { kind: 'pile' }, { kind: 'held', playerId })
    }
}

export interface GuildTable {
    readonly table: Table
    readonly playerId: string
    readonly others: readonly string[]
}

/** R-3.2 The seat asked holds the Guild card, and `edit` sets the guilds. */
export function tableAtGuild(
    edit: (
        state: HydratedFeudumGameState,
        playerId: string,
        others: readonly string[]
    ) => void = () => {},
    cards: ActionCardKind[] = ['guild', 'move', 'tax']
): GuildTable {
    const table = tableAtPlayingCards(() => ({ cards }))
    const playerId = table.asked
    const others = table.order.filter((seat) => seat !== playerId)
    setUp(table, (state) => edit(state, playerId, others))
    return { table, playerId, others }
}

/** R-3.16.1 A farm the seat rules, holding these goods. */
export function ruleFarm(
    state: HydratedFeudumGameState,
    playerId: string,
    amounts: GoodAmounts
): SpaceId {
    const spaceId = spaceOfKind(state, 'farm')
    placeMarker(state, playerId, spaceId)
    setFarmGoods(state, spaceId, amounts)
    return spaceId
}

/** What an Action records for the history, as text: its metadata, without the engine's patches. */
export function recordedText(action: GameAction): string {
    return 'metadata' in action ? JSON.stringify(action.metadata) : ''
}
