import { describe, expect, it } from 'vitest'
import { GameResult, validateGameResult, type Game, type GameAction } from '@tabletop/common'
import { ShipKind, shipDefinition } from '../components/ships.js'
import { TECHS, TechId } from '../components/techs.js'
import { ScenarioId } from '../components/scenarios.js'
import {
    anomalyAttemptShips,
    attemptableSystemIds,
    canJoinAnomalyAttempt
} from '../model/anomalies.js'
import { RepairMethod, canRepair, shipsAvailableToBuild } from '../model/building.js'
import { CargoPartnerKind } from '../model/cargoTransfer.js'
import { canAffordTech, isTechAvailable, techCost } from '../model/development.js'
import { canExplore } from '../model/exploration.js'
import { cargoCapacity, hasArrived } from '../model/fleet.js'
import type {
    HydratedStellarHorizonsGameState,
    StellarHorizonsProjectedState
} from '../model/gameState.js'
import { moveOptions } from '../model/movement.js'
import { canSettleSystem, canUnload, settlementPurchaseLimit } from '../model/settling.js'
import { surveySwapSlots } from '../model/surveys.js'
import { replacementOptions, terraformTargets } from '../model/terraforming.js'
import { systemPopulation } from '../model/victory.js'
import { TurnStep } from '../model/turn.js'
import { startingBaseSystemIds } from '../model/startingBases.js'
import { VOYAGES_CONFIG, execute, hydrate, startedGame, userAction } from '../testing/fixtures.js'
import { ActionType } from './actions.js'
import { MachineState } from './states.js'

function botAction(game: Game, state: HydratedStellarHorizonsGameState): GameAction {
    const [playerId] = state.activePlayerIds
    const act = (type: ActionType, fields: Record<string, unknown> = {}) =>
        userAction(game, playerId, type, fields)
    switch (state.machineState) {
        case MachineState.PlacingStartingBases:
            return act(ActionType.PlaceStartingBase, {
                systemId: startingBaseSystemIds(state)[0]
            })
        case MachineState.ChoosingSurveyWorld: {
            const choice = state.surveyChoice
            const slots = choice ? surveySwapSlots(state, choice.systemId, choice.drawnTileId) : []
            return act(ActionType.ChooseSurveyWorld, { slot: slots[0] })
        }
        case MachineState.Terraforming: {
            const [target] = terraformTargets(state, playerId)
            return target ? act(ActionType.Terraform, target) : act(ActionType.PassTerraform)
        }
        case MachineState.ChoosingTerraformWorld: {
            const choice = state.terraformChoice
            const [tileId] = choice ? replacementOptions(state, choice) : []
            return act(ActionType.ChooseTerraformWorld, { tileId, removedTileIds: [] })
        }
        case MachineState.PlayingTurn:
            return (
                (state.scenario === ScenarioId.Voyages
                    ? voyagesAction(state, playerId, act)
                    : turnAction(state, playerId, act)) ??
                act(ActionType.EndStep, {
                    step: state.getPlayerState(playerId).step
                })
            )
        default:
            throw new Error(`Bot cannot act in ${state.machineState}`)
    }
}

