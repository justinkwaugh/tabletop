import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { IMPERIAL_COLOR, PlayerStatus } from '../model/oathEnums.js'
import { testPlayer, testState } from '../testing/fixture.js'
import { accessibleCardIds, hasAccessToCard, ruledFaceupCardIds, rulesCard } from './access.js'
import '../powers/index.js'
import { reasonCannotUsePower } from './powerDoorway.js'
import { mayUseBattlePlansOf } from './battlePlans.js'
import { resolveModifiers } from './modifiers.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { ActionType } from '../definition/actions.js'

const ADVISER = 'denizen.hearth.wayside-inn'
const HIDDEN_ADVISER = 'denizen.nomad.tents'
const AT_RULED_SITE = 'denizen.order.messenger'
const AT_PAWN_SITE = 'denizen.beast.wolves'
const AT_IMPERIAL_SITE = 'denizen.arcane.tutor'
const RELIC = 'relic.cup-of-plenty'

function table() {
    return testState(
        [
            testPlayer({
                playerId: 'exile',
                color: Color.Red,
                siteId: 'h1',
                relicIds: [RELIC],
                advisers: [
                    { cardId: ADVISER, faceUp: true },
                    { cardId: HIDDEN_ADVISER, faceUp: false }
                ]
            }),
            testPlayer({ playerId: 'blue', color: Color.Blue, siteId: 'h1' }),
            testPlayer({
                playerId: 'chancellor',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c1'
            })
        ],
        {
            chancellorPlayerId: 'chancellor',
            denizensBySite: { c2: [AT_RULED_SITE], h1: [AT_PAWN_SITE], p1: [AT_IMPERIAL_SITE] },
            warbandsBySite: {
                c2: { [Color.Red]: 1 },
                h1: { [Color.Blue]: 1 },
                p1: { [IMPERIAL_COLOR]: 1 }
            }
        }
    )
}

describe('the cards a player rules (R-10.21)', () => {
    it('that show a suit are their faceup advisers and the cards at sites they rule (R-5.1.4.II)', () => {
        const state = table()
        expect(ruledFaceupCardIds(state, 'exile').sort()).toEqual([ADVISER, AT_RULED_SITE].sort())
        expect(ruledFaceupCardIds(state, 'chancellor')).toEqual([AT_IMPERIAL_SITE])
    })

    it('agree with rulesCard card by card: a held relic and the pawn site are not rule', () => {
        const state = table()
        for (const cardId of [ADVISER, HIDDEN_ADVISER, AT_RULED_SITE]) {
            expect(rulesCard(state, 'exile', cardId), cardId).toBe(true)
        }
        for (const cardId of [RELIC, AT_PAWN_SITE, AT_IMPERIAL_SITE]) {
            expect(rulesCard(state, 'exile', cardId), cardId).toBe(false)
        }
    })
})

describe('the cards a player has access to (R-7.1.1, R-7.1.1-H1)', () => {
    it('are the cards they rule, their held relics, and the cards at their pawn site', () => {
        const state = table()
        expect(accessibleCardIds(state, 'exile').sort()).toEqual(
            [ADVISER, HIDDEN_ADVISER, RELIC, AT_PAWN_SITE, AT_RULED_SITE].sort()
        )
        for (const cardId of accessibleCardIds(state, 'exile')) {
            expect(hasAccessToCard(state, 'exile', cardId), cardId).toBe(true)
        }
        expect(hasAccessToCard(state, 'exile', AT_IMPERIAL_SITE)).toBe(false)
    })
})

describe('a facedown adviser has no power, even for its holder (R-5.1.4.II)', () => {
    const ELDERS = 'denizen.nomad.elders'
    const SPECIALIST = 'denizen.order.specialist'
    const MUSHROOMS = 'denizen.beast.mushrooms'

    function holding(faceUp: boolean) {
        return testState([
            testPlayer({
                playerId: 'p1',
                siteId: 'c1',
                favor: 5,
                secrets: 5,
                advisers: [ELDERS, SPECIALIST, MUSHROOMS].map((cardId) => ({ cardId, faceUp }))
            })
        ])
    }

    it('refuses its Action power, its battle plan and its modifier, and a faceup copy of each is allowed', () => {
        const hidden = holding(false)
        expect(reasonCannotUsePower(hidden, 'p1', ELDERS, powerIndexOf(ELDERS, PowerTiming.Action), PowerTiming.Action)).toMatch(/facedown advisers, which have no power/)
        expect(mayUseBattlePlansOf(hidden, 'p1', SPECIALIST)).toBe(false)
        const mushrooms = [{ cardId: MUSHROOMS, powerIndex: powerIndexOf(MUSHROOMS, PowerTiming.Modifier) }]
        expect(resolveModifiers(hidden, 'p1', ActionType.Search, mushrooms).reason).toMatch(/facedown advisers, which have no power/)

        const shown = holding(true)
        expect(reasonCannotUsePower(shown, 'p1', ELDERS, powerIndexOf(ELDERS, PowerTiming.Action), PowerTiming.Action) ?? '').not.toMatch(/facedown/)
        expect(mayUseBattlePlansOf(shown, 'p1', SPECIALIST)).toBe(true)
        expect(resolveModifiers(shown, 'p1', ActionType.Search, mushrooms).reason ?? '').not.toMatch(/facedown/)
    })
})
