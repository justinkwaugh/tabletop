import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { ActionType, Banner, PlayerStatus, type HydratedOathGameState } from '@tabletop/oath'
import { testBanners, testPlayer, testState } from '@tabletop/oath/testing'
import { freeActionDueLine, gridRefusal, reasonActionUnavailable, refusalWords, tileCost } from './actionAvailability.js'
import { MAJOR_ACTIONS, type MajorAction } from './actionCatalogue.js'
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

/** The line under the grid: the short words for a cause it names, else the engine's sentence. */
function line(state: HydratedOathGameState, playerId: string, type: MajorAction): string | undefined {
    const refusal = gridRefusal(state, playerId, type)
    if (!refusal) return undefined
    return refusal.cause === 'engine' ? refusal.reason : refusalWords(refusal)
}

describe('why a dimmed action is dimmed', () => {
    it('never prints a player id', () => {
        const state = board()
        // A whole token, not a substring: the word "exile" contains the id "ex".
        const leaks = (reason: string, id: string) =>
            new RegExp(`(?<![A-Za-z0-9_-])${id}(?![A-Za-z0-9_-])`).test(reason)

        for (const { type } of MAJOR_ACTIONS) {
            for (const viewerId of [CHANCELLOR, undefined]) {
                const reason = shown(reasonActionUnavailable(state, CHANCELLOR, type), viewerId)
                if (!reason) continue
                expect(leaks(reason, CHANCELLOR), `${type} leaked ${CHANCELLOR}`).toBe(false)
                expect(leaks(reason, EXILE), `${type} leaked ${EXILE}`).toBe(false)
            }
        }
    })

    it('R-5.2.1, R-5.3.2 — says when there is no card at your site', () => {
        const state = board()
        expect(line(state, CHANCELLOR, ActionType.Muster)).toBe('No card here.')
        expect(line(state, CHANCELLOR, ActionType.Trade)).toBe('No card here.')
    })

    it('is silent about an action that is available', () => {
        const state = board()
        // Travel is available to any placed pawn with Supply.
        expect(
            reasonActionUnavailable(state, CHANCELLOR, ActionType.Travel)
        ).toBeUndefined()
        expect(gridRefusal(state, CHANCELLOR, ActionType.Travel)).toBeUndefined()
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
        expect(freeActionDueLine(due({ freeTravelAtAction: 0, freeCampaignAtAction: 0 }), CHANCELLOR)).toBe('Free Travel or Campaign next.')
        expect(freeActionDueLine(due({ freeCampaignAtAction: 0 }), CHANCELLOR)).toBe('Free Campaign next.')
        expect(freeActionDueLine(due({ freeTravelAtAction: 0 }), CHANCELLOR)).toBe('Free Travel next.')
        expect(freeActionDueLine(due({ freeTravelAtAction: 1 }), CHANCELLOR)).toBeUndefined()
        expect(freeActionDueLine(board(), CHANCELLOR)).toBeUndefined()
    })

    it('a dimmed tile tapped says the free action comes first; the free action itself is not refused for it', () => {
        const state = due({ freeTravelAtAction: 0 })
        expect(line(state, CHANCELLOR, ActionType.Search)).toBe('Free Travel first.')
        expect(line(state, CHANCELLOR, ActionType.Muster)).toBe('Free Travel first.')
        expect(line(due({ freeTravelAtAction: 0, freeCampaignAtAction: 0 }), CHANCELLOR, ActionType.Recover)).toBe('Free Travel or Campaign first.')
        expect(line(state, CHANCELLOR, ActionType.Travel) ?? '').not.toContain('first')
    })

    it('the Travel tile shows the Supply the engine charges for the free Travel: none', () => {
        const travel = MAJOR_ACTIONS.find((entry) => entry.type === ActionType.Travel)
        if (!travel) throw Error('Travel is a major action')
        expect(tileCost(due({ freeTravelAtAction: 0 }), CHANCELLOR, travel)).toBe('no Supply')
        expect(tileCost(due({ freeTravelAtAction: 1 }), CHANCELLOR, travel)).toBe('1–4 Supply')
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

describe('the line under a dimmed major, by cause', () => {
    const SEAT = 'denizen.order.council-seat'
    const INN = 'denizen.hearth.wayside-inn'
    const POVERTY = 'denizen.beast.vow-of-poverty'

    /** The Exile alone at c1 with one card or more there, judged as they read it. */
    function exileAt(player: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
        return testState(
            [
                testPlayer({ playerId: EXILE, color: Color.Red, status: PlayerStatus.Exile, siteId: 'c1', ...player }),
                testPlayer({ playerId: CHANCELLOR, color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'p1' })
            ],
            { chancellorPlayerId: CHANCELLOR, ...overrides }
        )
    }
    const atInn = { denizensBySite: { c1: [INN] } }

    it('Supply short, on any major: needs and has', () => {
        const short = (supply: number) => exileAt({ supply, favor: 2, secrets: 1 }, atInn)
        expect(line(short(1), EXILE, ActionType.Search)).toBe('Needs 2 Supply; you have 1.')
        expect(line(short(0), EXILE, ActionType.Muster)).toBe('Needs 1 Supply; you have 0.')
        expect(line(short(0), EXILE, ActionType.Trade)).toBe('Needs 1 Supply; you have 0.')
        expect(line(short(0), EXILE, ActionType.Travel)).toBe('Needs 1 Supply; you have 0.')
    })

    it('Campaign: Supply short, and nobody to attack', () => {
        const withChancellorHere = (supply: number) =>
            testState(
                [
                    testPlayer({ playerId: EXILE, color: Color.Red, status: PlayerStatus.Exile, siteId: 'c1', supply }),
                    testPlayer({ playerId: CHANCELLOR, color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'c1' })
                ],
                { chancellorPlayerId: CHANCELLOR }
            )
        expect(line(withChancellorHere(1), EXILE, ActionType.Campaign)).toBe('Needs 2 Supply; you have 1.')
        expect(line(exileAt({}, { warbandsBySite: { c1: { [EXILE]: 2 } } }), EXILE, ActionType.Campaign)).toBe('Nobody here to attack.')
    })

    it('Search: both piles empty', () => {
        expect(line(exileAt({}, { worldDeckExhausted: true }), EXILE, ActionType.Search)).toBe('Nothing to draw.')
    })

    it('Muster and Trade: every card here holds a token', () => {
        const full = exileAt({ favor: 2, secrets: 1 }, { ...atInn, cardTokens: { [INN]: { favor: 1, secrets: 0 } } })
        expect(line(full, EXILE, ActionType.Muster)).toBe('No empty card here.')
        expect(line(full, EXILE, ActionType.Trade)).toBe('No empty card here.')
    })

    it('Muster: no favor to place', () => {
        expect(line(exileAt({ favor: 0 }, atInn), EXILE, ActionType.Muster)).toBe('Needs 1 favor; you have 0.')
    })

    it('Trade: nothing to place, and Vow of Poverty', () => {
        expect(line(exileAt({ favor: 1, secrets: 0 }, atInn), EXILE, ActionType.Trade)).toBe('Needs 1 secret or 2 favor.')
        const sworn = exileAt({ favor: 1, secrets: 1, advisers: [{ cardId: POVERTY, faceUp: true }] }, atInn)
        expect(line(sworn, EXILE, ActionType.Trade)).toBe('Vow of Poverty: no favor from Trade.')
    })

    it('Recover: nothing here, or nothing it can pay for', () => {
        const both = testBanners({ [Banner.PeoplesFavor]: EXILE, [Banner.DarkestSecret]: EXILE })
        expect(line(exileAt({}, { banners: both }), EXILE, ActionType.Recover)).toBe('Nothing to recover.')
        expect(line(exileAt({ favor: 0 }), EXILE, ActionType.Recover)).toBe('Can’t pay for any of it.')
    })

    it('mixed causes keep the engine’s sentence: one card holds a token, the other is empty but there is no favor', () => {
        const mixed = exileAt({ favor: 1, secrets: 0 }, { denizensBySite: { c1: [SEAT, INN] }, cardTokens: { [SEAT]: { favor: 1, secrets: 0 } } })
        expect(line(mixed, EXILE, ActionType.Trade)).toBe(reasonActionUnavailable(mixed, EXILE, ActionType.Trade))
        expect(line(mixed, EXILE, ActionType.Trade)).toContain('already has favor or secrets on it')
    })

    it('mixed causes keep the engine’s sentence: the discard is empty and the world deck too dear', () => {
        const state = exileAt({ supply: 2 }, { visionsDrawn: 1 })
        expect(line(state, EXILE, ActionType.Search)).toBe(reasonActionUnavailable(state, EXILE, ActionType.Search))
        expect(line(state, EXILE, ActionType.Search)).toContain('discard pile is empty')
    })
})
