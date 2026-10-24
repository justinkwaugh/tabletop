import * as Type from 'typebox'
import { assertExists } from '@tabletop/common'
import { baseProductionRow } from '../components/factionSheets.js'
import { DirectiveProduction, DirectiveType } from '../components/directives.js'
import { ECONOMIC_TILES, EconomicTile } from '../components/economicTiles.js'
import { isDwarfStar, systemDefinition } from '../components/systems.js'
import { TECH_FIELDS } from '../components/techFields.js'
import { WorldClass } from '../components/worldTypes.js'
import { worldFace, worldTile } from '../components/worlds.js'
import { baseEffects, blocksBases } from './anomalies.js'
import { isBlockaded } from './blockades.js'
import { effectiveHabitability } from './campaign.js'
import { capabilitiesOf } from './fleet.js'
import { halts } from './events.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { CASH_PRODUCTION, type FulfilledDirective, Production, type Base } from './pieces.js'
import { recordDirectiveProgress } from './directives.js'
import { awardTechMarkers } from './pools.js'
import { removeBaseSettlement, addSettlements } from './settling.js'
import { roundHalfUp } from './turn.js'
import { ProducedGoods, produceGoods } from './trade.js'

// Rulebook 4.0: tiles are drawn without replacement and reshuffled once all seven are used,
// and the tile of the turn before is never drawn twice running.
export function economicTileChoices(state: HydratedStellarHorizonsGameState): EconomicTile[] {
    const pool = state.economicTilePool.length === 0 ? ECONOMIC_TILES : state.economicTilePool
    return pool.filter((tile) => tile !== state.economicTile)
}

export function takeEconomicTile(state: HydratedStellarHorizonsGameState, tile: EconomicTile) {
    if (state.economicTilePool.length === 0) {
        state.economicTilePool = [...ECONOMIC_TILES]
    }
    state.economicTilePool.splice(state.economicTilePool.indexOf(tile), 1)
    state.economicTile = tile
}

export function drawEconomicTile(state: HydratedStellarHorizonsGameState): EconomicTile {
    const candidates = economicTileChoices(state)
    const tile = candidates[state.getProtectedPrng().randInt(candidates.length)]
    takeEconomicTile(state, tile)
    return tile
}

