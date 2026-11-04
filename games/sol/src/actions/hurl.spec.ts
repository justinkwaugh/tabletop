import { describe, expect, it } from 'vitest'
import type { OffsetCoordinates } from '@tabletop/common'
import { HydratedHurl, Hurl } from './hurl.js'
import { Fly, HydratedFly } from './fly.js'
import { createActionBase, createTestGameState } from '../utils/testUtils.js'
import { CENTER_COORDS } from '../components/gameBoard.js'
import { EffectType } from '../components/effects.js'
import { MachineState } from '../definition/states.js'
import { Ring } from '../utils/solGraph.js'
import type { HydratedSolGameState } from '../model/gameState.js'
import type { HydratedSolPlayerState } from '../model/playerState.js'

const CORE_COORDS = { row: Ring.Core, col: 0 }

function setupMovingPlayer() {
    const state = createTestGameState()
    state.machineState = MachineState.Moving
    const player = state.players[0]
    player.movementPoints = 3
    return { state, player }
}

function placeStationAtCore(state: HydratedSolGameState, player: HydratedSolPlayerState) {
    const station = player.energyNodes.pop()
    if (!station) {
        throw new Error('Player has no energy nodes')
    }
    state.board.addStationAt(station, CORE_COORDS)
    return station
}

function placeSundiverAtCore(state: HydratedSolGameState, player: HydratedSolPlayerState) {
    const [sundiver] = player.removeSundiversFromHold(1)
    state.board.addSundiversToCell([sundiver], CORE_COORDS)
    return sundiver
}

type FlightPieces = { sundiverIds?: string[]; stationId?: string; teleport?: boolean }

function flightFromCore(
    player: HydratedSolPlayerState,
    destination: OffsetCoordinates,
    { sundiverIds = [], stationId, teleport = false }: FlightPieces
) {
    return {
        playerId: player.playerId,
        sundiverIds,
        stationId,
        gates: [],
        start: CORE_COORDS,
        destination,
        cluster: false,
        teleport,
        catapult: false,
        passage: false
    }
}

function hurlFromCore(
    state: HydratedSolGameState,
    player: HydratedSolPlayerState,
    pieces: FlightPieces
) {
    return new HydratedHurl({
        ...createActionBase(Hurl, state),
        ...flightFromCore(player, CENTER_COORDS, pieces)
    })
}

function flyFromCore(
    state: HydratedSolGameState,
    player: HydratedSolPlayerState,
    destination: OffsetCoordinates,
    pieces: FlightPieces
) {
    return new HydratedFly({
        ...createActionBase(Fly, state),
        ...flightFromCore(player, destination, pieces)
    })
}

function removeSundiversFromBoard(state: HydratedSolGameState, player: HydratedSolPlayerState) {
    for (const cell of state.board) {
        const sundiverIds = state.board
            .sundiversForPlayerAt(player.playerId, cell.coords)
            .map((sundiver) => sundiver.id)
        if (sundiverIds.length > 0) {
            state.board.removeSundiversAt(sundiverIds, cell.coords)
        }
    }
}