function turnAction(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    act: (type: ActionType, fields?: Record<string, unknown>) => GameAction
): GameAction | undefined {
    const player = state.getPlayerState(playerId)
    const ships = state.shipsOf(playerId)
    switch (player.step) {
        case TurnStep.Build: {
            const damaged = ships.find((ship) =>
                canRepair(state, playerId, ship.shipId, RepairMethod.RemotePoint, 1)
            )
            if (damaged) {
                return act(ActionType.RepairShip, {
                    shipId: damaged.shipId,
                    method: RepairMethod.RemotePoint,
                    points: 1
                })
            }
            const carriers = ships.filter((ship) => shipDefinition(ship.shipId).cargo >= 2)
            const probes = ships.filter((ship) => shipDefinition(ship.shipId).kind === ShipKind.RE)
            const wanted = shipsAvailableToBuild(state, playerId).find(
                (definition) =>
                    definition.cost <= player.cash &&
                    ((carriers.length < 2 && definition.cargo >= 2) ||
                        (probes.length < 2 && definition.kind === ShipKind.RE))
            )
            return wanted
                ? act(ActionType.BuildShip, { shipId: wanted.id, systemId: 'sol' })
                : undefined
        }
        case TurnStep.Cargo: {
            const unloading = ships.find((ship) => canUnload(state, ship))
            if (unloading) {
                return act(ActionType.TransferCargo, {
                    shipId: unloading.shipId,
                    partner: { kind: CargoPartnerKind.Base },
                    settlements: -unloading.settlements
                })
            }
            const hasTarget = state.systems.some((system) =>
                canSettleSystem(state, playerId, system.systemId)
            )
            const buyer = ships.find(
                (ship) => hasTarget && settlementPurchaseLimit(state, ship) > 0
            )
            return buyer
                ? act(ActionType.TransferCargo, {
                      shipId: buyer.shipId,
                      partner: { kind: CargoPartnerKind.Earth },
                      settlements: settlementPurchaseLimit(state, buyer)
                  })
                : undefined
        }
        case TurnStep.Movement: {
            for (const ship of ships.filter(hasArrived)) {
                const options = moveOptions(state, ship)
                const destination = shipDestination(state, playerId, ship.shipId, options)
                if (destination) {
                    return act(ActionType.MoveShip, { shipId: ship.shipId, systemId: destination })
                }
            }
            return undefined
        }
        case TurnStep.Exploration: {
            const explorer = ships.find((ship) => canExplore(state, ship))
            return explorer ? act(ActionType.Explore, { shipId: explorer.shipId }) : undefined
        }
        case TurnStep.Development: {
            const affordable = TECHS.filter(
                (definition) =>
                    isTechAvailable(state, playerId, definition.id) &&
                    canAffordTech(state, playerId, definition.id)
            )
            const tech =
                affordable.find((definition) => PRIORITY_TECHS.includes(definition.id)) ??
                affordable[0]
            if (!tech) {
                return undefined
            }
            const cost = techCost(state, playerId, tech.id)
            const markers = player.techMarkers[tech.field].toSorted((a, b) => b - a)
            const spent: number[] = []
            for (const marker of markers) {
                if (spent.reduce((total, value) => total + value, 0) >= cost) break
                spent.push(marker)
            }
            const markerValue = spent.reduce((total, value) => total + value, 0)
            const cash = Math.max(0, cost - markerValue)
            return cash <= player.cash - 10 || cash === 0
                ? act(ActionType.DevelopTech, { techId: tech.id, markers: spent, cash })
                : undefined
        }
        default:
            return undefined
    }
}

// A fleet of probes surveys the map while the crew vehicles gather at anomalies.
function voyagesAction(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    act: (type: ActionType, fields?: Record<string, unknown>) => GameAction
): GameAction | undefined {
    const player = state.getPlayerState(playerId)
    const ships = state.shipsOf(playerId)
    switch (player.step) {
        case TurnStep.Build: {
            const probes = ships.filter((ship) => shipDefinition(ship.shipId).kind === ShipKind.RE)
            const affordable = shipsAvailableToBuild(state, playerId).filter(
                (definition) => definition.cost <= player.cash
            )
            const wanted =
                probes.length < 3
                    ? affordable.find((definition) => definition.kind === ShipKind.RE)
                    : affordable
                          .filter((definition) => definition.kind === ShipKind.CV)
                          .toSorted(
                              (a, b) => b.combat + b.exploration - (a.combat + a.exploration)
                          )[0]
            return wanted
                ? act(ActionType.BuildShip, { shipId: wanted.id, systemId: 'sol' })
                : undefined
        }
        case TurnStep.Movement: {
            for (const ship of ships.filter(hasArrived)) {
                const destination = voyagesDestination(state, ship.shipId)
                if (destination) {
                    return act(ActionType.MoveShip, { shipId: ship.shipId, systemId: destination })
                }
            }
            return undefined
        }
        case TurnStep.Exploration: {
            const [systemId] = attemptableSystemIds(state, playerId)
            if (systemId) {
                return act(ActionType.AttemptAnomaly, {
                    systemId,
                    shipIds: anomalyAttemptShips(state, playerId, systemId).map(
                        (ship) => ship.shipId
                    )
                })
            }
            const explorer = ships.find((ship) => canExplore(state, ship))
            return explorer ? act(ActionType.Explore, { shipId: explorer.shipId }) : undefined
        }
        case TurnStep.Cargo:
            return undefined
        default:
            return turnAction(state, playerId, act)
    }
}

