import { describe, expect, it } from 'vitest'
import { RideTheRailsGameStateValidator } from '../model/gameState.js'
import { ActionType } from './actions.js'
import { RideTheRailsColors } from './colors.js'
import { Definition } from './definition.js'
import { RideTheRailsGameExploration } from './exploration.js'
import { RideTheRailsHydrator } from './hydrator.js'
import { RideTheRailsInfo } from './info.js'
import { RideTheRailsGameInitializer } from './initializer.js'
import { RideTheRailsRuntime } from './runtime.js'
import { RideTheRailsScoring } from './scoring.js'
import { RideTheRailsStateHandlers } from './stateHandlers.js'
import { MachineState } from './states.js'

describe('the game definition', () => {
    it('pairs the info with the runtime', () => {
        expect(Definition.info).toBe(RideTheRailsInfo)
        expect(Definition.runtime).toBe(RideTheRailsRuntime)
    })

    it('registers the initializer, hydrator, colours, canonical validator and scoring', () => {
        expect(RideTheRailsRuntime.initializer).toBeInstanceOf(RideTheRailsGameInitializer)
        expect(RideTheRailsRuntime.hydrator).toBeInstanceOf(RideTheRailsHydrator)
        expect(RideTheRailsRuntime.playerColors).toBe(RideTheRailsColors)
        expect(RideTheRailsRuntime.canonicalStateValidator).toBe(RideTheRailsGameStateValidator)
        expect(RideTheRailsRuntime.scoring).toBeInstanceOf(RideTheRailsScoring)
        expect(RideTheRailsRuntime.exploration).toBeInstanceOf(RideTheRailsGameExploration)
    })

    it('registers a handler for every machine state', () => {
        expect(RideTheRailsRuntime.stateHandlers).toBe(RideTheRailsStateHandlers)
        expect(Object.keys(RideTheRailsRuntime.stateHandlers).toSorted()).toEqual(
            Object.values(MachineState).toSorted()
        )
    })

    it('offers the player actions over the API, and no system action (R-X.1)', () => {
        expect(Object.keys(RideTheRailsRuntime.apiActions).toSorted()).toEqual(
            [
                ActionType.TakeShare,
                ActionType.PlaceLocomotive,
                ActionType.EndBuilding,
                ActionType.RideJourney,
                ActionType.PassJourney
            ].toSorted()
        )
    })

    it('declares a private master seed and assigned starting positions (R-2.3)', () => {
        expect(RideTheRailsRuntime.randomnessVersion).toBe(1)
        expect(RideTheRailsRuntime.initializer.supportsStartingPositions).toBe(true)
    })

    it('registers no visibility, as nothing is hidden (R-5)', () => {
        expect(RideTheRailsRuntime).not.toHaveProperty('visibility')
    })
})
