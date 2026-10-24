import * as Type from 'typebox'
import { assertExists } from '@tabletop/common'
import { DirectiveType } from '../components/directives.js'
import { baseProductionRow } from '../components/factionSheets.js'
import { SOL_SYSTEM_ID, systemDistance } from '../components/systems.js'
import { TradeGood, tradeGoodDefinition } from '../components/tradeGoods.js'
import { WorldClass } from '../components/worldTypes.js'
import { worldTile } from '../components/worlds.js'
import { baseEffects, blocksBases } from './anomalies.js'
import {
    CargoPartnerKind,
    type CargoPartner,
    cargoPartners,
    carriesCargo,
    sameCargoPartner
} from './cargoTransfer.js'
import { currentCenturyRow, factionAbilities, gainInfluence, isCampaign } from './campaign.js'
import { replaceDemand, demandedGoods } from './demand.js'
import { recordDirectiveProgresses } from './directives.js'
import { smuggled } from './events.js'
import { capabilitiesOf, freeCargo, hasArrived } from './fleet.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { type Base, FulfilledDirective, type GoodsReward, type ShipState } from './pieces.js'
import { discardGoods, drawFromPool } from './pools.js'

// Rulebook 1.9 and 4.5.
export const EARTH_STORAGE = 10
export const MAX_GOODS = 12
export const GOOD_CASH = 1
export const SALE_INFLUENCE = 1
export const SALE_PAYMENT = 1

export enum GoodsHolderKind {
    Earth = 'Earth',
    Base = 'Base',
    Ship = 'Ship'
}

export type EarthHolder = Type.Static<typeof EarthHolder>
export const EarthHolder = Type.Object({ kind: Type.Literal(GoodsHolderKind.Earth) })
export type BaseHolder = Type.Static<typeof BaseHolder>
export const BaseHolder = Type.Object({
    kind: Type.Literal(GoodsHolderKind.Base),
    systemId: Type.String()
})
export type ShipHolder = Type.Static<typeof ShipHolder>
export const ShipHolder = Type.Object({
    kind: Type.Literal(GoodsHolderKind.Ship),
    shipId: Type.String()
})

export const EARTH_HOLDER: EarthHolder = { kind: GoodsHolderKind.Earth }

export function baseHolder(systemId: string): BaseHolder {
    return { kind: GoodsHolderKind.Base, systemId }
}

export function shipHolder(shipId: string): ShipHolder {
    return { kind: GoodsHolderKind.Ship, shipId }
}

export type GoodsHolder = Type.Static<typeof GoodsHolder>
export const GoodsHolder = Type.Union([EarthHolder, BaseHolder, ShipHolder])

export type GoodsStore = Type.Static<typeof GoodsStore>
export const GoodsStore = Type.Union([EarthHolder, BaseHolder])

export type GoodsCount = Type.Static<typeof GoodsCount>
export const GoodsCount = Type.Object({
    holder: GoodsHolder,
    count: Type.Integer()
})

export function sameHolder(a: GoodsHolder, b: GoodsHolder): boolean {
    switch (a.kind) {
        case GoodsHolderKind.Earth:
            return b.kind === GoodsHolderKind.Earth
        case GoodsHolderKind.Base:
            return b.kind === GoodsHolderKind.Base && a.systemId === b.systemId
        case GoodsHolderKind.Ship:
            return b.kind === GoodsHolderKind.Ship && a.shipId === b.shipId
    }
}

// The goods a Player keeps at a holder, or undefined if it is not theirs.
export function heldGoods(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    holder: GoodsHolder
): TradeGood[] | undefined {
    switch (holder.kind) {
        case GoodsHolderKind.Earth:
            return state.getPlayerState(playerId).earthGoods
        case GoodsHolderKind.Base:
            return state.base(playerId, holder.systemId)?.goods
        case GoodsHolderKind.Ship:
            return state.playerShip(playerId, holder.shipId)?.goods
    }
}

export function countOf(goods: readonly TradeGood[], good: TradeGood): number {
    return goods.filter((candidate) => candidate === good).length
}

function takeGoods(goods: TradeGood[], good: TradeGood, count: number) {
    for (let taken = 0; taken < count; taken++) {
        const index = goods.indexOf(good)
        if (index < 0) {
            throw new Error(`No ${good} to take`)
        }
        goods.splice(index, 1)
    }
}

