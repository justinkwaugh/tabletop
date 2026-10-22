import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { cardDefinitions } from '../data/cardRegistry.js'
import { cardPowers, powerKey, PowerTiming } from '../data/cardPowers.js'
import { GRAND_SCEPTER_ID } from '../data/relics.js'
import { hasEffect } from '../powers/registry.js'
import { testPlayer, testState } from '../testing/fixture.js'
import { legalPowers, reasonCannotUsePower } from './powerDoorway.js'
import '../powers/index.js'

/** R-7.1.1 — the timings a player uses through the doorway. */
const DOORWAY_TIMINGS: readonly PowerTiming[] = [PowerTiming.Action, PowerTiming.Rest]

/**
 * R-6.4, R-6.6.1, R-6.7 — the Grand Scepter's two printed Actions are its holder's minor actions
 * (letting an Exile peek in the Reliquary, offering Citizenship, exiling a Citizen), not card powers.
 */
const MINOR_ACTIONS = [powerKey(GRAND_SCEPTER_ID, 1), powerKey(GRAND_SCEPTER_ID, 2)]

describe('the doorway offers no card power it cannot resolve', () => {
    it('every Action and Rest power in the card data has an effect, but the Grand Scepter’s minor actions', () => {
        const walked = cardDefinitions().flatMap((card) =>
            cardPowers(card.id).filter((power) => DOORWAY_TIMINGS.includes(power.timing))
        )
        const withoutEffect = walked
            .filter((power) => !hasEffect(power))
            .map((power) => powerKey(power.cardId, power.powerIndex))

        expect(walked.length).toBeGreaterThan(MINOR_ACTIONS.length)
        expect(withoutEffect).toEqual(MINOR_ACTIONS)
    })

    it('the Grand Scepter’s holder is never offered them, and a use named by hand is refused in plain words', () => {
        const state = testState(
            [
                testPlayer({
                    playerId: 'holder',
                    color: Color.Purple,
                    siteId: 'c1',
                    relicIds: [GRAND_SCEPTER_ID]
                }),
                testPlayer({ playerId: 'other', color: Color.Red, siteId: 'c2' })
            ],
            { chancellorPlayerId: 'holder' }
        )

        for (const timing of DOORWAY_TIMINGS) {
            expect(legalPowers(state, 'holder', timing).map((use) => use.cardId)).not.toContain(
                GRAND_SCEPTER_ID
            )
        }
        for (const powerIndex of [1, 2]) {
            expect(
                reasonCannotUsePower(
                    state,
                    'holder',
                    GRAND_SCEPTER_ID,
                    powerIndex,
                    PowerTiming.Action
                )
            ).toBe(`${GRAND_SCEPTER_ID}'s power ${powerIndex} cannot be used as an "Action:" power`)
        }
    })
})
