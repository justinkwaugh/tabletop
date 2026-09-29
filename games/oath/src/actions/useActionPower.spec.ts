import { describe, expect, it } from 'vitest'
import { HydratedUseActionPower, UseActionPower } from './useActionPower.js'
import { IMPERIAL_COLOR, PlayerStatus, Suit } from '../model/oathEnums.js'
import { testPlayer, testState } from '../testing/fixture.js'
import { Color } from '@tabletop/common'
import { hasAccessToCard, hasReliquaryPowerAccess, rulesCard } from '../util/access.js'
import { afterEach } from 'vitest'
import {
    declareChoices,
    one,
    PowerChoiceKind,
    type PowerChoice
} from '../util/powerChoice.js'
import { buildAction } from '../testing/actions.js'
import { bank, site } from '../testing/choices.js'

const CARD = 'denizen.hearth.spec-card'

function usePower(playerId: string, cardId: string, powerIndex = 0, choices?: PowerChoice[]) {
    return new HydratedUseActionPower(
        buildAction(UseActionPower, { playerId, cardId, powerIndex, choices })
    )
}

afterEach(() => declareChoices('denizen.order.captains', 0, []))

function boardWith(cardIds: string[], playerOverrides: Record<string, unknown> = {}) {
    return testState(
        [
            testPlayer({
                playerId: 'ruler',
                color: Color.Red,
                siteId: 'c1',
                ...playerOverrides
            })
        ],
        {
            denizensBySite: { c1: cardIds },
            warbandsBySite: { c1: { [Color.Red]: 1 } }
        }
    )
}

function board() {
    return testState(
        [
            testPlayer({ playerId: 'ruler', color: Color.Red, siteId: 'c1' }),
            testPlayer({ playerId: 'visitor', color: Color.Blue, siteId: 'c1' }),
            testPlayer({ playerId: 'absent', color: Color.Yellow, siteId: 'h1' })
        ],
        {
            denizensBySite: { c1: [CARD] },
            warbandsBySite: { c1: { [Color.Red]: 1 } }
        }
    )
}

describe('Access to a card power (R-7.1.1, R-10.21)', () => {
    it('rules any card at a site you rule', () => {
        const state = board()
        expect(rulesCard(state, 'ruler', CARD)).toBe(true)
        expect(rulesCard(state, 'visitor', CARD)).toBe(false)
    })

    it('rules your own advisers wherever your pawn is', () => {
        const state = board()
        state.getPlayerState('absent').setAdvisers([{ cardId: 'denizen.beast.mine', faceUp: true }])
        expect(rulesCard(state, 'absent', 'denizen.beast.mine')).toBe(true)
    })

    it('grants access to a visitor standing at the card’s site', () => {
        const state = board()
        expect(hasAccessToCard(state, 'visitor', CARD)).toBe(true)
        expect(hasAccessToCard(state, 'absent', CARD)).toBe(false)
    })

    it('shares access through purple among Imperial players (R-6.6.3)', () => {
        const state = testState(
            [
                testPlayer({
                    playerId: 'chan',
                    color: Color.Purple,
                    status: PlayerStatus.Chancellor,
                    siteId: 'h1'
                }),
                testPlayer({
                    playerId: 'cit',
                    color: Color.Red,
                    status: PlayerStatus.Citizen,
                    siteId: 'h1'
                })
            ],
            {
                denizensBySite: { c1: [CARD] },
                warbandsBySite: { c1: { [IMPERIAL_COLOR]: 1 } }
            }
        )
        // Neither pawn is at c1, so both reach it purely through R-6.6.3.
        expect(hasAccessToCard(state, 'chan', CARD)).toBe(true)
        expect(hasAccessToCard(state, 'cit', CARD)).toBe(true)
    })

    it('honours a Campaign-scoped suspension of Imperial status (R-5.5.1.a)', () => {
        const state = testState(
            [
                testPlayer({
                    playerId: 'cit',
                    color: Color.Red,
                    status: PlayerStatus.Citizen,
                    siteId: 'h1'
                })
            ],
            {
                denizensBySite: { c1: [CARD] },
                warbandsBySite: { c1: { [IMPERIAL_COLOR]: 1 } }
            }
        )
        expect(hasAccessToCard(state, 'cit', CARD)).toBe(true)
        expect(hasAccessToCard(state, 'cit', CARD, { nonImperialPlayerIds: ['cit'] })).toBe(false)
    })

    it('gives the Chancellor the uncovered Reliquary powers, and nobody else (R-2.3)', () => {
        const state = testState(
            [
                testPlayer({ playerId: 'chan', status: PlayerStatus.Chancellor }),
                testPlayer({ playerId: 'cit', status: PlayerStatus.Citizen })
            ],
            { reliquary: [{ slotId: 'rel-1' }] }
        )
        // Three of the four spaces are uncovered, so the access exists.
        expect(hasReliquaryPowerAccess(state, 'chan')).toBe(true)
        // R-7.1.1 and R-6.6.2.a name the Chancellor, not the Empire.
        expect(hasReliquaryPowerAccess(state, 'cit')).toBe(false)
    })

    it('grants no Reliquary power while all four spaces are covered', () => {
        const state = testState([testPlayer({ status: PlayerStatus.Chancellor })], {
            reliquary: [
                { slotId: 'rel-1' },
                { slotId: 'rel-2' },
                { slotId: 'rel-3' },
                { slotId: 'rel-4' }
            ]
        })
        expect(hasReliquaryPowerAccess(state, 'p1')).toBe(false)
    })
})

