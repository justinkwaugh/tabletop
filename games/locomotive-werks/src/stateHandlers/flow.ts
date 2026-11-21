import { MachineState } from '../definition/states.js'
import type { HydratedLwGameState } from '../model/gameState.js'

export enum PhaseName {
    Development = 'Development',
    ProductionCapacity = 'Production Capacity',
    CapacityAndFirstShipment = 'Capacity and First Shipment',
    Production = 'Production',
    Taxes = 'Taxes',
    MarketDemands = 'Market Demands'
}

// Every transition names the index of the next action to be recorded, where new turns, phases and
// rounds begin.

function playersAfter(state: HydratedLwGameState, playerId?: string): string[] {
    const order = state.turnManager.turnOrder
    return playerId === undefined ? [...order] : order.slice(order.indexOf(playerId) + 1)
}

function changePhase(state: HydratedLwGameState, name: PhaseName, at: number) {
    if (state.phaseManager.currentPhase) {
        state.phaseManager.endPhase(at - 1)
    }
    state.phaseManager.startPhase(name, at)
}

export function endTurn(state: HydratedLwGameState) {
    state.turnManager.endTurn(state.actionCount)
}

export function startRound(state: HydratedLwGameState, at: number): MachineState {
    state.roundManager.startRound(at)
    changePhase(state, PhaseName.Development, at)
    return nextDeveloper(state, at)
}

// Players who cannot afford any development are passed over.
export function nextDeveloper(
    state: HydratedLwGameState,
    at: number,
    after?: string
): MachineState {
    const playerId = playersAfter(state, after).find(
        (candidate) => state.developable(candidate).length > 0
    )
    if (playerId === undefined) {
        return startCapacity(state, at)
    }
    state.turnManager.startTurn(playerId, at)
    return MachineState.Developing
}

function startCapacity(state: HydratedLwGameState, at: number): MachineState {
    if (state.lucasOrder) {
        changePhase(state, PhaseName.CapacityAndFirstShipment, at)
        state.startSellingRound(1)
    } else {
        changePhase(state, PhaseName.ProductionCapacity, at)
    }
    return nextExpander(state, at)
}

// Under Lucas Order every player takes a turn, buying capacity if they can and then taking their
// first selling turn; otherwise players with nothing to spend are passed over.
export function nextExpander(state: HydratedLwGameState, at: number, after?: string): MachineState {
    for (const playerId of playersAfter(state, after)) {
        if (state.canExpand(playerId)) {
            state.turnManager.startTurn(playerId, at)
            return MachineState.ExpandingCapacity
        }
        if (state.lucasOrder && state.canShip(playerId)) {
            state.turnManager.startTurn(playerId, at)
            return MachineState.Shipping
        }
        if (state.lucasOrder) {
            state.leaveSellingRound(playerId)
        }
    }
    return startProduction(state, at)
}

// Ends a capacity turn: under Lucas Order the player ships straight away if they can.
export function afterExpanding(state: HydratedLwGameState, playerId: string): MachineState {
    const at = state.actionCount + 1
    if (state.lucasOrder) {
        if (state.canShip(playerId)) {
            return MachineState.Shipping
        }
        state.leaveSellingRound(playerId)
    }
    endTurn(state)
    return nextExpander(state, at, playerId)
}

function startProduction(state: HydratedLwGameState, at: number): MachineState {
    changePhase(state, PhaseName.Production, at)
    if (state.lucasOrder) {
        return finishSellingRound(state, at)
    }
    state.startSellingRound(1)
    return nextShipper(state, at)
}

export function afterShipping(state: HydratedLwGameState, playerId: string): MachineState {
    const at = state.actionCount + 1
    endTurn(state)
    const round = state.requireSellingRound()
    if (state.lucasOrder && round.number === 1) {
        return nextExpander(state, at, playerId)
    }
    return nextShipper(state, at)
}

function nextShipper(state: HydratedLwGameState, at: number): MachineState {
    const round = state.requireSellingRound()
    while (round.waiting.length > 0) {
        const [playerId] = round.waiting
        if (state.canShip(playerId)) {
            state.turnManager.startTurn(playerId, at)
            return MachineState.Shipping
        }
        round.waiting.shift()
    }
    return finishSellingRound(state, at)
}

// Selling rounds go on while someone shipped in the last one and orders remain to fill.
function finishSellingRound(state: HydratedLwGameState, at: number): MachineState {
    const round = state.requireSellingRound()
    const anyoneCanShip = state.players.some((player) => state.canShip(player.playerId))
    if (round.shipped && anyoneCanShip) {
        state.startSellingRound(round.number + 1)
        return nextShipper(state, at)
    }
    for (const player of state.players) {
        for (const plant of player.plants) {
            plant.shipped = 0
        }
        delete player.autoShip
    }
    state.sellingRound = undefined
    changePhase(state, PhaseName.Taxes, at)
    return MachineState.PayingTaxes
}

export function afterTaxes(state: HydratedLwGameState, gameOver: boolean): MachineState {
    const at = state.actionCount + 1
    if (gameOver) {
        state.phaseManager.endPhase(state.actionCount)
        state.roundManager.endRound(state.actionCount)
        return MachineState.EndOfGame
    }
    changePhase(state, PhaseName.MarketDemands, at)
    return MachineState.AdjustingMarket
}

export function afterMarket(state: HydratedLwGameState): MachineState {
    const at = state.actionCount + 1
    state.phaseManager.endPhase(state.actionCount)
    state.roundManager.endRound(state.actionCount)
    return startRound(state, at)
}
