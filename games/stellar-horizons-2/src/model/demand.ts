import { assertExists } from '@tabletop/common'
import { SOL_SYSTEM_ID } from '../components/systems.js'
import { SOL_DEMAND, type TradeGood } from '../components/tradeGoods.js'
import { factionAbilities, isCampaign } from './campaign.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { drawFromPool } from './pools.js'

// Rulebook 1.9: draw 2 demand markers and keep 1; the Consortium draw 3.
export const DEMAND_DRAW = 2

// The goods a system's demand marker lets Players sell there; Sol's marker names three.
export function demandedGoods(
    state: HydratedStellarHorizonsGameState,
    systemId: string
): readonly TradeGood[] {
    if (!isCampaign(state)) {
        return []
    }
    if (systemId === SOL_SYSTEM_ID) {
        return SOL_DEMAND
    }
    const demand = state.systemState(systemId).demand
    return demand === undefined ? [] : [demand]
}

// A system gets a marker as soon as it is fully surveyed or has a base: the Player who completed
// the survey or founded the base draws, then keeps one. One marker per system.
export function drawDemand(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string
) {
    if (
        !isCampaign(state) ||
        systemId === SOL_SYSTEM_ID ||
        state.systemState(systemId).demand !== undefined ||
        state.demandDraws.some((draw) => draw.systemId === systemId)
    ) {
        return
    }
    const drawn = drawFromPool(
        state,
        state.demandPool,
        factionAbilities(state, playerId).demandDraws ?? DEMAND_DRAW
    )
    if (drawn.length === 1) {
        state.systemState(systemId).demand = drawn[0]
    } else if (drawn.length > 1) {
        state.demandDraws.push({ playerId, systemId, drawn })
    }
}

export function keepDemand(state: HydratedStellarHorizonsGameState, good: TradeGood) {
    const draw = state.demandDraws.at(0)
    assertExists(draw, 'No demand markers are waiting to be chosen')
    const index = draw.drawn.indexOf(good)
    if (index < 0) {
        throw new Error(`${good} was not drawn`)
    }
    state.systemState(draw.systemId).demand = good
    state.demandPool.push(...draw.drawn.toSpliced(index, 1))
    state.demandDraws = state.demandDraws.slice(1)
}

// After a sale the marker goes back to the pool and the seller draws its replacement.
export function replaceDemand(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string
) {
    if (systemId === SOL_SYSTEM_ID) {
        return
    }
    returnDemand(state, systemId)
    drawDemand(state, playerId, systemId)
}

// A system that loses its last base loses its marker, unless it is fully surveyed: those markers
// stand for outposts of no Player.
export function releaseDemand(state: HydratedStellarHorizonsGameState, systemId: string) {
    const system = state.systemState(systemId)
    if (
        system.explorationMarker > 0 &&
        !state.allBases().some((base) => base.systemId === systemId)
    ) {
        returnDemand(state, systemId)
    }
}

function returnDemand(state: HydratedStellarHorizonsGameState, systemId: string) {
    const system = state.systemState(systemId)
    if (system.demand !== undefined) {
        state.demandPool.push(system.demand)
        system.demand = undefined
    }
}
