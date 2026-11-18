import { describe, expect, it } from 'vitest'
import { createActionBase, createTestGameState } from '../utils/testUtils.js'
import { Activate, HydratedActivate } from './activate.js'
import { EffectType } from '../components/effects.js'
import { MachineState } from '../definition/states.js'
import { Ring } from '../utils/solGraph.js'
import type { HydratedSolGameState } from '../model/gameState.js'
import type { HydratedSolPlayerState } from '../model/playerState.js'

const OUTER_FOUNDRY_COORDS = { row: Ring.Outer, col: 0 }

function solarFlareDuringDuplicateTurn() {
    const state = createTestGameState()
    const [turnPlayer, otherPlayer] = state.players
    state.turnManager.startTurn(turnPlayer.playerId)
    state.machineState = MachineState.SolarFlares
    state.activeEffect = EffectType.Duplicate
    state.solarFlares = 1
    state.solarFlaresRemaining = 1
    state.activations = [turnPlayer, otherPlayer].map(({ playerId }) => ({
        playerId,
        activatedIds: []
    }))
    return { state, turnPlayer, otherPlayer }
}

function placeOuterFoundry(state: HydratedSolGameState, owner: HydratedSolPlayerState) {
    const foundry = owner.sundiverFoundries.pop()
    if (!foundry) {
        throw new Error('Player has no sundiver foundries')
    }
    state.board.addStationAt(foundry, OUTER_FOUNDRY_COORDS)
    return foundry
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
            coords: OUTER_FOUNDRY_COORDS
        })
    )
    activate.apply(state)
    return activate
}

describe('Activate during a solar flare on a Duplicate turn', () => {
    it('builds the normal number of sundivers for another player', () => {
        const { state, otherPlayer } = solarFlareDuringDuplicateTurn()
        const foundry = placeOuterFoundry(state, otherPlayer)

        const activate = activateFoundry(state, otherPlayer, foundry.id)

        expect(activate.metadata?.createdSundiverIds).toHaveLength(1)
    })

    it('lets another player activate with only the normal build in reserve', () => {
        const { state, otherPlayer } = solarFlareDuringDuplicateTurn()
        placeOuterFoundry(state, otherPlayer)
        otherPlayer.reserveSundivers.splice(1)

        expect(
            HydratedActivate.canActivateStationAt(state, otherPlayer.playerId, OUTER_FOUNDRY_COORDS)
        ).toBe(true)
    })

    it('still doubles the build of the player who played Duplicate', () => {
        const { state, turnPlayer } = solarFlareDuringDuplicateTurn()
        const foundry = placeOuterFoundry(state, turnPlayer)

        const activate = activateFoundry(state, turnPlayer, foundry.id)

        expect(activate.metadata?.createdSundiverIds).toHaveLength(2)
    })
})