function repeat(good: TradeGood, count: number): TradeGood[] {
    return Array.from({ length: count }, () => good)
}

export function goodsCount(state: HydratedStellarHorizonsGameState, playerId: string): number {
    return (
        state.getPlayerState(playerId).earthGoods.length +
        state.basesOf(playerId).reduce((total, base) => total + base.goods.length, 0) +
        state.shipsOf(playerId).reduce((total, ship) => total + ship.goods.length, 0)
    )
}

export function holdsAnyGoods(state: HydratedStellarHorizonsGameState, playerId: string) {
    return goodsCount(state, playerId) > 0
}

// A base takes as many goods a turn as its settlements allow on the Faction Sheet's base
// production table, and stores twice that.
export function assignmentLimit(base: Base): number {
    return baseProductionRow(base.settlements).tradeGoods
}

export function storageLimit(base: Base): number {
    return 2 * assignmentLimit(base)
}

// Earth and Earthlike moons count as M-class for trade, and Sol is Earth's system.
export function tradeWorldClasses(
    state: HydratedStellarHorizonsGameState,
    systemId: string
): WorldClass[] {
    if (systemId === SOL_SYSTEM_ID) {
        return [WorldClass.M]
    }
    return state.systemState(systemId).worlds.flatMap((world) => {
        const worldClass = worldTile(world.tileId).worldClass
        if (worldClass === WorldClass.None) {
            return []
        }
        return [worldClass === WorldClass.E ? WorldClass.M : worldClass]
    })
}

// Destroying a good earns $1B, at any time outside combat.
export function destroyGoods(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    holder: GoodsHolder,
    good: TradeGood,
    count: number
): number {
    const goods = heldGoods(state, playerId, holder)
    assertExists(goods, 'The goods are not the Player’s')
    takeGoods(goods, good, count)
    discardGoods(state, playerId, repeat(good, count))
    const cash = count * GOOD_CASH
    state.getPlayerState(playerId).cash += cash
    return cash
}

export function canDestroyGoods(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    holder: GoodsHolder,
    good: TradeGood,
    count: number
): boolean {
    const goods = heldGoods(state, playerId, holder)
    return (
        goods !== undefined && Number.isInteger(count) && count > 0 && countOf(goods, good) >= count
    )
}

// Rulebook 4.5: each Player draws the goods of their Faction Sheet's century, in initiative order
// since they come from one pool.
export type GoodsDraw = Type.Static<typeof GoodsDraw>
export const GoodsDraw = Type.Object({
    playerId: Type.String(),
    goods: Type.Array(Type.Enum(TradeGood))
})

export function drawTradeGoods(state: HydratedStellarHorizonsGameState): GoodsDraw[] {
    return state.initiativeOrder().map((playerId) => {
        // Trader's Guild and the genetic manipulations that name a good draw more.
        const count =
            (currentCenturyRow(state, playerId)?.tradeGoods ?? 0) +
            capabilitiesOf(state, playerId).extraGoods
        const goods = drawFromPool(state, state.goodsPool, count)
        state.getPlayerState(playerId).drawnGoods = goods
        return { playerId, goods }
    })
}

export type GoodsAssignment = Type.Static<typeof GoodsAssignment>
export const GoodsAssignment = Type.Object({
    good: Type.Enum(TradeGood),
    store: GoodsStore
})

// Culinary Geniuses, Gifted Artists and the skilled genetic manipulations let their goods be
// produced in any system (Gifted Artists' not at Sol): assigned to any base, or to Earth.
function producesAnywhere(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    good: TradeGood,
    systemId: string
): boolean {
    return capabilitiesOf(state, playerId).producesAnywhere.some(
        (entry) => entry.good === good && (!entry.exceptSol || systemId !== SOL_SYSTEM_ID)
    )
}

// A drawn good goes to a base with one of its world types, or to Earth if it lists M; never
// where a "no bases" anomaly or Smugglers stop the base taking goods.
export function assignmentSystems(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    good: TradeGood
): string[] {
    const producers = tradeGoodDefinition(good).producers
    return state
        .basesOf(playerId)
        .filter(
            (base) =>
                !blocksBases(state, base.systemId) &&
                !smuggled(state, base.systemId) &&
                (producesAnywhere(state, playerId, good, base.systemId) ||
                    tradeWorldClasses(state, base.systemId).some((worldClass) =>
                        producers.includes(worldClass)
                    ))
        )
        .map((base) => base.systemId)
}

