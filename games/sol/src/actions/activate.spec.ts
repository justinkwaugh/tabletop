import { describe, expect, it } from 'vitest'
import type { OffsetCoordinates } from '@tabletop/common'
import { createActionBase, createTestGameState } from '../utils/testUtils.js'
import { Activate, HydratedActivate } from './activate.js'
import { EffectType } from '../components/effects.js'
import type { Station } from '../components/stations.js'
import { MachineState } from '../definition/states.js'
import { Ring } from '../utils/solGraph.js'
import type { HydratedSolGameState } from '../model/gameState.js'
import type { HydratedSolPlayerState } from '../model/playerState.js'

const OUTER_COORDS = { row: Ring.Outer, col: 0 }

function solarFlareDuringEffectTurn(effect: EffectType) {
    const state = createTestGameState()
    const [turnPlayer, otherPlayer] = state.players
    state.turnManager.startTurn(turnPlayer.playerId)
    state.machineState = MachineState.SolarFlares
    state.activeEffect = effect
    state.solarFlares = 1
    state.solarFlaresRemaining = 1
    state.activations = [turnPlayer, otherPlayer].map(({ playerId }) => ({
        playerId,
        activatedIds: []
    }))
    return { state, turnPlayer, otherPlayer }
}

function placeStation(state: HydratedSolGameState, stations: Station[], coords: OffsetCoordinates) {
    const station = stations.pop()
    if (!station) {
        throw new Error('Player has no stations of that type')
    }
    state.board.addStationAt(station, coords)
    return station
}

function placeOuterFoundry(state: HydratedSolGameState, owner: HydratedSolPlayerState) {
    return placeStation(state, owner.sundiverFoundries, OUTER_COORDS)
}

function activateFoundry(
    state: HydratedSolGameState,
    player: HydratedSolPlayerState,
    stationId: string
) {
    const activate = new HydratedActivate(
        createActionBase(Activate, state, {
            playerId: player.playerId,
            stationId,
            coords: OUTER_COORDS
        })
    )
    activate.apply(state)
    return activate
}

describe('Activate during a solar flare on a Duplicate turn', () => {
    it('builds the normal number of sundivers for another player', () => {
        const { state, otherPlayer } = solarFlareDuringEffectTurn(EffectType.Duplicate)
        const foundry = placeOuterFoundry(state, otherPlayer)

        const activate = activateFoundry(state, otherPlayer, foundry.id)

        expect(activate.metadata?.createdSundiverIds).toHaveLength(1)
    })

    it('lets another player activate with only the normal build in reserve', () => {
        const { state, otherPlayer } = solarFlareDuringEffectTurn(EffectType.Duplicate)
        placeOuterFoundry(state, otherPlayer)
        otherPlayer.reserveSundivers.splice(1)

        expect(
            HydratedActivate.canActivateStationAt(state, otherPlayer.playerId, OUTER_COORDS)
        ).toBe(true)
    })

    it('still doubles the build of the player who played Duplicate', () => {
        const { state, turnPlayer } = solarFlareDuringEffectTurn(EffectType.Duplicate)
        const foundry = placeOuterFoundry(state, turnPlayer)

        const activate = activateFoundry(state, turnPlayer, foundry.id)

        expect(activate.metadata?.createdSundiverIds).toHaveLength(2)
    })
})

describe('Activate during a solar flare on a Pulse turn', () => {
    it("does not let a player activate another player's outer station", () => {
        const { state, turnPlayer, otherPlayer } = solarFlareDuringEffectTurn(EffectType.Pulse)
        placeStation(state, turnPlayer.energyNodes, OUTER_COORDS)

        expect(
            HydratedActivate.canActivateStationAt(state, otherPlayer.playerId, OUTER_COORDS)
        ).toBe(false)
    })

    it('does not let a player activate their own inner station', () => {
        const { state, otherPlayer } = solarFlareDuringEffectTurn(EffectType.Pulse)
        const innerCoords = { row: Ring.Inner, col: 0 }
        placeStation(state, otherPlayer.energyNodes, innerCoords)

        expect(
            HydratedActivate.canActivateStationAt(state, otherPlayer.playerId, innerCoords)
        ).toBe(false)
    })

    it('lets a player activate their own outer station without affording a whole Pulse', () => {
        const { state, turnPlayer, otherPlayer } = solarFlareDuringEffectTurn(EffectType.Pulse)
        placeStation(state, otherPlayer.energyNodes, OUTER_COORDS)
        for (const col of [1, 2, 3]) {
            placeStation(state, turnPlayer.transmitTowers, { row: Ring.Outer, col })
        }
        otherPlayer.energyCubes = 0

        expect(
            HydratedActivate.canActivateStationAt(state, otherPlayer.playerId, OUTER_COORDS)
        ).toBe(true)
    })
})
