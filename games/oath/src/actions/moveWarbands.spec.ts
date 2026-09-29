import { describe, expect, it } from 'vitest'
import { HydratedMoveWarbands, MoveWarbands } from './moveWarbands.js'
import { WarbandMoveKind, type WarbandMove } from '../model/warbandMove.js'
import { IMPERIAL_COLOR, PlayerStatus } from '../model/oathEnums.js'
import { testPlayer, testState } from '../testing/fixture.js'
import { Color } from '@tabletop/common'
import { expectOneWarbandColorPerSite, expectWarbandsConserved } from '../testing/census.js'
import { answerConsent, buildAction } from '../testing/actions.js'
import { ConsentRequestKind } from '../model/consent.js'

function move(playerId: string, m: WarbandMove, color: Color, count: number) {
    return new HydratedMoveWarbands(buildAction(MoveWarbands, { playerId, move: m, color, count }))
}

const SITE_TO_BOARD: WarbandMove = { kind: WarbandMoveKind.SiteToBoard }
const BOARD_TO_SITE: WarbandMove = { kind: WarbandMoveKind.BoardToSite }

function exileAtOwnSite(overrides = {}) {
    return testState(
        [
            testPlayer({
                siteId: 'c1',
                warbandsOnBoard: { [Color.Red]: 2 },
                warbandsInPersonalBank: { [Color.Red]: 9 },
                ...overrides
            })
        ],
        { warbandsBySite: { c1: { [Color.Red]: 3 } } }
    )
}

describe('Move Warbands To/From Your Site (R-6.5)', () => {
    it('moves warbands off your site, leaving the last one behind', () => {
        const state = exileAtOwnSite()
        expectWarbandsConserved(state, () => {
            move('p1', SITE_TO_BOARD, Color.Red, 2).apply(state)
        })

        expect(state.warbandsBySite['c1']).toEqual({ [Color.Red]: 1 })
        expect(state.getPlayerState('p1').warbandsOnBoard).toEqual({ [Color.Red]: 4 })
    })

    it('costs no Supply (R-6)', () => {
        const state = exileAtOwnSite({ supply: 6 })
        move('p1', SITE_TO_BOARD, Color.Red, 1).apply(state)

        const p = state.getPlayerState('p1')
        expect(p.supply).toBe(6)
        expect(p.supplySpentThisTurn).toBe(0)
    })

    it('refuses to move the last warband off your site (R-10.21)', () => {
        const state = exileAtOwnSite()
        expect(() => move('p1', SITE_TO_BOARD, Color.Red, 3).apply(state)).toThrow(
            /at most 2 \(the last one must stay to keep rule of the site\)/
        )
        expect(HydratedMoveWarbands.maxMovable(state, 'p1', SITE_TO_BOARD, Color.Red)).toBe(2)
    })

    it('cannot move any warband off a site holding only one', () => {
        const state = exileAtOwnSite()
        state.warbandsBySite['c1'] = { [Color.Red]: 1 }
        expect(HydratedMoveWarbands.maxMovable(state, 'p1', SITE_TO_BOARD, Color.Red)).toBe(0)
        expect(() => move('p1', SITE_TO_BOARD, Color.Red, 1).apply(state)).toThrow(/at most 0/)
    })

    it('moves warbands onto a site you rule', () => {
        const state = exileAtOwnSite()
        expectWarbandsConserved(state, () => {
            move('p1', BOARD_TO_SITE, Color.Red, 2).apply(state)
        })

        expect(state.warbandsBySite['c1']).toEqual({ [Color.Red]: 5 })
        expect(state.getPlayerState('p1').warbandsOnBoard).toEqual({ [Color.Red]: 0 })
        expectOneWarbandColorPerSite(state)
    })

    it('refuses to move warbands onto a site you do not rule — the move is one-directional', () => {
        const state = exileAtOwnSite()
        state.warbandsBySite['c1'] = {}
        expect(() => move('p1', BOARD_TO_SITE, Color.Red, 1).apply(state)).toThrow(
            /you do not rule c1, so you cannot move warbands onto it/
        )
    })

    it('refuses a colour that is not yours, even when it is sitting in the right place (R-10.21)', () => {
        const state = exileAtOwnSite()
        state.getPlayerState('p1').warbandsOnBoard[Color.Blue] = 3
        expect(() => move('p1', BOARD_TO_SITE, Color.Blue, 1).apply(state)).toThrow(
            /blue warbands are not your \(red\)/
        )
    })

    it('lets an Imperial player move purple as well as their own colour (R-6.6.3)', () => {
        const state = exileAtOwnSite({ status: PlayerStatus.Citizen })
        state.getPlayerState('p1').warbandsOnBoard[IMPERIAL_COLOR] = 2
        state.warbandsBySite['c1'] = { [IMPERIAL_COLOR]: 2 }

        expect(
            HydratedMoveWarbands.reasonCannotMove(state, 'p1', {
                move: BOARD_TO_SITE,
                color: Color.Purple,
                count: 1
            })
        ).toBeUndefined()
    })

    it('refuses a move of zero or fewer (R-9.5)', () => {
        const state = exileAtOwnSite()
        expect(() => move('p1', SITE_TO_BOARD, Color.Red, 0).apply(state)).toThrow(
            /must move at least one warband/
        )
    })

    it('asks nobody when the move needs no permission', () => {
        const state = exileAtOwnSite()
        move('p1', SITE_TO_BOARD, Color.Red, 1).apply(state)
        expect(state.pendingConsent).toBeUndefined()
        expect(state.warbandsBySite['c1']).toEqual({ [Color.Red]: 2 })
    })
})

