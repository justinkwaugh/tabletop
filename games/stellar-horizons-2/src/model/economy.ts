import * as Type from 'typebox'
import { assertExists } from '@tabletop/common'
import { baseProductionRow } from '../components/factionSheets.js'
import { ECONOMIC_TILES, EconomicTile } from '../components/economicTiles.js'
import { TECH_FIELDS } from '../components/techFields.js'
import { worldFace } from '../components/worlds.js'
import { baseEffects, blocksBases } from './anomalies.js'
import { effectiveHabitability, factionAbilities } from './campaign.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { CASH_PRODUCTION, Production, type Base } from './pieces.js'
import { awardTechMarkers } from './pools.js'
import { removeBaseSettlement, addSettlements } from './settling.js'

// Rulebook 4.0: tiles are drawn without replacement and reshuffled once all seven are used,
// and the tile of the turn before is never drawn twice running.
export function drawEconomicTile(state: HydratedStellarHorizonsGameState): EconomicTile {
    if (state.economicTilePool.length === 0) {
        state.economicTilePool = [...ECONOMIC_TILES]
    }
    const previous = state.economicTile
    const candidates = state.economicTilePool.filter((tile) => tile !== previous)
    const random = state.getProtectedPrng()
    const tile = candidates[random.randInt(candidates.length)]
    state.economicTilePool.splice(state.economicTilePool.indexOf(tile), 1)
    state.economicTile = tile
    return tile
}

// Rulebook 4.1: up to 3 IP may be declared, each adding 20% to the initiative roll.
export const MAX_INITIATIVE_BID = 3
export const INITIATIVE_PER_INFLUENCE = 20

export function maxInitiativeBid(state: HydratedStellarHorizonsGameState, playerId: string) {
    return Math.min(MAX_INITIATIVE_BID, state.getPlayerState(playerId).influence)
}

export type InitiativeRoll = Type.Static<typeof InitiativeRoll>
export const InitiativeRoll = Type.Object({
    playerId: Type.String(),
    bid: Type.Number(),
    roll: Type.Number(),
    total: Type.Number()
})

// Ties go to whoever had the better initiative before the roll.
export function rollInitiative(state: HydratedStellarHorizonsGameState): InitiativeRoll[] {
    const random = state.getProtectedPrng()
    const previous = state.initiativeOrder()
    const rolls = previous.map((playerId) => {
        const player = state.getPlayerState(playerId)
        const bid = player.initiativeBid ?? 0
        player.initiativeBid = undefined
        const roll = random.dieRoll(100)
        return { playerId, bid, roll, total: roll + bid * INITIATIVE_PER_INFLUENCE }
    })
    const order = rolls
        .map((roll, index) => ({ roll, index }))
        .toSorted((a, b) => b.roll.total - a.roll.total || a.index - b.index)
        .map(({ roll }) => roll.playerId)
    state.turnManager.reorder(order)
    return rolls
}

// Rulebook 4.4: a base produces cash or one tech type, the highest value its system's worlds
// show for it, plus the bonus for its settlements.
export function productionValue(
    state: HydratedStellarHorizonsGameState,
    systemId: string,
    production: Production
): number {
    return state.systemState(systemId).worlds.reduce((best, world) => {
        const face = worldFace(world.tileId, world.side)
        if (!face) {
            return best
        }
        const value =
            production === CASH_PRODUCTION
                ? face.cash
                : face.techField === production
                  ? face.techValue
                  : 0
        return Math.max(best, value)
    }, 0)
}

export function productionYield(
    state: HydratedStellarHorizonsGameState,
    base: Base,
    production: Production
): number {
    const effects = baseEffects(state, base.systemId)
    const row = baseProductionRow(
        effects.settlementsDoubledForProduction ? base.settlements * 2 : base.settlements
    )
    const anomaly =
        production === CASH_PRODUCTION
            ? (effects.cashProduction ?? 0)
            : effects.markerProduction?.fields.includes(production)
              ? effects.markerProduction.count
              : 0
    const bonus = production === CASH_PRODUCTION ? row.cashBonus : row.techBonus
    return productionValue(state, base.systemId, production) + bonus + anomaly
}