export function canAssignToEarth(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    good: TradeGood
): boolean {
    return (
        tradeGoodDefinition(good).producers.includes(WorldClass.M) ||
        producesAnywhere(state, playerId, good, SOL_SYSTEM_ID)
    )
}

export interface StoreRoom {
    stored: number
    storage: number
}

// A base also limits the goods it takes each turn.
export interface BaseRoom extends StoreRoom {
    store: BaseHolder
    intake: number
}

function assignedTo(assignments: readonly GoodsAssignment[], store: GoodsStore): number {
    return assignments.filter((assignment) => sameHolder(assignment.store, store)).length
}

export function earthRoom(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    assignments: readonly GoodsAssignment[]
): StoreRoom {
    return {
        stored:
            state.getPlayerState(playerId).earthGoods.length +
            assignedTo(assignments, EARTH_HOLDER),
        storage: EARTH_STORAGE
    }
}

export function baseRooms(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    assignments: readonly GoodsAssignment[]
): BaseRoom[] {
    return state.basesOf(playerId).map((base) => {
        const store = baseHolder(base.systemId)
        const count = assignedTo(assignments, store)
        return {
            store,
            stored: base.goods.length + count,
            storage: storageLimit(base),
            intake: assignmentLimit(base) - base.goodsReceived - count
        }
    })
}

export function assignmentProblem(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    assignments: readonly GoodsAssignment[]
): string | undefined {
    const remaining = [...state.getPlayerState(playerId).drawnGoods]
    for (const assignment of assignments) {
        const index = remaining.indexOf(assignment.good)
        if (index < 0) {
            return `${tradeGoodDefinition(assignment.good).name} was not drawn`
        }
        remaining.splice(index, 1)
        const store = assignment.store
        const name = tradeGoodDefinition(assignment.good).name
        if (
            store.kind === GoodsHolderKind.Earth &&
            !canAssignToEarth(state, playerId, assignment.good)
        ) {
            return `${name} cannot go to Earth`
        }
        if (
            store.kind === GoodsHolderKind.Base &&
            !assignmentSystems(state, playerId, assignment.good).includes(store.systemId)
        ) {
            return `${name} cannot go to that base`
        }
    }
    const earth = earthRoom(state, playerId, assignments)
    if (earth.stored > earth.storage) {
        return `Earth stores ${earth.storage} goods`
    }
    for (const room of baseRooms(state, playerId, assignments)) {
        if (room.stored > room.storage) {
            return `That base stores ${room.storage} goods`
        }
        if (room.intake < 0) {
            return 'That base takes no more goods this turn'
        }
    }
    if (goodsCount(state, playerId) + assignments.length > MAX_GOODS) {
        return `A Player may hold ${MAX_GOODS} goods`
    }
    return undefined
}

export type AssignmentResult = Type.Static<typeof AssignmentResult>
export const AssignmentResult = Type.Object({
    discarded: Type.Array(Type.Enum(TradeGood)),
    cash: Type.Number()
})

// A good left unassigned is discarded for $1B.
export function assignGoods(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    assignments: readonly GoodsAssignment[]
): AssignmentResult {
    const player = state.getPlayerState(playerId)
    const discarded = [...player.drawnGoods]
    for (const assignment of assignments) {
        discarded.splice(discarded.indexOf(assignment.good), 1)
        const store = assignment.store
        if (store.kind === GoodsHolderKind.Earth) {
            player.earthGoods.push(assignment.good)
            continue
        }
        const base = state.base(playerId, store.systemId)
        assertExists(base, 'An assignment names a base')
        base.goods.push(assignment.good)
        base.goodsReceived += 1
    }
    player.drawnGoods = []
    discardGoods(state, playerId, discarded)
    const cash = discarded.length * GOOD_CASH
    player.cash += cash
    return { discarded, cash }
}

