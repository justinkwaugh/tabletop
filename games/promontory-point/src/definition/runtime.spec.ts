import { Color, createAction, type GameAction } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { PromontoryPointGameStateValidator } from '../model/gameState.js'
import { CURRENT_PROMONTORY_POINT_REVISION } from '../model/gameState.js'
import { PromontoryPointHydrator } from './hydrator.js'
import { ActionType } from './actions.js'
import { PromontoryPointApiActions } from './apiActions.js'
import { PromontoryPointConfigurator } from './config.js'
import { Definition } from './definition.js'
import { PromontoryPointGameInitializer } from './initializer.js'
import { PromontoryPointProgression } from './progression.js'
import { PromontoryPointRuntime } from './runtime.js'
import { PromontoryPointScoring } from './scoring.js'
import { PromontoryPointStateHandlers } from './stateHandlers.js'
import { MachineState } from './states.js'
import { VARIANT_OFF_AND_ON, startGame } from '../testing/startGame.js'

describe('Promontory Point definition', () => {
    it('R-1.3, R-2.1-H1: registers the initializer, hydrator, canonical validator, scoring and Game Progress', () => {
        expect(PromontoryPointRuntime.initializer).toBeInstanceOf(PromontoryPointGameInitializer)
        expect(PromontoryPointRuntime.hydrator).toBeInstanceOf(PromontoryPointHydrator)
        expect(PromontoryPointRuntime.canonicalStateValidator).toBe(
            PromontoryPointGameStateValidator
        )
        expect(PromontoryPointRuntime.scoring).toBeInstanceOf(PromontoryPointScoring)
        expect(PromontoryPointRuntime.progression).toBeInstanceOf(PromontoryPointProgression)
        expect(Definition.info.metadata.hasScores).toBe(true)
    })

    it('R-6.3-H1: registers the configurator with the four-piece variant', () => {
        expect(Definition.info.configurator).toBeInstanceOf(PromontoryPointConfigurator)
        expect(Definition.runtime.configuration?.normalizeConfig({})).toEqual({
            fourPieceVariant: false
        })
    })

    it('R-2.1-H1: declares randomness version 1 and starting positions', () => {
        expect(Definition.runtime.randomnessVersion).toBe(1)
        expect(Definition.runtime.initializer.supportsStartingPositions).toBe(true)
    })

    it('R-2.2: registers every action schema with the hydrator and every machine state with its handler', () => {
        expect(Object.keys(PromontoryPointRuntime.apiActions).sort()).toEqual(
            Object.values(ActionType).sort()
        )
        for (const type of Object.values(ActionType)) {
            const data: GameAction = createAction(PromontoryPointApiActions[type], {})
            const hydrated = PromontoryPointRuntime.hydrator.hydrateAction(data)
            expect(hydrated.type).toBe(type)
        }
        expect(PromontoryPointRuntime.stateHandlers).toBe(PromontoryPointStateHandlers)
        expect(Object.keys(PromontoryPointRuntime.stateHandlers).sort()).toEqual(
            Object.values(MachineState).sort()
        )
    })

    it('O-1: seats are green, orange, black and white, one colour each', () => {
        expect(PromontoryPointRuntime.playerColors).toEqual([
            Color.Green,
            Color.Orange,
            Color.Black,
            Color.White
        ])
        for (const playerCount of [2, 3, 4]) {
            const colors = startGame({ playerCount }).state.players.map((player) => player.color)
            expect(new Set(colors).size).toBe(playerCount)
            for (const color of colors) {
                expect(PromontoryPointRuntime.playerColors).toContain(color)
            }
        }
    })

    it('R-X.3: every new game is created under the current revision, 1', () => {
        expect(CURRENT_PROMONTORY_POINT_REVISION).toBe(1)
        for (const config of VARIANT_OFF_AND_ON) {
            expect(startGame({ config }).state.promontoryPointRevision).toBe(1)
        }
    })
})
