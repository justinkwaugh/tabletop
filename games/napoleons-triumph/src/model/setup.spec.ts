import { assertExists } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import type { ApproachDefinition } from '../components/battleMap.js'
import { Side } from '../components/pieces.js'
import { TestGame } from '../testing/harness.js'
import { approachTowardsEnemy, suggestedDeployment } from './setup.js'

describe('the fixed battery of the suggested French set-up', () => {
    it('blocks the approach of its locale that looks towards the nearest Allied piece', () => {
        const game = new TestGame()
        game.deploy(Side.Allied)
        const state = game.hydrated
        const french = game.playerOf(Side.French)
        const battery = suggestedDeployment(state, Side.French).fixedBattery
        assertExists(battery?.approach, 'The suggested French set-up aims its fixed battery')
        const aimed = state.map.approach(battery.approach)
        const alliedLocales = state.units.flatMap((unit) =>
            unit.playerId !== french && unit.position ? [unit.position.locale] : []
        )
        const stepsToAllies = (approach: ApproachDefinition) =>
            Math.min(
                ...alliedLocales.map(
                    (held) => state.map.distance(approach.neighbour, held) ?? Infinity
                )
            )

        expect(aimed.id).toBe(approachTowardsEnemy(state, french, aimed.locale).id)
        for (const other of state.map.passableApproachesOf(aimed.locale)) {
            expect(stepsToAllies(aimed)).toBeLessThanOrEqual(stepsToAllies(other))
        }
    })

    it('blocks the first approach of its locale while no enemy stands on the map', () => {
        const game = new TestGame()
        const state = game.hydrated
        const [first] = state.map.passableApproachesOf(64)
        expect(approachTowardsEnemy(state, game.playerOf(Side.French), 64).id).toBe(first.id)
    })
})
