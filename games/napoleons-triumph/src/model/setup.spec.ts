import { assertExists } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { SANTON_LOCALE } from '../components/austerlitz.js'
import type { ApproachDefinition } from '../components/battleMap.js'
import { Side } from '../components/pieces.js'
import { Scenario } from '../components/timeTrack.js'
import { TestGame } from '../testing/harness.js'
import { whyIllegal } from './legality.js'
import { approachTowardsEnemy, deployArmy, suggestedDeployment } from './setup.js'

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

    it('stands on the Santon, in reserve, when the Santon rule is in use', () => {
        const game = new TestGame({ santon: true })
        game.deploy(Side.Allied)
        const suggested = suggestedDeployment(game.hydrated, Side.French)
        const battery = suggested.fixedBattery
        assertExists(battery, 'The suggested French set-up names a fixed battery')
        expect(battery.approach).toBeUndefined()
        expect(suggested.detachments).toEqual([
            { unitId: battery.unitId, position: { locale: SANTON_LOCALE } }
        ])

        game.deploy(Side.French)
        const fixed = game.hydrated.unit(battery.unitId)
        expect(fixed.fixed).toBe(true)
        expect(fixed.position).toEqual({ locale: SANTON_LOCALE })
    })

    it('can be deployed as suggested however the blocks are dealt, with or without the Santon', () => {
        for (const santon of [true, false]) {
            for (const scenario of Object.values(Scenario)) {
                for (let deal = 0; deal < 24; deal++) {
                    const seed = (deal * 2654435761).toString(16).padStart(32, '0').slice(-32)
                    const game = new TestGame({ santon, scenario }, seed)
                    game.deploy(Side.Allied)
                    const state = game.hydrated
                    const suggested = suggestedDeployment(state, Side.French)
                    expect(
                        whyIllegal(() => deployArmy(state, game.playerOf(Side.French), suggested)),
                        `santon ${santon}, ${scenario}, seed ${seed}`
                    ).toBeUndefined()
                }
            }
        }
    })

    it('stays with its corps when the Santon rule is not in use', () => {
        const game = new TestGame()
        game.deploy(Side.Allied)
        expect(suggestedDeployment(game.hydrated, Side.French).detachments).toEqual([])
    })

    it('blocks the first approach of its locale while no enemy stands on the map', () => {
        const game = new TestGame()
        const state = game.hydrated
        const [first] = state.map.passableApproachesOf(64)
        expect(approachTowardsEnemy(state, game.playerOf(Side.French), 64).id).toBe(first.id)
    })
})
