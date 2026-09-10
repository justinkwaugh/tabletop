import { describe, expect, it } from 'vitest'
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

function hurlFromCore(
    state: HydratedSolGameState,
    player: HydratedSolPlayerState,
    pieces: { sundiverIds?: string[]; stationId?: string }
) {
    return new HydratedHurl({
        ...createActionBase(Hurl, state),
        playerId: player.playerId,
        sundiverIds: pieces.sundiverIds ?? [],
        stationId: pieces.stationId,
        gates: [],
        start: CORE_COORDS,
        destination: CENTER_COORDS,
        cluster: false,
        teleport: false,
        catapult: false,
        passage: false
    })
}

function flyFromCore(
    state: HydratedSolGameState,
    player: HydratedSolPlayerState,
    destination: { row: number; col: number },
    pieces: { sundiverIds?: string[]; stationId?: string }
) {
    return new HydratedFly({
        ...createActionBase(Fly, state),
        playerId: player.playerId,
        sundiverIds: pieces.sundiverIds ?? [],
        stationId: pieces.stationId,
        gates: [],
        start: CORE_COORDS,
        destination,
        cluster: false,
        teleport: false,
        catapult: false,
        passage: false
    })
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
            state.getEffectTracking().flownStationId = 'another-station'

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