export type ProducedGoods = Type.Static<typeof ProducedGoods>
export const ProducedGoods = Type.Object({
    goods: Type.Array(Type.Enum(TradeGood)),
    cash: Type.Number()
})

// An anomaly back's goods production adds a good from the pool to each producing base there,
// or $1B when the pool has none; a good the base has no room to store is discarded for $1B.
export function produceGoods(state: HydratedStellarHorizonsGameState, base: Base): ProducedGoods {
    const produced: ProducedGoods = { goods: [], cash: 0 }
    if (smuggled(state, base.systemId)) {
        return produced
    }
    for (const good of baseEffects(state, base.systemId).goodsProduction ?? []) {
        const index = state.goodsPool.indexOf(good)
        if (index >= 0 && base.goods.length < storageLimit(base)) {
            state.goodsPool.splice(index, 1)
            base.goods.push(good)
            produced.goods.push(good)
        } else {
            produced.cash += GOOD_CASH
        }
    }
    state.getPlayerState(base.playerId).cash += produced.cash
    return produced
}

// Rulebook 1.16: an anomaly's goods go into the Player's cargo bays there or onto their base
// there, whatever its worlds, counting against its assignment limit (forum ruling); the rest
// are destroyed for $1B.
export function rewardGoodsHolders(
    state: HydratedStellarHorizonsGameState,
    reward: GoodsReward
): GoodsHolder[] {
    const ships: GoodsHolder[] = state
        .shipsOf(reward.playerId)
        .filter(
            (ship) =>
                ship.systemId === reward.systemId && hasArrived(ship) && freeCargo(state, ship) > 0
        )
        .map((ship) => shipHolder(ship.shipId))
    const base = state.base(reward.playerId, reward.systemId)
    return base !== undefined && baseRoomForReward(state, base) > 0
        ? [baseHolder(base.systemId), ...ships]
        : ships
}

function baseRoomForReward(state: HydratedStellarHorizonsGameState, base: Base): number {
    if (blocksBases(state, base.systemId)) {
        return 0
    }
    return Math.max(
        0,
        Math.min(assignmentLimit(base) - base.goodsReceived, storageLimit(base) - base.goods.length)
    )
}

function holderRoom(
    state: HydratedStellarHorizonsGameState,
    reward: GoodsReward,
    holder: GoodsHolder
): number {
    if (holder.kind === GoodsHolderKind.Base) {
        const base = state.base(reward.playerId, holder.systemId)
        return base === undefined ? 0 : baseRoomForReward(state, base)
    }
    if (holder.kind === GoodsHolderKind.Ship) {
        const ship = state.playerShip(reward.playerId, holder.shipId)
        return ship === undefined ? 0 : freeCargo(state, ship)
    }
    return 0
}

export function goodsRewardProblem(
    state: HydratedStellarHorizonsGameState,
    placements: readonly GoodsCount[]
): string | undefined {
    const reward = state.goodsRewards.at(0)
    if (!reward) {
        return 'No goods are waiting'
    }
    const allowed = rewardGoodsHolders(state, reward)
    let total = 0
    for (const [index, placement] of placements.entries()) {
        if (
            !Number.isInteger(placement.count) ||
            placement.count <= 0 ||
            !allowed.some((holder) => sameHolder(holder, placement.holder)) ||
            placements.findIndex((other) => sameHolder(other.holder, placement.holder)) !== index
        ) {
            return 'The goods cannot go there'
        }
        if (placement.count > holderRoom(state, reward, placement.holder)) {
            return 'There is no room for so many goods there'
        }
        total += placement.count
    }
    return total > reward.count ? 'More goods than the reward gives' : undefined
}

export type RewardGoodsResult = Type.Static<typeof RewardGoodsResult>
export const RewardGoodsResult = Type.Object({
    destroyed: Type.Number(),
    cash: Type.Number()
})

export function placeRewardGoods(
    state: HydratedStellarHorizonsGameState,
    placements: readonly GoodsCount[]
): RewardGoodsResult {
    const reward = state.goodsRewards.at(0)
    assertExists(reward, 'No goods are waiting')
    let placed = 0
    for (const placement of placements) {
        const goods = heldGoods(state, reward.playerId, placement.holder)
        assertExists(goods, 'A placement names the Player’s holder')
        goods.push(...repeat(reward.good, placement.count))
        if (placement.holder.kind === GoodsHolderKind.Base) {
            const base = state.base(reward.playerId, placement.holder.systemId)
            assertExists(base, 'A placement names a base')
            base.goodsReceived += placement.count
        }
        placed += placement.count
    }
    state.goodsRewards = state.goodsRewards.slice(1)
    return destroyRewardGoods(state, reward, reward.count - placed)
}

