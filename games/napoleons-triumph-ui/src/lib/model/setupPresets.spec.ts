import { describe, expect, it } from 'vitest'
import { Scenario, Side, deployArmy } from '@tabletop/napoleons-triumph'
import { TestGame } from '@tabletop/napoleons-triumph/testing'
import {
    deploymentOf,
    fits,
    setupProblem,
    unassignedStacks,
    withCorpsOnMap,
    withFixedBatteryPosted
} from './armySetup.js'
import { SETUP_PRESETS, arrangedFromPreset } from './setupPresets.js'
import { copyOf } from './stateCopy.js'

// The fixed battery's post the harness tests use when the Santon rule is not in use.
const BATTERY_POST = { locale: 64, approach: 175 }

function gameFor(side: Side, santon: boolean, scenario: Scenario) {
    const game = new TestGame({ santon, scenario })
    if (side === Side.French) {
        game.deploy(Side.Allied)
    }
    return { state: game.hydrated, playerId: game.playerOf(side) }
}

describe('the published set-ups offered at deployment', () => {
    it.each(SETUP_PRESETS)(
        '$side $name places every unit and deploys by the rules, with the Santon or without',
        (preset) => {
            // On 1 December the Allies still choose their advance guard, checked below.
            const scenarios =
                preset.side === Side.French ? Object.values(Scenario) : [Scenario.December2]
            for (const [santon, scenario] of [true, false].flatMap((santon) =>
                scenarios.map((scenario) => [santon, scenario] as const)
            )) {
                const { state, playerId } = gameFor(preset.side, santon, scenario)
                let setup = arrangedFromPreset(state, playerId, preset)
                const context = `${preset.id}, santon ${santon}, ${scenario}`
                expect(fits(state, playerId, setup), context).toBe(true)

                const left = unassignedStacks(state, playerId, setup).flatMap(
                    (stack) => stack.unitIds
                )
                const batteryLeft = preset.batteryOnTheSanton && !santon
                expect(left, context).toHaveLength(batteryLeft ? 1 : 0)
                if (batteryLeft) {
                    setup = withFixedBatteryPosted(setup, left[0], BATTERY_POST)
                }

                expect(setupProblem(state, playerId, setup), context).toBeUndefined()
                expect(() =>
                    deployArmy(copyOf(state), playerId, deploymentOf(state, playerId, setup))
                ).not.toThrow()
            }
        }
    )

    it.each(SETUP_PRESETS.filter((preset) => preset.side === Side.Allied))(
        'Allied $name leaves the advance guard to be chosen on 1 December',
        (preset) => {
            const { state, playerId } = gameFor(Side.Allied, false, Scenario.December1)
            let setup = arrangedFromPreset(state, playerId, preset)
            expect(setup.corps.every((corps) => corps.offMap)).toBe(true)
            setup = withCorpsOnMap(withCorpsOnMap(setup, 'kienmayer', true), 'langeron', true)
            expect(fits(state, playerId, setup)).toBe(true)
        }
    )
})