// Hive Mind's owner chooses the tile from those left instead of drawing it.
export function economicTileChooser(state: HydratedStellarHorizonsGameState): string | undefined {
    return state
        .initiativeOrder()
        .find((playerId) => capabilitiesOf(state, playerId).choosesEconomicTile)
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
    // Cunning's +20% and the escalation markers' penalties.
    modifier: Type.Number(),
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
        const modifier = capabilitiesOf(state, playerId).initiativeBonus
        return {
            playerId,
            bid,
            roll,
            modifier,
            total: roll + bid * INITIATIVE_PER_INFLUENCE + modifier
        }
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

// A blockaded base produces half, rounded 0.5 up, and no anomaly bonus, Natural Stimulants'
// doubled settlements included (rulebook 4.4; forum: production bonuses apply only at
// unblockaded bases).
export function productionYield(
    state: HydratedStellarHorizonsGameState,
    base: Base,
    production: Production
): number {
    const blockaded = isBlockaded(state, base.playerId, base.systemId)
    const effects = baseEffects(state, base.systemId)
    const row = baseProductionRow(
        effects.settlementsDoubledForProduction && !blockaded
            ? base.settlements * 2
            : base.settlements
    )
    const anomaly = blockaded
        ? 0
        : production === CASH_PRODUCTION
          ? (effects.cashProduction ?? 0)
          : effects.markerProduction?.fields.includes(production)
            ? effects.markerProduction.count
            : 0
    const bonus = production === CASH_PRODUCTION ? row.cashBonus : row.techBonus
    // Robo Miners, Deep Core Mining and the Interstellar Mining Conglomerate.
    const cards =
        production === CASH_PRODUCTION ? capabilitiesOf(state, base.playerId).cashProduction : 0
    const total = productionValue(state, base.systemId, production) + bonus + cards
    return blockaded ? roundHalfUp(total / 2) : total + anomaly
}

// A base in a system with a "no bases" anomaly produces nothing until it is resolved (1.16).
export function producingBases(state: HydratedStellarHorizonsGameState, playerId: string): Base[] {
    return state
        .basesOf(playerId)
        .filter((base) => !blocksBases(state, base.systemId) && !halts(state, base.systemId))
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
    settlements: Type.Number(),
    goods: ProducedGoods,
    blockaded: Type.Boolean()
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
// since tech markers and goods come from the shared pools.
export function produceAtBases(state: HydratedStellarHorizonsGameState): BaseProductionResult[] {
    const results: BaseProductionResult[] = []
    for (const playerId of state.initiativeOrder()) {
        for (const base of state.basesOf(playerId)) {
            const production = base.production
            base.production = undefined
            if (
                production === undefined ||
                blocksBases(state, base.systemId) ||
                halts(state, base.systemId)
            ) {
                continue
            }
            const blockaded = isBlockaded(state, playerId, base.systemId)
            const amount = productionYield(state, base, production)
            const { markers, cash } =
                production === CASH_PRODUCTION
                    ? payCash(state, playerId, amount)
                    : awardTechMarkers(state, playerId, production, amount)
            const goods = blockaded ? { goods: [], cash: 0 } : produceGoods(state, base)
            const settlements = settleProductionEffects(state, base)
            results.push({
                playerId,
                systemId: base.systemId,
                production,
                amount,
                markers,
                cash,
                settlements,
                goods,
                blockaded
            })
        }
    }
    return results
}

// Rulebook 5.1's production directives total each Player's cash from base production.
export function recordProductionDirectives(
    state: HydratedStellarHorizonsGameState,
    results: readonly BaseProductionResult[]
): FulfilledDirective[] {
    return state.initiativeOrder().flatMap((playerId) => {
        const cash = results
            .filter(
                (result) => result.playerId === playerId && result.production === CASH_PRODUCTION
            )
            .reduce((total, result) => total + result.cash, 0)
        const fulfilled =
            cash > 0
                ? recordDirectiveProgress(state, playerId, {
                      kind: DirectiveType.Production,
                      production: DirectiveProduction.BaseProductionCash,
                      amount: cash
                  })
                : undefined
        return fulfilled ? [fulfilled] : []
    })
}

// Rulebook 4.6.
export const GROWTH_STEP = 10
export const POPULATION_LIMIT_PER_RIVAL = 10
export const CATCH_UP_STEP = 10
export const CATCH_UP_BONUS = 10
export const MAX_CHANCE = 100

function worldClasses(state: HydratedStellarHorizonsGameState, systemId: string): WorldClass[] {
    return state.systemState(systemId).worlds.flatMap((world) => {
        const worldClass = worldTile(world.tileId).worldClass
        return worldClass === WorldClass.None ? [] : [worldClass]
    })
}

// Cards that raise or lower population limits apply only to their owner (rulebook 4.6), so a
// system's limit can differ from Player to Player: by world class, by star, or everywhere.
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
    const capabilities = capabilitiesOf(state, playerId)
    const cards =
        worldClasses(state, systemId).reduce(
            (total, worldClass) => total + (capabilities.populationByClass[worldClass] ?? 0),
            0
        ) +
        capabilities.population +
        (isDwarfStar(systemDefinition(systemId)) ? capabilities.dwarfStarPopulation : 0)
    return worlds + tunnels + cards - POPULATION_LIMIT_PER_RIVAL * rivals
}

// The growth cards give a base after growth and migration: everywhere, by star, and for each
// world of a class in its system.
export function cardGrowth(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string
): number {
    const capabilities = capabilitiesOf(state, playerId)
    return (
        capabilities.growth +
        (isDwarfStar(systemDefinition(systemId)) ? capabilities.dwarfStarGrowth : 0) +
        worldClasses(state, systemId).reduce(
            (total, worldClass) => total + (capabilities.growthByClass[worldClass] ?? 0),
            0
        )
    )
}

function growthLimit(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string
): number {
    return capabilitiesOf(state, playerId).growthPastLimit
        ? Number.POSITIVE_INFINITY
        : systemPopulationLimit(state, playerId, systemId)
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
    const escalation = capabilitiesOf(state, playerId).migrationChange
    return Math.max(
        0,
        Math.min(
            MAX_CHANCE,
            effectiveHabitability(state, playerId, systemId) + anomaly + bonus + escalation
        )
    )
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

// Prolific Breeders' settlement at a base of the Player's choice (rulebook 4.6).
export type ChosenGrowth = Type.Static<typeof ChosenGrowth>
export const ChosenGrowth = Type.Object({
    playerId: Type.String(),
    systemId: Type.String(),
    settlements: Type.Number()
})

export interface Growth {
    results: GrowthResult[]
    chosen: ChosenGrowth[]
}

// A "no bases" anomaly, a halting event or a blockade stops growth, migration and the cards'
// extra growth (rulebook 1.16, 4.2 and 4.6).
function canGrow(state: HydratedStellarHorizonsGameState, base: Base): boolean {
    return (
        !blocksBases(state, base.systemId) &&
        !halts(state, base.systemId) &&
        !isBlockaded(state, base.playerId, base.systemId)
    )
}

// Rulebook 4.6: growth, then migration, each capped by the system's population limit for the
// base's owner, then the growth cards' extra settlements, capped the same way unless Transcend
// Biology lifts the limit. Prolific Breeders' base is chosen afterwards when there is a choice.
export function growSettlements(state: HydratedStellarHorizonsGameState): Growth {
    const random = state.getProtectedPrng()
    // The catch-up bonus compares the settlements Players had as the phase began.
    const startTotals: Record<string, number> = Object.fromEntries(
        state.players.map((player) => [player.playerId, totalSettlements(state, player.playerId)])
    )
    const leader = Math.max(0, ...Object.values(startTotals))
    const results: GrowthResult[] = []
    for (const playerId of state.initiativeOrder()) {
        for (const base of state.basesOf(playerId)) {
            if (!canGrow(state, base)) {
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
            // Eager Migrants bring two; Transcend Biology stops migration.
            const migrants = capabilitiesOf(state, playerId).migrationSettlements
            const migration =
                migrants === 0
                    ? 0
                    : (migrationRoll <= chance ? migrants : 0) +
                      (baseEffects(state, base.systemId).migrationSettlement ?? 0)
            const extra = cardGrowth(state, playerId, base.systemId)
            const limit = systemPopulationLimit(state, playerId, base.systemId)
            const after = Math.max(
                before,
                Math.min(
                    growthLimit(state, playerId, base.systemId),
                    before + growth + migration + extra
                )
            )
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
    const chosen = state.initiativeOrder().flatMap((playerId) => {
        const bases = growthChoiceBases(state, playerId)
        if (bases.length === 1) {
            return [growAtChosenBase(state, playerId, bases[0])]
        }
        if (bases.length > 1) {
            state.growthChoosers.push(playerId)
        }
        return []
    })
    return { results, chosen }
}

// Bases where Prolific Breeders' settlement can go: any that grows and is under its limit.
export function growthChoiceBases(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): string[] {
    if (capabilitiesOf(state, playerId).chosenGrowth === 0) {
        return []
    }
    return state
        .basesOf(playerId)
        .filter(
            (base) =>
                canGrow(state, base) &&
                base.settlements < growthLimit(state, playerId, base.systemId)
        )
        .map((base) => base.systemId)
}

export function growAtChosenBase(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string
): ChosenGrowth {
    const base = state.base(playerId, systemId)
    assertExists(base, `No base of ${playerId} in ${systemId}`)
    const room = growthLimit(state, playerId, systemId) - base.settlements
    const settlements = Math.max(0, Math.min(room, capabilitiesOf(state, playerId).chosenGrowth))
    base.settlements += settlements
    return { playerId, systemId, settlements }
}

// The True Path's first ability and Cultural Dominance: after growth, in one system where they
// and another player both have bases, a die roll at or under 4 (3 for the card) converts one of
// that player's settlements. Each is a roll of its own.
export function conversionTargets(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): Base[] {
    if (capabilitiesOf(state, playerId).conversionRolls.length === 0) {
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

// The conversion rolls to take after growth, in initiative order.
export function queueConversions(state: HydratedStellarHorizonsGameState) {
    state.conversions = state
        .initiativeOrder()
        .flatMap((playerId) =>
            capabilitiesOf(state, playerId).conversionRolls.map((roll) => ({ playerId, roll }))
        )
    dropUnusableConversions(state)
}

// A roll with nobody left to convert is passed over.
export function dropUnusableConversions(state: HydratedStellarHorizonsGameState) {
    state.conversions = state.conversions.filter(
        (chance) => conversionTargets(state, chance.playerId).length > 0
    )
}

export type ConversionResult = Type.Static<typeof ConversionResult>
export const ConversionResult = Type.Object({
    roll: Type.Number(),
    converted: Type.Boolean(),
    target: Type.Optional(Type.Number())
})

export function convertSettlement(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string,
    targetPlayerId: string
): ConversionResult {
    const target = state.base(targetPlayerId, systemId)
    assertExists(target, `No base of ${targetPlayerId} in ${systemId}`)
    const [chance, ...rest] = state.conversions
    assertExists(chance, 'No conversion roll is waiting')
    state.conversions = rest
    const roll = state.getProtectedPrng().dieRoll(10)
    const converted = roll <= chance.roll
    if (converted) {
        removeBaseSettlement(state, targetPlayerId, systemId)
        addSettlements(state, playerId, systemId, 1)
    }
    dropUnusableConversions(state)
    return { roll, converted, target: chance.roll }
}