function destroyRewardGoods(
    state: HydratedStellarHorizonsGameState,
    reward: GoodsReward,
    count: number
): RewardGoodsResult {
    state.goodsPool.push(...repeat(reward.good, count))
    const cash = count * GOOD_CASH
    state.getPlayerState(reward.playerId).cash += cash
    return { destroyed: count, cash }
}

// Goods with nowhere to go are destroyed for $1B without asking.
export function destroyUnplaceableRewardGoods(state: HydratedStellarHorizonsGameState) {
    state.goodsRewards = state.goodsRewards.filter((reward) => {
        if (rewardGoodsHolders(state, reward).length > 0) {
            return true
        }
        destroyRewardGoods(state, reward, reward.count)
        return false
    })
}

// The goods a reward gives come out of the pool; with too few left, the rest pay $1B each.
export function queueRewardGoods(
    state: HydratedStellarHorizonsGameState,
    reward: Omit<GoodsReward, 'count'>,
    count: number
): number {
    const available = Math.min(count, countOf(state.goodsPool, reward.good))
    takeGoods(state.goodsPool, reward.good, available)
    if (available > 0) {
        state.goodsRewards.push({ ...reward, count: available })
    }
    const cash = (count - available) * GOOD_CASH
    state.getPlayerState(reward.playerId).cash += cash
    return cash
}

// Rulebook 1.9: the base price, $1B more for each world in the system of the types it favours
// and $1B less for each of the types that produce it, and off Earth the distance from Sol. The
// genetic manipulations that name a good sell it for $1B more; escalation markers take $1B or
// $2B off. It is never below $0.
export function salePrice(
    state: HydratedStellarHorizonsGameState,
    systemId: string,
    good: TradeGood,
    sellerId?: string
): number {
    const definition = tradeGoodDefinition(good)
    const classes = tradeWorldClasses(state, systemId)
    const favoured = classes.filter((worldClass) => definition.favoured.includes(worldClass))
    const producing = classes.filter((worldClass) => definition.producers.includes(worldClass))
    const distance = systemId === SOL_SYSTEM_ID ? 0 : systemDistance(SOL_SYSTEM_ID, systemId)
    const capabilities = sellerId === undefined ? undefined : capabilitiesOf(state, sellerId)
    const bonus = (capabilities?.saleBonus[good] ?? 0) + (capabilities?.saleChange ?? 0)
    return Math.max(0, definition.price + favoured.length - producing.length + distance + bonus)
}

// Where a Player's goods in a system are: their arrived ships and base there, or Earth at Sol.
export function goodsHoldersIn(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string
): GoodsHolder[] {
    const ships: GoodsHolder[] = state
        .shipsOf(playerId)
        .filter((ship) => ship.systemId === systemId && hasArrived(ship))
        .map((ship) => shipHolder(ship.shipId))
    if (systemId === SOL_SYSTEM_ID) {
        return [EARTH_HOLDER, ...ships]
    }
    return state.base(playerId, systemId) === undefined ? ships : [baseHolder(systemId), ...ships]
}

// Selling where another Player has a base and the seller has none pays one of them $1B a good;
// the Consortium pays nothing.
export function salePayees(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string
): string[] {
    if (
        factionAbilities(state, playerId).sellsWithoutPaying ||
        state.base(playerId, systemId) !== undefined
    ) {
        return []
    }
    return state
        .initiativeOrder()
        .filter((other) => other !== playerId && state.base(other, systemId) !== undefined)
}

export interface SaleOption {
    systemId: string
    good: TradeGood
    price: number
    sources: GoodsCount[]
    payeeIds: string[]
}