function voyagesDestination(
    state: HydratedStellarHorizonsGameState,
    shipId: string
): string | undefined {
    const ship = state.ship(shipId)
    const useful = (systemId: string) => {
        const system = state.systemState(systemId)
        return system.anomaly !== undefined
            ? canJoinAnomalyAttempt(state, { ...ship, systemId, explored: false })
            : system.explorationMarker > 0
    }
    if (useful(ship.systemId)) {
        return undefined
    }
    const crowding = (systemId: string) =>
        state.ships.filter((other) => other.systemId === systemId).length
    const anomalous = (systemId: string) => (state.systemState(systemId).anomaly ? 0 : 1)
    return moveOptions(state, ship)
        .map((option) => option.systemId)
        .filter(useful)
        .toSorted((a, b) => anomalous(a) - anomalous(b) || crowding(a) - crowding(b))[0]
}

const PRIORITY_TECHS: readonly TechId[] = [
    TechId.ImprovedInterstellarSettlement,
    TechId.Terraforming,
    TechId.AdvancedInterstellarSettlement,
    TechId.UltraLongDistanceProbes,
    TechId.LongDistanceMissions
]

function shipDestination(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    shipId: string,
    options: { systemId: string; turns: number }[]
): string | undefined {
    const ship = state.ship(shipId)
    const reachable = options.map((option) => option.systemId)
    if (ship.settlements > 0) {
        if (canSettleSystem(state, playerId, ship.systemId)) {
            return undefined
        }
        return bestSettlement(state, playerId, reachable)
    }
    if (cargoCapacity(state, ship) > 0) {
        return ship.systemId === 'sol' ? undefined : 'sol'
    }
    if (state.systemState(ship.systemId).explorationMarker > 0) {
        return undefined
    }
    const crowding = (systemId: string) =>
        state.ships.filter((other) => other.systemId === systemId).length
    return reachable
        .filter((systemId) => state.systemState(systemId).explorationMarker > 0)
        .toSorted((a, b) => crowding(a) - crowding(b))[0]
}

function bestSettlement(
    state: HydratedStellarHorizonsGameState,
    playerId: string,
    systemIds: string[]
): string | undefined {
    const ownSettlements = (systemId: string) => state.base(playerId, systemId)?.settlements ?? 0
    return systemIds
        .filter((systemId) => canSettleSystem(state, playerId, systemId))
        .toSorted(
            (a, b) =>
                systemPopulation(state, b) - systemPopulation(state, a) ||
                ownSettlements(b) - ownSettlements(a)
        )[0]
}

function playToEnd(playerCount: number): StellarHorizonsProjectedState {
    const started = startedGame(playerCount)
    const { game } = started
    let state = started.state
    for (let step = 0; state.machineState !== MachineState.EndOfGame; step++) {
        expect(step).toBeLessThan(20000)
        state = execute(game, state, botAction(game, hydrate(state)))
    }
    return state
}

describe.each([1, 2, 3, 4])('Footfall played by bots with %i players', (playerCount) => {
    it('finishes with a valid result by 2300', () => {
        const state = playToEnd(playerCount)
        validateGameResult(state)
        expect(state.year).toBeLessThanOrEqual(2300)
        expect([GameResult.Win, GameResult.Draw, GameResult.Loss]).toContain(state.result)
        if (state.result === GameResult.Loss) {
            expect(state.year).toBe(2300)
        }
    })

    it('replays identically from the same seed', () => {
        const gameplay = ({
            id: _id,
            actionChecksum: _checksum,
            ...rest
        }: StellarHorizonsProjectedState) => rest
        expect(gameplay(playToEnd(playerCount))).toEqual(gameplay(playToEnd(playerCount)))
    })
})

const VOYAGES_LAST_YEAR = 2700

function playVoyages(playerCount: number): StellarHorizonsProjectedState {
    const started = startedGame(playerCount, VOYAGES_CONFIG)
    const { game } = started
    let state = started.state
    for (
        let step = 0;
        state.machineState !== MachineState.EndOfGame && state.year <= VOYAGES_LAST_YEAR;
        step++
    ) {
        expect(step).toBeLessThan(40000)
        state = execute(game, state, botAction(game, hydrate(state)))
    }
    return state
}

describe.each([2, 3, 4])('These are the Voyages played by bots with %i players', (playerCount) => {
    it('finds and resolves anomalies, and any ending is a valid result', () => {
        const state = playVoyages(playerCount)
        const resolved = state.players.reduce((total, player) => total + player.anomalies.length, 0)
        expect(resolved).toBeGreaterThan(0)
        if (state.machineState === MachineState.EndOfGame) {
            validateGameResult(state)
        }
    })
})