// A base in a system with a "no bases" anomaly produces nothing until it is resolved (1.16).
export function producingBases(state: HydratedStellarHorizonsGameState, playerId: string): Base[] {
    return state.basesOf(playerId).filter((base) => !blocksBases(state, base.systemId))
}

export function basesAwaitingProduction(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): Base[] {
    return producingBases(state, playerId).filter((base) => base.production === undefined)
}

// What a base may produce: cash, or a tech type one of its system's worlds shows.
export function availableProductions(
    state: HydratedStellarHorizonsGameState,
    base: Base
): Production[] {
    return [
        CASH_PRODUCTION,
        ...TECH_FIELDS.filter((field) => productionValue(state, base.systemId, field) > 0)
    ]
}

export type BaseProductionResult = Type.Static<typeof BaseProductionResult>
export const BaseProductionResult = Type.Object({
    playerId: Type.String(),
    systemId: Type.String(),
    production: Production,
    amount: Type.Number(),
    markers: Type.Array(Type.Number()),
    cash: Type.Number(),
    settlements: Type.Number()
})

// Hostile Xenomorphs take a settlement during production; Symbiotic Spores add one after it,
// even above the population limit.
function settleProductionEffects(state: HydratedStellarHorizonsGameState, base: Base): number {
    const effects = baseEffects(state, base.systemId)
    for (let loss = 0; loss < (effects.settlementLossInProduction ?? 0); loss++) {
        if (state.base(base.playerId, base.systemId)) {
            removeBaseSettlement(state, base.playerId, base.systemId)
        }
    }
    const gain = effects.settlementAfterProduction ?? 0
    if (gain > 0 && state.base(base.playerId, base.systemId)) {
        addSettlements(state, base.playerId, base.systemId, gain)
    }
    return gain - (effects.settlementLossInProduction ?? 0)
}

function payCash(state: HydratedStellarHorizonsGameState, playerId: string, amount: number) {
    state.getPlayerState(playerId).cash += amount
    return { markers: [], cash: amount }
}

// Production is collected on the Main Line once every base has chosen, in initiative order,
// since tech markers come from the shared pools.
export function produceAtBases(state: HydratedStellarHorizonsGameState): BaseProductionResult[] {
    const results: BaseProductionResult[] = []
    for (const playerId of state.initiativeOrder()) {
        for (const base of state.basesOf(playerId)) {
            const production = base.production
            base.production = undefined
            if (production === undefined || blocksBases(state, base.systemId)) {
                continue
            }
            const amount = productionYield(state, base, production)
            const { markers, cash } =
                production === CASH_PRODUCTION
                    ? payCash(state, playerId, amount)
                    : awardTechMarkers(state, playerId, production, amount)
            const settlements = settleProductionEffects(state, base)
            results.push({
                playerId,
                systemId: base.systemId,
                production,
                amount,
                markers,
                cash,
                settlements
            })
        }
    }
    return results
}

// Rulebook 4.6.
export const GROWTH_STEP = 10
export const POPULATION_LIMIT_PER_RIVAL = 10
export const CATCH_UP_STEP = 10
export const CATCH_UP_BONUS = 10
export const MAX_CHANCE = 100

export function systemPopulationLimit(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string
): number {
    const worlds = state.systemState(systemId).worlds.reduce((total, world) => {
        const face = worldFace(world.tileId, world.side)
        return total + (face?.maxPopulation ?? 0)
    }, 0)
    const rivals = state
        .allBases()
        .filter((base) => base.systemId === systemId && base.playerId !== playerId).length
    const tunnels = baseEffects(state, systemId).populationLimit ?? 0
    return worlds + tunnels - POPULATION_LIMIT_PER_RIVAL * rivals
}

export function totalSettlements(state: HydratedStellarHorizonsGameState, playerId: string) {
    return state.basesOf(playerId).reduce((total, base) => total + base.settlements, 0)
}