describe('Hurl', () => {
    describe('with sundivers', () => {
        it('can hurl a sundiver in range of the center', () => {
            const { state, player } = setupMovingPlayer()
            placeSundiverAtCore(state, player)

            expect(HydratedHurl.canHurl(state, player.playerId)).toBe(true)
        })

        it('cannot hurl without movement points', () => {
            const { state, player } = setupMovingPlayer()
            placeSundiverAtCore(state, player)
            player.movementPoints = 0

            expect(HydratedHurl.canHurl(state, player.playerId)).toBe(false)
        })

        it('awards two momentum and one card per sundiver', () => {
            const { state, player } = setupMovingPlayer()
            const sundiver = placeSundiverAtCore(state, player)

            const hurl = hurlFromCore(state, player, { sundiverIds: [sundiver.id] })
            hurl.apply(state)

            expect(player.momentum).toBe(2)
            expect(state.cardsToDraw).toBe(1)
            expect(state.hurled).toBe(true)
            expect(hurl.metadata?.momentumGained).toBe(2)
            expect(state.board.sundiversForPlayerAt(player.playerId, CORE_COORDS)).toHaveLength(0)
        })
    })

    describe('with Teleport', () => {
        it('requires the Teleport effect', () => {
            const { state, player } = setupMovingPlayer()
            const sundiver = placeSundiverAtCore(state, player)
            const pieces = { sundiverIds: [sundiver.id], teleport: true }

            expect(
                HydratedHurl.isValidHurl(state, hurlFromCore(state, player, pieces))
            ).toBeUndefined()

            state.activeEffect = EffectType.Teleport

            expect(
                HydratedHurl.isValidHurl(state, hurlFromCore(state, player, pieces))
            ).toBeDefined()
        })

        it('cannot fly a sundiver onto the center', () => {
            const { state, player } = setupMovingPlayer()
            const sundiver = placeSundiverAtCore(state, player)
            state.activeEffect = EffectType.Teleport

            const fly = flyFromCore(state, player, CENTER_COORDS, {
                sundiverIds: [sundiver.id],
                teleport: true
            })

            expect(HydratedFly.isValidFlight(state, fly)).toBeUndefined()
        })
    })

    describe('with a Juggernaut station', () => {
        it('cannot hurl a station without Juggernaut', () => {
            const { state, player } = setupMovingPlayer()
            const station = placeStationAtCore(state, player)

            expect(HydratedHurl.canHurl(state, player.playerId)).toBe(false)
            const hurl = hurlFromCore(state, player, { stationId: station.id })
            expect(HydratedHurl.isValidHurl(state, hurl)).toBeUndefined()
        })

        it('can hurl a station while Juggernaut is active', () => {
            const { state, player } = setupMovingPlayer()
            const station = placeStationAtCore(state, player)
            state.activeEffect = EffectType.Juggernaut

            expect(HydratedHurl.canHurl(state, player.playerId)).toBe(true)
            const hurl = hurlFromCore(state, player, { stationId: station.id })
            expect(HydratedHurl.isValidHurl(state, hurl)).toEqual([CORE_COORDS, CENTER_COORDS])
        })

        it('cannot hurl a station other than the one already flown this turn', () => {
            const { state, player } = setupMovingPlayer()
            const station = placeStationAtCore(state, player)
            state.activeEffect = EffectType.Juggernaut
            state.ensureEffectTracking().flownStationId = 'another-station'

            expect(HydratedHurl.canHurl(state, player.playerId)).toBe(false)
            const hurl = hurlFromCore(state, player, { stationId: station.id })
            expect(HydratedHurl.isValidHurl(state, hurl)).toBeUndefined()
        })

        it("cannot hurl another player's station", () => {
            const { state, player } = setupMovingPlayer()
            const opponent = state.players[1]
            const station = placeStationAtCore(state, opponent)
            state.activeEffect = EffectType.Juggernaut

            expect(HydratedHurl.canHurl(state, player.playerId)).toBe(false)
            const hurl = hurlFromCore(state, player, { stationId: station.id })
            expect(HydratedHurl.isValidHurl(state, hurl)).toBeUndefined()
        })

        it('rewards a hurled station like one sundiver and removes it from the game', () => {
            const { state, player } = setupMovingPlayer()
            const station = placeStationAtCore(state, player)
            const remainingEnergyNodes = player.energyNodes.length
            state.activeEffect = EffectType.Juggernaut

            const hurl = hurlFromCore(state, player, { stationId: station.id })
            hurl.apply(state)

            expect(player.momentum).toBe(2)
            expect(state.cardsToDraw).toBe(1)
            expect(state.hurled).toBe(true)
            expect(player.movementPoints).toBe(2)
            expect(state.board.findStation(station.id)).toBeUndefined()
            expect(player.energyNodes).toHaveLength(remainingEnergyNodes)
            expect(player.movement).toBe(state.calculatePlayerMovement(player.playerId))
            expect(state.activeEffect).toBeUndefined()
            expect(hurl.metadata?.momentumGained).toBe(2)
            expect(hurl.metadata?.juggernaut?.id).toBe(station.id)
        })

        it('cannot fly a station onto the center instead of hurling it', () => {
            const { state, player } = setupMovingPlayer()
            const station = placeStationAtCore(state, player)
            state.activeEffect = EffectType.Juggernaut

            const fly = flyFromCore(state, player, CENTER_COORDS, { stationId: station.id })
            expect(HydratedFly.isValidFlight(state, fly)).toBeUndefined()
            expect(() => fly.apply(state)).toThrow()
            expect(state.board.cellAt(CENTER_COORDS).station).toBeUndefined()
            expect(state.board.findStation(station.id)?.coords).toEqual(CORE_COORDS)
        })

        it('cannot teleport a station onto the center', () => {
            const { state, player } = setupMovingPlayer()
            const station = placeStationAtCore(state, player)
            state.activeEffect = EffectType.Juggernaut

            const pieces = { stationId: station.id, teleport: true }
            expect(
                HydratedFly.isValidFlight(state, flyFromCore(state, player, CENTER_COORDS, pieces))
            ).toBeUndefined()
            expect(
                HydratedHurl.isValidHurl(state, hurlFromCore(state, player, pieces))
            ).toBeUndefined()
        })

        it('keeps a station movable when the player has no sundivers on the board', () => {
            const { state, player } = setupMovingPlayer()
            placeStationAtCore(state, player)
            removeSundiversFromBoard(state, player)
            expect(HydratedFly.canFly(state, player.playerId)).toBe(false)

            state.activeEffect = EffectType.Juggernaut

            expect(HydratedFly.canFly(state, player.playerId)).toBe(true)
        })

        it('can still fly a station to a normal cell while Juggernaut is active', () => {
            const { state, player } = setupMovingPlayer()
            const station = placeStationAtCore(state, player)
            state.activeEffect = EffectType.Juggernaut

            const destination = { row: Ring.Core, col: 1 }
            const fly = flyFromCore(state, player, destination, { stationId: station.id })
            expect(HydratedFly.isValidFlight(state, fly)).toBeDefined()
        })
    })
})
