import * as Type from 'typebox'
import { assertExists } from '@tabletop/common'
import { baseProductionRow } from '../components/factionSheets.js'
import { SOL_SYSTEM_ID, systemDistance } from '../components/systems.js'
import { TradeGood, tradeGoodDefinition } from '../components/tradeGoods.js'
import { WorldClass } from '../components/worldTypes.js'
import { worldTile } from '../components/worlds.js'
import { baseEffects, blocksBases } from './anomalies.js'
import { CargoPartnerKind, type CargoPartner } from './cargoTransfer.js'
import { currentCenturyRow, factionAbilities, gainInfluence } from './campaign.js'
import { replaceDemand, demandedGoods } from './demand.js'
import { smuggled } from './events.js'
import { freeCargo, hasArrived } from './fleet.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import type { Base, GoodsReward, ShipState } from './pieces.js'
import { discardGoods } from './pools.js'

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

export type GoodsHolder = Type.Static<typeof GoodsHolder>
export const GoodsHolder = Type.Union([
    Type.Object({ kind: Type.Literal(GoodsHolderKind.Earth) }),
    Type.Object({ kind: Type.Literal(GoodsHolderKind.Base), systemId: Type.String() }),
    Type.Object({ kind: Type.Literal(GoodsHolderKind.Ship), shipId: Type.String() })
])

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
    const random = state.getProtectedPrng()
    return state.initiativeOrder().map((playerId) => {
        const count = Math.min(
            state.goodsPool.length,
            currentCenturyRow(state, playerId)?.tradeGoods ?? 0
        )
        const goods = Array.from(
            { length: count },
            () => state.goodsPool.splice(random.randInt(state.goodsPool.length), 1)[0]
        )
        state.getPlayerState(playerId).drawnGoods = goods
        return { playerId, goods }
    })
}

export type GoodsAssignment = Type.Static<typeof GoodsAssignment>
export const GoodsAssignment = Type.Object({
    good: Type.Enum(TradeGood),
    // A base's system, or Earth when absent.
    systemId: Type.Optional(Type.String())
})

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
                tradeWorldClasses(state, base.systemId).some((worldClass) =>
                    producers.includes(worldClass)
                )
        )
        .map((base) => base.systemId)
}

export function canAssignToEarth(good: TradeGood): boolean {
    return tradeGoodDefinition(good).producers.includes(WorldClass.M)
}

export function assignmentProblem(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    assignments: readonly GoodsAssignment[]
): string | undefined {
    const player = state.getPlayerState(playerId)
    const remaining = [...player.drawnGoods]
    const perBase = new Map<string, number>()
    let toEarth = 0
    for (const assignment of assignments) {
        const index = remaining.indexOf(assignment.good)
        if (index < 0) {
            return `${tradeGoodDefinition(assignment.good).name} was not drawn`
        }
        remaining.splice(index, 1)
        if (assignment.systemId === undefined) {
            if (!canAssignToEarth(assignment.good)) {
                return `${tradeGoodDefinition(assignment.good).name} cannot go to Earth`
            }
            toEarth += 1
            continue
        }
        if (!assignmentSystems(state, playerId, assignment.good).includes(assignment.systemId)) {
            return `${tradeGoodDefinition(assignment.good).name} cannot go to that base`
        }
        perBase.set(assignment.systemId, (perBase.get(assignment.systemId) ?? 0) + 1)
    }
    if (player.earthGoods.length + toEarth > EARTH_STORAGE) {
        return `Earth stores ${EARTH_STORAGE} goods`
    }
    for (const [systemId, count] of perBase) {
        const base = state.base(playerId, systemId)
        assertExists(base, 'An assignment names a base')
        if (base.goodsReceived + count > assignmentLimit(base)) {
            return `That base takes ${assignmentLimit(base)} goods a turn`
        }
        if (base.goods.length + count > storageLimit(base)) {
            return `That base stores ${storageLimit(base)} goods`
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
        if (assignment.systemId === undefined) {
            player.earthGoods.push(assignment.good)
            continue
        }
        const base = state.base(playerId, assignment.systemId)
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
        .map((ship) => ({ kind: GoodsHolderKind.Ship, shipId: ship.shipId }))
    const base = state.base(reward.playerId, reward.systemId)
    return base !== undefined && baseRoomForReward(state, base) > 0
        ? [{ kind: GoodsHolderKind.Base, systemId: base.systemId }, ...ships]
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
// and $1B less for each of the types that produce it, and off Earth the distance from Sol.
export function salePrice(
    state: HydratedStellarHorizonsGameState,
    systemId: string,
    good: TradeGood
): number {
    const definition = tradeGoodDefinition(good)
    const classes = tradeWorldClasses(state, systemId)
    const favoured = classes.filter((worldClass) => definition.favoured.includes(worldClass))
    const producing = classes.filter((worldClass) => definition.producers.includes(worldClass))
    const distance = systemId === SOL_SYSTEM_ID ? 0 : systemDistance(SOL_SYSTEM_ID, systemId)
    return Math.max(0, definition.price + favoured.length - producing.length + distance)
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
        .map((ship) => ({ kind: GoodsHolderKind.Ship, shipId: ship.shipId }))
    if (systemId === SOL_SYSTEM_ID) {
        return [{ kind: GoodsHolderKind.Earth }, ...ships]
    }
    return state.base(playerId, systemId) === undefined
        ? ships
        : [{ kind: GoodsHolderKind.Base, systemId }, ...ships]
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
                          price: salePrice(state, systemId, good),
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
    payment: Type.Number()
})

// Each good sold off Earth also earns 1 IP. The demand marker then goes back to the pool and the
// seller draws its replacement; Sol's stays.
export function sellGoods(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    sale: Sale
): SaleResult {
    const price = salePrice(state, sale.systemId, sale.good)
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
    replaceDemand(state, playerId, sale.systemId)
    return { count, price, cash, influence, payment }
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

// `count` counts goods moving onto the ship; a negative number moves them off it.
export function transferGoods(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState,
    partner: CargoPartner,
    good: TradeGood,
    count: number
) {
    const other = partnerGoods(state, ship, partner)
    if (count > 0) {
        takeGoods(other, good, count)
        ship.goods.push(...repeat(good, count))
    } else {
        takeGoods(ship.goods, good, -count)
        other.push(...repeat(good, -count))
    }
}

function partnerGoods(
    state: HydratedStellarHorizonsGameState,
    ship: ShipState,
    partner: CargoPartner
): TradeGood[] {
    const holder: GoodsHolder =
        partner.kind === CargoPartnerKind.Earth
            ? { kind: GoodsHolderKind.Earth }
            : partner.kind === CargoPartnerKind.Base
              ? { kind: GoodsHolderKind.Base, systemId: ship.systemId }
              : { kind: GoodsHolderKind.Ship, shipId: partner.shipId }
    const goods = heldGoods(state, ship.playerId, holder)
    assertExists(goods, 'The partner holds the Player’s goods')
    return goods
}