export function migrationChance(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string,
    behindLeader: number
): number {
    const bonus = Math.floor(Math.max(0, behindLeader) / CATCH_UP_STEP) * CATCH_UP_BONUS
    const anomaly = baseEffects(state, systemId).migrationHabitability ?? 0
    return Math.min(MAX_CHANCE, effectiveHabitability(state, playerId, systemId) + anomaly + bonus)
}

export type GrowthResult = Type.Static<typeof GrowthResult>
export const GrowthResult = Type.Object({
    playerId: Type.String(),
    systemId: Type.String(),
    before: Type.Number(),
    growthRoll: Type.Optional(Type.Number()),
    growth: Type.Number(),
    migrationRoll: Type.Number(),
    migrationChance: Type.Number(),
    migration: Type.Number(),
    limit: Type.Number(),
    after: Type.Number()
})

// Rulebook 4.6: growth, then migration, each capped by the system's population limit for the
// base's owner.
export function growSettlements(state: HydratedStellarHorizonsGameState): GrowthResult[] {
    const random = state.getProtectedPrng()
    // The catch-up bonus compares the settlements Players had as the phase began.
    const startTotals: Record<string, number> = Object.fromEntries(
        state.players.map((player) => [player.playerId, totalSettlements(state, player.playerId)])
    )
    const leader = Math.max(0, ...Object.values(startTotals))
    const results: GrowthResult[] = []
    for (const playerId of state.initiativeOrder()) {
        for (const base of state.basesOf(playerId)) {
            if (blocksBases(state, base.systemId)) {
                continue
            }
            const before = base.settlements
            const migrationRoll = random.dieRoll(100)
            const growthRoll = before > GROWTH_STEP ? random.dieRoll(10) : undefined
            const fullSteps = Math.floor(before / GROWTH_STEP)
            const remainder = before % GROWTH_STEP
            const growth =
                before <= GROWTH_STEP
                    ? 1
                    : fullSteps + (growthRoll !== undefined && growthRoll <= remainder ? 1 : 0)
            const chance = migrationChance(
                state,
                playerId,
                base.systemId,
                leader - startTotals[playerId]
            )
            // Stunning Vistas add a settlement in migration, within the limit like the rest.
            const migration =
                (migrationRoll <= chance ? 1 : 0) +
                (baseEffects(state, base.systemId).migrationSettlement ?? 0)
            const limit = systemPopulationLimit(state, playerId, base.systemId)
            const after = Math.max(before, Math.min(limit, before + growth + migration))
            base.settlements = after
            results.push({
                playerId,
                systemId: base.systemId,
                before,
                growthRoll,
                growth,
                migrationRoll,
                migrationChance: chance,
                migration,
                limit,
                after
            })
        }
    }
    return results
}

// The True Path's first ability: after growth, in one system where they and another player
// both have bases, a die roll of 4 or less converts one of that player's settlements.
export const CONVERSION_ROLL = 4

export function conversionTargets(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): Base[] {
    if (!factionAbilities(state, playerId).converts) {
        return []
    }
    const systems = new Set(state.basesOf(playerId).map((base) => base.systemId))
    return state
        .allBases()
        .filter(
            (base) =>
                base.playerId !== playerId &&
                systems.has(base.systemId) &&
                base.settlements > 1 &&
                !blocksBases(state, base.systemId)
        )
}

export function converters(state: HydratedStellarHorizonsGameState): string[] {
    return state
        .initiativeOrder()
        .filter((playerId) => conversionTargets(state, playerId).length > 0)
}

export type ConversionResult = Type.Static<typeof ConversionResult>
export const ConversionResult = Type.Object({
    roll: Type.Number(),
    converted: Type.Boolean()
})

export function convertSettlement(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string,
    targetPlayerId: string
): ConversionResult {
    const target = state.base(targetPlayerId, systemId)
    assertExists(target, `No base of ${targetPlayerId} in ${systemId}`)
    const roll = state.getProtectedPrng().dieRoll(10)
    const converted = roll <= CONVERSION_ROLL
    if (converted) {
        removeBaseSettlement(state, targetPlayerId, systemId)
        addSettlements(state, playerId, systemId, 1)
    }
    return { roll, converted }
}