function citizenAndChancellor(overrides = {}) {
    return testState(
        [
            testPlayer({
                playerId: 'cit',
                color: Color.Red,
                status: PlayerStatus.Citizen,
                siteId: 'c1',
                warbandsOnBoard: { [IMPERIAL_COLOR]: 2 },
                warbandsInPersonalBank: { [Color.Red]: 14 },
                ...overrides
            }),
            testPlayer({
                playerId: 'chan',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c1',
                warbandsOnBoard: { [IMPERIAL_COLOR]: 3 },
                warbandsInPersonalBank: { [IMPERIAL_COLOR]: 19 }
            })
        ],
        {
            chancellorPlayerId: 'chan',
            warbandsBySite: { c1: { [IMPERIAL_COLOR]: 3 } }
        }
    )
}

describe('A Citizen needs the Chancellor’s permission (R-6.5.a)', () => {
    it('asks the Chancellor, and nothing moves until they answer', () => {
        const state = citizenAndChancellor()
        const request = move('cit', SITE_TO_BOARD, IMPERIAL_COLOR, 1)
        request.apply(state)
        expect(state.pendingConsent).toMatchObject({
            request: { kind: ConsentRequestKind.WarbandMove, count: 1 },
            askingPlayerId: 'cit',
            askedPlayerId: 'chan'
        })
        expect(request.metadata?.awaitingConsentOf).toBe('chan')
        expect(state.warbandsBySite['c1']).toEqual({ [IMPERIAL_COLOR]: 3 })
    })

    it('a consent the mover writes into their own action is never read', () => {
        const state = citizenAndChancellor()
        const sent = buildAction(MoveWarbands, { playerId: 'cit', move: SITE_TO_BOARD, color: IMPERIAL_COLOR, count: 1 })
        const forged = { ...sent, consent: { playerId: 'chan', granted: true } }
        new HydratedMoveWarbands(forged).apply(state)
        expect(state.pendingConsent?.askedPlayerId).toBe('chan')
        expect(state.warbandsBySite['c1']).toEqual({ [IMPERIAL_COLOR]: 3 })
    })

    it('only the asked player answers', () => {
        const state = citizenAndChancellor()
        move('cit', SITE_TO_BOARD, IMPERIAL_COLOR, 1).apply(state)
        expect(() => answerConsent(state, 'cit', true)).toThrow(/made to chan, not to cit/)
    })

    it('a refusal moves nothing and closes the request (R-X.1)', () => {
        const state = citizenAndChancellor()
        move('cit', SITE_TO_BOARD, IMPERIAL_COLOR, 1).apply(state)
        answerConsent(state, 'chan', false)
        expect(state.pendingConsent).toBeUndefined()
        expect(state.warbandsBySite['c1']).toEqual({ [IMPERIAL_COLOR]: 3 })
    })

    it('the Chancellor’s permission carries the move out', () => {
        const state = citizenAndChancellor()
        expectWarbandsConserved(state, () => {
            move('cit', SITE_TO_BOARD, IMPERIAL_COLOR, 2).apply(state)
            answerConsent(state, 'chan', true)
        })
        expect(state.warbandsBySite['c1']).toEqual({ [IMPERIAL_COLOR]: 1 })
        expect(state.getPlayerState('cit').warbandsOnBoard).toEqual({ [IMPERIAL_COLOR]: 4 })
    })

    it('does NOT apply to the reverse direction', () => {
        const state = citizenAndChancellor()
        move('cit', BOARD_TO_SITE, IMPERIAL_COLOR, 2).apply(state)
        expect(state.pendingConsent).toBeUndefined()
        expect(state.warbandsBySite['c1']).toEqual({ [IMPERIAL_COLOR]: 5 })
    })

    it('does not apply to the Chancellor themselves', () => {
        const state = citizenAndChancellor()
        move('chan', SITE_TO_BOARD, IMPERIAL_COLOR, 1).apply(state)
        expect(state.pendingConsent).toBeUndefined()
        expect(state.getPlayerState('chan').warbandsOnBoard).toEqual({ [IMPERIAL_COLOR]: 4 })
    })
})

