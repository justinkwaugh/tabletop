import { assertExists } from '@tabletop/common'
import { SOL_SYSTEM_ID } from '../components/systems.js'
import { SOL_DEMAND, type TradeGood } from '../components/tradeGoods.js'
import { isCampaign } from './campaign.js'
import { capabilitiesOf } from './fleet.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import type { SystemState } from './pieces.js'
import { drawFromPool } from './pools.js'

function markers(system: SystemState): TradeGood[] {
    return [system.demand, system.secondDemand].filter((good) => good !== undefined)
}

// The goods a system's demand markers let Players sell there; Sol's marker names three.
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
    return [...new Set(markers(state.systemState(systemId)))]
}

function hasStarports(state: HydratedStellarHorizonsGameState, playerId: string, systemId: string) {
    return (
        state.base(playerId, systemId) !== undefined &&
        capabilitiesOf(state, playerId).keepsTwoDemand
    )
}

// One marker per system (designer ruling), two where a Player with Starports has a base
// (campaign plan, slice 4, Q9).
export function demandPlaces(state: HydratedStellarHorizonsGameState, systemId: string): number {
    return state.players.some((player) => hasStarports(state, player.playerId, systemId)) ? 2 : 1
}

// A system gets a marker as soon as it is fully surveyed or has a base: the Player who completed
// the survey or founded the base draws, then keeps one. With Starports and a base there they keep
// two; Trader's Guild draws one more to choose from.
export function drawDemand(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string
) {
    if (
        !isCampaign(state) ||
        systemId === SOL_SYSTEM_ID ||
        state.demandDraws.some((draw) => draw.systemId === systemId)
    ) {
        return
    }
    const system = state.systemState(systemId)
    const open = demandPlaces(state, systemId) - markers(system).length
    if (open <= 0) {
        return
    }
    const keep = Math.min(open, hasStarports(state, playerId, systemId) ? 2 : 1)
    const drawn = drawFromPool(state, state.demandPool, capabilitiesOf(state, playerId).demandDraws)
    if (drawn.length <= keep) {
        drawn.forEach((good) => placeDemand(system, good))
    } else {
        state.demandDraws.push({ playerId, systemId, drawn, keep })
    }
}

function placeDemand(system: SystemState, good: TradeGood) {
    if (system.demand === undefined) {
        system.demand = good
    } else {
        system.secondDemand = good
    }
}

export function keepDemand(state: HydratedStellarHorizonsGameState, good: TradeGood) {
    const draw = state.demandDraws.at(0)
    assertExists(draw, 'No demand markers are waiting to be chosen')
    const index = draw.drawn.indexOf(good)
    if (index < 0) {
        throw new Error(`${good} was not drawn`)
    }
    placeDemand(state.systemState(draw.systemId), good)
    const rest = draw.drawn.toSpliced(index, 1)
    if (draw.keep > 1 && rest.length > draw.keep - 1) {
        state.demandDraws[0] = { ...draw, drawn: rest, keep: draw.keep - 1 }
        return
    }
    if (draw.keep > 1) {
        rest.forEach((other) => placeDemand(state.systemState(draw.systemId), other))
    } else {
        state.demandPool.push(...rest)
    }
    state.demandDraws = state.demandDraws.slice(1)
}

// After a sale the marker goes back to the pool and the seller draws its replacement.
export function replaceDemand(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemId: string,
    good: TradeGood
) {
    if (systemId === SOL_SYSTEM_ID) {
        return
    }
    const system = state.systemState(systemId)
    if (system.secondDemand === good) {
        system.secondDemand = undefined
    } else if (system.demand === good) {
        system.demand = system.secondDemand
        system.secondDemand = undefined
    }
    state.demandPool.push(good)
    drawDemand(state, playerId, systemId)
}

// A system that loses its last base loses its markers, unless it is fully surveyed: those
// markers stand for outposts of no Player.
export function releaseDemand(state: HydratedStellarHorizonsGameState, systemId: string) {
    const system = state.systemState(systemId)
    if (
        system.explorationMarker > 0 &&
        !state.allBases().some((base) => base.systemId === systemId)
    ) {
        state.demandPool.push(...markers(system))
        system.demand = undefined
        system.secondDemand = undefined
    }
}
