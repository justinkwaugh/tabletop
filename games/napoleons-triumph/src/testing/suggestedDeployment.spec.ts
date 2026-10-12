import { assertExists } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { SANTON_LOCALE } from '../components/austerlitz.js'
import { Side } from '../components/pieces.js'
import { Scenario } from '../components/timeTrack.js'
import { whyIllegal } from '../model/legality.js'
import { deployArmy } from '../model/setup.js'
import { TestGame } from './harness.js'
import { suggestedDeployment } from './suggestedDeployment.js'

describe('the set-up the specs deploy', () => {
    it('is legal for both armies however the blocks are dealt, with or without the Santon', () => {
        for (const santon of [true, false]) {
            for (const scenario of Object.values(Scenario)) {
                for (let deal = 0; deal < 24; deal++) {
                    const seed = (deal * 2654435761).toString(16).padStart(32, '0').slice(-32)
                    const game = new TestGame({ santon, scenario }, seed)
                    for (const side of [Side.Allied, Side.French]) {
                        const state = game.hydrated
                        const suggested = suggestedDeployment(state, side)
                        expect(
                            whyIllegal(() => deployArmy(state, game.playerOf(side), suggested)),
                            `${side}, santon ${santon}, ${scenario}, seed ${seed}`
                        ).toBeUndefined()
                        game.deploy(side)
                    }
                }
            }
        }
    })

    it('posts the French fixed battery on the Santon, in reserve, when the Santon rule is in use', () => {
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

    it('keeps the French fixed battery in its own set-up locale when the Santon rule is not in use', () => {
        const game = new TestGame()
        game.deploy(Side.Allied)
        expect(suggestedDeployment(game.hydrated, Side.French).detachments).toEqual([])
    })
})
