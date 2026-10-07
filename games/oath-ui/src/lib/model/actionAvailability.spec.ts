import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { ActionType, Banner, PlayerStatus } from '@tabletop/oath'
import { testBanners, testPlayer, testState } from '@tabletop/oath/testing'
import { freeActionDueLine, reasonActionUnavailable } from './actionAvailability.js'
import { ALL_ACTIONS } from './actionCatalogue.js'
import { humanizeReason } from './names.js'
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

const seats = {
    seats: [CHANCELLOR, EXILE],
    player: (id: string) => ({ [CHANCELLOR]: 'Alice', [EXILE]: 'Bob' })[id] ?? id
}
const shown = (reason: string | undefined, viewerId: string | undefined) =>
    humanizeReason(reason, seats, viewerId)

describe('why a dimmed action is dimmed', () => {
    it('never prints a player id', () => {
        const state = board()
        // A whole token, not a substring: the word "exile" contains the id "ex".
        const leaks = (reason: string, id: string) =>
            new RegExp(`(?<![A-Za-z0-9_-])${id}(?![A-Za-z0-9_-])`).test(reason)

        for (const { type } of ALL_ACTIONS) {
            for (const viewerId of [CHANCELLOR, undefined]) {
                const reason = shown(reasonActionUnavailable(state, CHANCELLOR, type), viewerId)
                if (!reason) continue
                expect(leaks(reason, CHANCELLOR), `${type} leaked ${CHANCELLOR}`).toBe(false)
                expect(leaks(reason, EXILE), `${type} leaked ${EXILE}`).toBe(false)
            }
        }
    })

    it('R-6.8 — tells the reader that only a Citizen may self-exile, and what they are', () => {
        const state = board()
        expect(shown(reasonActionUnavailable(state, EXILE, ActionType.SelfExile), EXILE)).toBe(
            'only a Citizen can self-exile, and you are an Exile'
        )
        expect(
            shown(reasonActionUnavailable(state, CHANCELLOR, ActionType.SelfExile), CHANCELLOR)
        ).toBe('only a Citizen can self-exile, and you are the Chancellor')
    })

    it('R-5.2.1, R-5.3.2 — says when there is no card at your site', () => {
        const state = board()
        expect(
            reasonActionUnavailable(state, CHANCELLOR, ActionType.Muster)
        ).toContain('no card at your site')
        expect(
            reasonActionUnavailable(state, CHANCELLOR, ActionType.Trade)
        ).toContain('no card at your site')
    })

    it('R-6.7 — distinguishes "no Citizens" from the favor cost', () => {
        const noCitizens = reasonActionUnavailable(
            board(),
            CHANCELLOR,
            ActionType.ExileCitizen
        )
        expect(noCitizens).toContain('no Citizens')

        const withCitizen = board()
        withCitizen.getPlayerState(EXILE).status = PlayerStatus.Citizen
        const cannotAfford = reasonActionUnavailable(
            withCitizen,
            CHANCELLOR,
            ActionType.ExileCitizen
        )
        // R-6.7 costs 5 favor and this Chancellor holds 2.
        expect(cannotAfford).toContain('favor')
        expect(cannotAfford).not.toContain('no Citizens')
    })

    it('is silent about an action that is available', () => {
        const state = board()
        // Travel is available to any placed pawn with Supply.
        expect(
            reasonActionUnavailable(state, CHANCELLOR, ActionType.Travel)
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

describe('the Search tile and the Banner of the Darkest Secret', () => {
    function withTwoSupply(holderId?: string) {
        const state = board({
            visionsDrawn: 1,
            banners: testBanners(holderId ? { [Banner.DarkestSecret]: holderId } : {})
        })
        state.getPlayerState(EXILE).supply = 2
        return state
    }

    it('is lit for its holder with 2 Supply where the track says 3', () => {
        expect(reasonActionUnavailable(withTwoSupply(EXILE), EXILE, ActionType.Search)).toBeUndefined()
    })

    it('stays dimmed for anyone else with 2 Supply', () => {
        expect(reasonActionUnavailable(withTwoSupply(CHANCELLOR), EXILE, ActionType.Search)).toBeDefined()
        expect(reasonActionUnavailable(withTwoSupply(), EXILE, ActionType.Search)).toBeDefined()
    })
})
