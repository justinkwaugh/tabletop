import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { ActionType, PlayerStatus } from '@tabletop/oath'
import { testPlayer, testState } from '@tabletop/oath/testing'
import { freeActionDueLine, reasonActionUnavailable } from './actionAvailability.js'
import { ALL_ACTIONS } from './actionCatalogue.js'
import { IMPERIAL_WARBANDS } from '@tabletop/oath'

const CHANCELLOR = 'chan'
const EXILE = 'ex'

function board(overrides: Record<string, unknown> = {}) {
    return testState(
        [
            testPlayer({
                playerId: CHANCELLOR,
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c1',
                favor: 2,
                // R-6.7 needs the Grand Scepter and five favor; holding it leaves favor the limit.
                relicIds: ['relic.grand-scepter'],
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 },
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 20 }
            }),
            testPlayer({
                playerId: EXILE,
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: 'c2',
                warbandsInPersonalBank: { [EXILE]: 14 }
            })
        ],
        { chancellorPlayerId: CHANCELLOR, ...overrides }
    )
}

const nameOf = (id: string) => ({ [CHANCELLOR]: 'Alice', [EXILE]: 'Bob' })[id] ?? id

describe('why a dimmed action is dimmed', () => {
    it('never prints a player id', () => {
        const state = board()
        // A whole token, not a substring: the word "exile" contains the id "ex".
        const leaks = (reason: string, id: string) =>
            new RegExp(`(?<![A-Za-z0-9_-])${id}(?![A-Za-z0-9_-])`).test(reason)

        for (const { type } of ALL_ACTIONS) {
            const reason = reasonActionUnavailable(state, CHANCELLOR, type, nameOf)
            if (!reason) continue
            expect(leaks(reason, CHANCELLOR), `${type} leaked ${CHANCELLOR}`).toBe(false)
            expect(leaks(reason, EXILE), `${type} leaked ${EXILE}`).toBe(false)
        }
    })

    it('R-6.8 — explains that only a Citizen may self-exile, naming the player', () => {
        const reason = reasonActionUnavailable(
            board(),
            CHANCELLOR,
            ActionType.SelfExile,
            nameOf
        )
        expect(reason).toContain('only a Citizen can self-exile')
        expect(reason).toContain('Alice')
    })

    it('R-5.2.1, R-5.3.2 — says when there is no card at your site', () => {
        const state = board()
        expect(
            reasonActionUnavailable(state, CHANCELLOR, ActionType.Muster, nameOf)
        ).toContain('no card at your site')
        expect(
            reasonActionUnavailable(state, CHANCELLOR, ActionType.Trade, nameOf)
        ).toContain('no card at your site')
    })

    it('R-6.7 — distinguishes "no Citizens" from the favor cost', () => {
        const noCitizens = reasonActionUnavailable(
            board(),
            CHANCELLOR,
            ActionType.ExileCitizen,
            nameOf
        )
        expect(noCitizens).toContain('no Citizens')

        const withCitizen = board()
        withCitizen.getPlayerState(EXILE).status = PlayerStatus.Citizen
        const cannotAfford = reasonActionUnavailable(
            withCitizen,
            CHANCELLOR,
            ActionType.ExileCitizen,
            nameOf
        )
        // R-6.7 costs 5 favor and this Chancellor holds 2.
        expect(cannotAfford).toContain('favor')
        expect(cannotAfford).not.toContain('no Citizens')
    })

    it('is silent about an action that is available', () => {
        const state = board()
        // Travel is available to any placed pawn with Supply.
        expect(
            reasonActionUnavailable(state, CHANCELLOR, ActionType.Travel, nameOf)
        ).toBeUndefined()
    })
})

describe('R-10.2 — a granted free action comes next', () => {
    const due = (grant: Record<string, number>) =>
        testState(
            [
                testPlayer({ playerId: CHANCELLOR, color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'c1', ...grant }),
                testPlayer({ playerId: EXILE, color: Color.Red, status: PlayerStatus.Exile, siteId: 'c2' })
            ],
            { chancellorPlayerId: CHANCELLOR }
        )

    it('says above the grid which free action is due, and nothing when none is', () => {
        expect(freeActionDueLine(due({ freeTravelAtAction: 0, freeCampaignAtAction: 0 }), CHANCELLOR)).toBe(
            'Your free Travel or Campaign comes next: take it, give it up, or end the Act Phase.'
        )
        expect(freeActionDueLine(due({ freeCampaignAtAction: 0 }), CHANCELLOR)).toBe(
            'Your free Campaign comes next: take it, give it up, or end the Act Phase.'
        )
        expect(freeActionDueLine(due({ freeTravelAtAction: 1 }), CHANCELLOR)).toBeUndefined()
        expect(freeActionDueLine(board(), CHANCELLOR)).toBeUndefined()
    })

    it('a dimmed tile tapped repeats the reason; the free action itself is not refused for it', () => {
        const state = due({ freeTravelAtAction: 0 })
        expect(reasonActionUnavailable(state, CHANCELLOR, ActionType.Search)).toBe(
            'your free Travel comes first: take it or give it up'
        )
        expect(reasonActionUnavailable(state, CHANCELLOR, ActionType.Peek)).toBe(
            'your free Travel comes first: take it or give it up'
        )
        expect(reasonActionUnavailable(state, CHANCELLOR, ActionType.Travel) ?? '').not.toContain('comes first')
    })
})