export function saleOptions(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): SaleOption[] {
    const systemIds = new Set([
        SOL_SYSTEM_ID,
        ...state.basesOf(playerId).map((base) => base.systemId),
        ...state
            .shipsOf(playerId)
            .filter((ship) => hasArrived(ship))
            .map((ship) => ship.systemId)
    ])
    return [...systemIds].flatMap((systemId) => {
        if (blocksBases(state, systemId)) {
            return []
        }
        return demandedGoods(state, systemId).flatMap((good) => {
            const sources = goodsHoldersIn(state, playerId, systemId).flatMap((holder) => {
                const count = countOf(heldGoods(state, playerId, holder) ?? [], good)
                return count > 0 ? [{ holder, count }] : []
            })
            return sources.length === 0
                ? []
                : [
                      {
                          systemId,
                          good,
                          price: salePrice(state, systemId, good, playerId),
                          sources,
                          payeeIds: salePayees(state, playerId, systemId)
                      }
                  ]
        })
    })
}

export type Sale = Type.Static<typeof Sale>
export const Sale = Type.Object({
    systemId: Type.String(),
    good: Type.Enum(TradeGood),
    sources: Type.Array(GoodsCount),
    payeeId: Type.Optional(Type.String())
})

export function saleProblem(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    sale: Sale
): string | undefined {
    const option = saleOptions(state, playerId).find(
        (candidate) => candidate.systemId === sale.systemId && candidate.good === sale.good
    )
    if (!option) {
        return 'That good cannot be sold there'
    }
    let count = 0
    for (const [index, source] of sale.sources.entries()) {
        const available = option.sources.find((candidate) =>
            sameHolder(candidate.holder, source.holder)
        )
        if (
            !available ||
            !Number.isInteger(source.count) ||
            source.count <= 0 ||
            source.count > available.count ||
            sale.sources.findIndex((other) => sameHolder(other.holder, source.holder)) !== index
        ) {
            return 'Those goods are not there to sell'
        }
        count += source.count
    }
    if (count === 0) {
        return 'Nothing to sell'
    }
    if (option.payeeIds.length > 0) {
        if (sale.payeeId === undefined || !option.payeeIds.includes(sale.payeeId)) {
            return 'Choose whom to pay'
        }
        if (state.getPlayerState(playerId).cash + count * option.price < count * SALE_PAYMENT) {
            return 'Not enough cash to pay for the sale'
        }
    } else if (sale.payeeId !== undefined) {
        return 'Nobody is owed for this sale'
    }
    return undefined
}

export type SaleResult = Type.Static<typeof SaleResult>
export const SaleResult = Type.Object({
    count: Type.Number(),
    price: Type.Number(),
    cash: Type.Number(),
    influence: Type.Number(),
    payment: Type.Number(),
    directives: Type.Optional(Type.Array(FulfilledDirective))
})

// Each good sold off Earth also earns 1 IP. The demand marker then goes back to the pool and the
// seller draws its replacement; Sol's stays.
export function sellGoods(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    sale: Sale
): SaleResult {
    const price = salePrice(state, sale.systemId, sale.good, playerId)
    let count = 0
    for (const source of sale.sources) {
        const goods = heldGoods(state, playerId, source.holder)
        assertExists(goods, 'A sale names the Player’s goods')
        takeGoods(goods, sale.good, source.count)
        count += source.count
    }
    state.goodsPool.push(...repeat(sale.good, count))
    const player = state.getPlayerState(playerId)
    const cash = count * price
    player.cash += cash
    const influence = sale.systemId === SOL_SYSTEM_ID ? 0 : count * SALE_INFLUENCE
    gainInfluence(state, playerId, influence)
    const payment = sale.payeeId === undefined ? 0 : count * SALE_PAYMENT
    if (sale.payeeId !== undefined) {
        player.cash -= payment
        state.getPlayerState(sale.payeeId).cash += payment
    }
    replaceDemand(state, playerId, sale.systemId, sale.good)
    // Rulebook 5.1's trade directives count each good sold over the turn.
    const directives = recordDirectiveProgresses(
        state,
        playerId,
        repeat(sale.good, count).map((good) => ({
            kind: DirectiveType.Trade,
            systemId: sale.systemId,
            good
        }))
    )
    return {
        count,
        price,
        cash,
        influence,
        payment,
        ...(directives.length > 0 ? { directives } : {})
    }
}