describe('Imperial give and take (R-6.5.b)', () => {
    const take: WarbandMove = { kind: WarbandMoveKind.TakeFromImperial, otherPlayerId: 'chan' }
    const giveToChan: WarbandMove = { kind: WarbandMoveKind.GiveToImperial, otherPlayerId: 'chan' }

    it('gives warbands to another Imperial player with their permission', () => {
        const state = citizenAndChancellor()
        expectWarbandsConserved(state, () => {
            move('cit', giveToChan, IMPERIAL_COLOR, 2).apply(state)
            answerConsent(state, 'chan', true)
        })
        expect(state.getPlayerState('cit').warbandsOnBoard).toEqual({ [IMPERIAL_COLOR]: 0 })
        expect(state.getPlayerState('chan').warbandsOnBoard).toEqual({ [IMPERIAL_COLOR]: 5 })
    })

    it('takes warbands from another Imperial player with their permission', () => {
        const state = citizenAndChancellor()
        move('cit', take, IMPERIAL_COLOR, 3).apply(state)
        answerConsent(state, 'chan', true)
        expect(state.getPlayerState('chan').warbandsOnBoard).toEqual({ [IMPERIAL_COLOR]: 0 })
        expect(state.getPlayerState('cit').warbandsOnBoard).toEqual({ [IMPERIAL_COLOR]: 5 })
    })

    it('asks the OTHER player, not the Chancellor qua Chancellor', () => {
        // R-6.5.b asks the other end of the transfer; only R-6.5.a asks the Chancellor.
        const state = citizenAndChancellor()
        move('cit', giveToChan, IMPERIAL_COLOR, 1).apply(state)
        expect(state.pendingConsent?.askedPlayerId).toBe('chan')
        expect(() => move('chan', take, IMPERIAL_COLOR, 1).apply(citizenAndChancellor())).toThrow(
            /cannot give warbands to or take them from yourself/
        )
    })

    it('asks in BOTH directions', () => {
        const state = citizenAndChancellor()
        move('cit', take, IMPERIAL_COLOR, 1).apply(state)
        expect(state.pendingConsent?.askedPlayerId).toBe('chan')
        expect(state.getPlayerState('chan').warbandsOnBoard).toEqual({ [IMPERIAL_COLOR]: 3 })
    })

    it('a permission the board no longer allows cannot be given, and refusing still closes the request', () => {
        const state = citizenAndChancellor()
        move('cit', take, IMPERIAL_COLOR, 3).apply(state)
        state.getPlayerState('chan').warbandsOnBoard = { [IMPERIAL_COLOR]: 1 }
        expect(() => answerConsent(state, 'chan', true)).toThrow(/at most 1/)
        answerConsent(state, 'chan', false)
        expect(state.pendingConsent).toBeUndefined()
    })

    it('refuses when the other player is not Imperial (R-10.12)', () => {
        const state = citizenAndChancellor()
        state.getPlayerState('chan').status = PlayerStatus.Exile
        state.chancellorPlayerId = undefined
        expect(() => move('cit', giveToChan, IMPERIAL_COLOR, 1).apply(state)).toThrow(
            /chan is not an Imperial player/
        )
    })

    it('refuses when the other pawn is not at your site', () => {
        const state = citizenAndChancellor()
        state.getPlayerState('chan').siteId = 'h1'
        expect(() => move('cit', giveToChan, IMPERIAL_COLOR, 1).apply(state)).toThrow(
            /chan's pawn is not at your site/
        )
    })
})

describe('what R-6.5 offers', () => {
    it('offers a move only where warbands could actually go', () => {
        const state = exileAtOwnSite()
        const moves = HydratedMoveWarbands.legalMoves(state, 'p1')
        expect(moves).toEqual([
            { move: SITE_TO_BOARD, color: Color.Red, max: 2 },
            { move: BOARD_TO_SITE, color: Color.Red, max: 2 }
        ])
    })

    it('offers a move that needs permission; sending it asks for the permission (R-X.1)', () => {
        const state = citizenAndChancellor()
        expect(HydratedMoveWarbands.canDoMoveWarbands(state, 'cit')).toBe(true)
        expect(
            HydratedMoveWarbands.legalMoves(state, 'cit').some(
                (m) => m.move.kind === WarbandMoveKind.SiteToBoard
            )
        ).toBe(true)
    })

    it('offers nothing to a player with no warbands anywhere', () => {
        const state = testState([testPlayer({ siteId: 'c1' })])
        expect(HydratedMoveWarbands.canDoMoveWarbands(state, 'p1')).toBe(false)
    })
})

describe('R-6.5 — "except the last one" is applied per colour, not per player', () => {
    it('a mixed-colour site floors at one warband PER COLOUR, leaving two behind', () => {
        // Reachable only through R-6.6.2's purple shortage; flooring per colour is stricter than R-6.5.
        const state = testState(
            [
                testPlayer({
                    playerId: 'cit',
                    color: Color.Blue,
                    status: PlayerStatus.Citizen,
                    siteId: 'c1'
                })
            ],
            { warbandsBySite: { c1: { purple: 3, [Color.Blue]: 2 } } }
        )
        const move = { kind: WarbandMoveKind.SiteToBoard } as const
        expect(HydratedMoveWarbands.maxMovable(state, 'cit', move, Color.Purple)).toBe(2)
        expect(HydratedMoveWarbands.maxMovable(state, 'cit', move, Color.Blue)).toBe(1)
    })
})