describe('R-7.1.1-H1 — a held relic works like your advisers', () => {
    it('grants access to a relic in your personal bank', () => {
        const state = board()
        state.getPlayerState('absent').relicIds = ['relic.grand-scepter']

        expect(hasAccessToCard(state, 'absent', 'relic.grand-scepter')).toBe(true)
        expect(state.getPlayerState('absent').siteId).toBe('h1')
    })

    // R-10.21 names advisers and not held relics, and under R-9.1 the omission is the rule.
    it('a held relic is not ruled', () => {
        const state = board()
        state.getPlayerState('absent').relicIds = ['relic.grand-scepter']
        expect(rulesCard(state, 'absent', 'relic.grand-scepter')).toBe(false)
    })

    it('grants nothing for a relic somebody else holds', () => {
        const state = board()
        state.getPlayerState('ruler').relicIds = ['relic.grand-scepter']
        expect(hasAccessToCard(state, 'visitor', 'relic.grand-scepter')).toBe(false)
    })

    it('R-6.2 — the Grand Scepter’s holder reaches the missing-effect refusal', () => {
        const state = board()
        state.getPlayerState('ruler').relicIds = ['relic.grand-scepter']

        expect(() => usePower('ruler', 'relic.grand-scepter', 1).apply(state)).toThrow(
            /card power effects are not implemented yet/
        )
    })
})

describe('Use an Action Power (R-6.2) — the doorway, complete but for the effect', () => {
    it('rejects a player without access before it mentions anything else (R-7.1.1)', () => {
        const state = board()
        expect(() => usePower('absent', CARD).apply(state)).toThrow(
            /you neither rule denizen.hearth.spec-card nor is your pawn at its site/
        )
    })

    it('refuses a card that prints no "Action:" power, and says so for good', () => {
        const state = boardWith(['denizen.order.longbows'])
        expect(() => usePower('ruler', 'denizen.order.longbows').apply(state)).toThrow(
            /denizen.order.longbows prints no "Action:" power/
        )
    })

    it('refuses an index that addresses a power of the wrong timing', () => {
        const state = boardWith(['relic.grand-scepter'])
        expect(() => usePower('ruler', 'relic.grand-scepter', 0).apply(state)).toThrow(
            /power 0 is continuous, not an "Action:" power/
        )
    })

    it('refuses an index the card does not have', () => {
        const state = boardWith(['relic.grand-scepter'])
        expect(() => usePower('ruler', 'relic.grand-scepter', 7).apply(state)).toThrow(
            /has no power at index 7/
        )
    })

    it('R-7.1.2 — refuses a cost the player cannot pay', () => {
        const state = boardWith(['denizen.order.captains'], { favor: 0 })
        expect(() => usePower('ruler', 'denizen.order.captains').apply(state)).toThrow(
            /costs 1 favor, player has 0/
        )
    })

    it('R-7.1.2.a — refuses when the card already holds favor or secrets', () => {
        const state = boardWith(['denizen.order.captains'], { favor: 3 })
        state.cardTokens['denizen.order.captains'] = { favor: 1, secrets: 0 }
        expect(() => usePower('ruler', 'denizen.order.captains').apply(state)).toThrow(
            /already has favor or secrets on it/
        )
    })

    it('refuses last of all for the effect that does not exist', () => {
        const state = boardWith(['denizen.order.captains'], { favor: 3 })
        expect(() => usePower('ruler', 'denizen.order.captains').apply(state)).toThrow(
            /card power effects are not implemented yet/
        )
    })

    // No effect resolves yet, and R-7.1.2 takes the payment first, so an offer would waste favor.
    it('is never offered, so the Act Phase does not advertise it', () => {
        const state = boardWith(['denizen.order.captains'], { favor: 3 })
        expect(HydratedUseActionPower.canDoUseActionPower(state, 'ruler')).toBe(false)
    })
})

describe('choices ride the action, checked after the cost and before the effect', () => {
    const CAPTAINS = 'denizen.order.captains'

    it('a stray choice on a power that asks none is refused, after the cost', () => {
        const state = boardWith([CAPTAINS], { favor: 3 })
        expect(() => usePower('ruler', CAPTAINS, 0, [{ kind: PowerChoiceKind.Yes }]).apply(state)).toThrow(
            /takes no choices, but 1 were given/
        )
    })

    it('the cost is refused BEFORE a missing choice is mentioned', () => {
        declareChoices(CAPTAINS, 0, [one(PowerChoiceKind.FavorBank, { what: 'a favor bank' })])
        const state = boardWith([CAPTAINS], { favor: 0 })
        expect(() => usePower('ruler', CAPTAINS).apply(state)).toThrow(/costs 1 favor, player has 0/)
    })

    it('a missing or bad choice is refused BEFORE the effect refusal', () => {
        declareChoices(CAPTAINS, 0, [one(PowerChoiceKind.FavorBank, { what: 'a favor bank' })])
        const state = boardWith([CAPTAINS], { favor: 3 })
        expect(() => usePower('ruler', CAPTAINS).apply(state)).toThrow(
            /no choice was made for a favor bank/
        )
        expect(() =>
            usePower('ruler', CAPTAINS, 0, [site('c1')]).apply(state)
        ).toThrow(/no choice was made for a favor bank/)
    })

    it('sound choices walk the whole doorway and reach the effect refusal last', () => {
        declareChoices(CAPTAINS, 0, [one(PowerChoiceKind.FavorBank, { what: 'a favor bank' })])
        const state = boardWith([CAPTAINS], { favor: 3 })
        expect(() =>
            usePower('ruler', CAPTAINS, 0, [bank(Suit.Beast)]).apply(state)
        ).toThrow(/card power effects are not implemented yet/)
    })

    it('choices survive the wire — dehydrate keeps them', () => {
        const action = usePower('ruler', CAPTAINS, 0, [{ kind: PowerChoiceKind.Yes }])
        expect(action.dehydrate().choices).toEqual([{ kind: PowerChoiceKind.Yes }])
    })
})