// Rule 1.9's loading and unloading, in the cargo and trade phase: between a ship and Earth at
// Sol, the Player's base in its system, or another of their ships there.
export interface GoodsTransferLimits {
    load: number
    unload: number
}

export function goodsTransferLimits(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState,
    partner: CargoPartner,
    good: TradeGood
): GoodsTransferLimits {
    const none = { load: 0, unload: 0 }
    if (!hasArrived(ship)) {
        return none
    }
    const aboard = countOf(ship.goods, good)
    const free = freeCargo(state, ship)
    switch (partner.kind) {
        case CargoPartnerKind.Earth: {
            if (ship.systemId !== SOL_SYSTEM_ID) {
                return none
            }
            const earth = state.getPlayerState(ship.playerId).earthGoods
            return {
                load: Math.min(countOf(earth, good), free),
                unload: Math.min(aboard, EARTH_STORAGE - earth.length)
            }
        }
        case CargoPartnerKind.Base: {
            const base = state.base(ship.playerId, ship.systemId)
            if (base === undefined) {
                return none
            }
            return {
                load: Math.min(countOf(base.goods, good), free),
                unload: blocksBases(state, base.systemId)
                    ? 0
                    : Math.max(0, Math.min(aboard, storageLimit(base) - base.goods.length))
            }
        }
        case CargoPartnerKind.Ship: {
            const other = state.playerShip(ship.playerId, partner.shipId)
            if (
                other === undefined ||
                other.shipId === ship.shipId ||
                other.systemId !== ship.systemId ||
                !hasArrived(other)
            ) {
                return none
            }
            return {
                load: Math.min(countOf(other.goods, good), free),
                unload: Math.min(aboard, freeCargo(state, other))
            }
        }
    }
}

export function goodsPartners(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState
): CargoPartner[] {
    if (!hasArrived(ship)) {
        return []
    }
    const partners: CargoPartner[] = []
    if (ship.systemId === SOL_SYSTEM_ID) {
        partners.push({ kind: CargoPartnerKind.Earth })
    }
    if (state.base(ship.playerId, ship.systemId) !== undefined) {
        partners.push({ kind: CargoPartnerKind.Base })
    }
    for (const other of state.shipsOf(ship.playerId)) {
        if (other.shipId !== ship.shipId && other.systemId === ship.systemId && hasArrived(other)) {
            partners.push({ kind: CargoPartnerKind.Ship, shipId: other.shipId })
        }
    }
    return partners
}

// What a ship may exchange cargo with; in the campaign goods move as well as settlements, with
// any partner but a ship that has no hold.
export function transferPartners(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState
): CargoPartner[] {
    const partners = cargoPartners(state, ship)
    if (!isCampaign(state)) {
        return partners
    }
    const goods = goodsPartners(state, ship).filter(
        (partner) =>
            !partners.some((candidate) => sameCargoPartner(candidate, partner)) &&
            (partner.kind !== CargoPartnerKind.Ship ||
                carriesCargo(state, state.ship(partner.shipId)))
    )
    return [...partners, ...goods]
}

export function canTransferAnyGoods(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): boolean {
    return state.shipsOf(playerId).some((ship) =>
        goodsPartners(state, ship).some((partner) =>
            Object.values(TradeGood).some((good) => {
                const limits = goodsTransferLimits(state, ship, partner, good)
                return limits.load > 0 || limits.unload > 0
            })
        )
    )
}

export function transferGoods(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState,
    partner: CargoPartner,
    good: TradeGood,
    count: number
) {
    const other = heldGoods(state, ship.playerId, partnerHolder(ship, partner))
    assertExists(other, 'The partner holds the Player’s goods')
    if (count > 0) {
        takeGoods(other, good, count)
        ship.goods.push(...repeat(good, count))
    } else {
        takeGoods(ship.goods, good, -count)
        other.push(...repeat(good, -count))
    }
}

// A cargo partner names its holder relative to the ship: the base is the one in its system.
function partnerHolder(ship: ShipState, partner: CargoPartner): GoodsHolder {
    switch (partner.kind) {
        case CargoPartnerKind.Earth:
            return EARTH_HOLDER
        case CargoPartnerKind.Base:
            return baseHolder(ship.systemId)
        case CargoPartnerKind.Ship:
            return shipHolder(partner.shipId)
    }
}
