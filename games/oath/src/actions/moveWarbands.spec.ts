import { describe, expect, it } from 'vitest'
import { HydratedMoveWarbands, MoveWarbands } from './moveWarbands.js'
import { WarbandMoveKind, type WarbandMove } from '../model/warbandMove.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { Color } from '@tabletop/common'
import { IMPERIAL_WARBANDS, type WarbandOwner } from '../model/warbandCounts.js'
import { testPlayer, testState } from '../testing/fixture.js'
import { expectOneWarbandOwnerPerSite, expectWarbandsConserved } from '../testing/census.js'
import { answerConsent, buildAction } from '../testing/actions.js'
import { ConsentRequestKind } from '../model/consent.js'

function move(playerId: string, m: WarbandMove, owner: WarbandOwner, count: number) {
    return new HydratedMoveWarbands(buildAction(MoveWarbands, { playerId, move: m, owner, count }))
}

const SITE_TO_BOARD: WarbandMove = { kind: WarbandMoveKind.SiteToBoard }
const BOARD_TO_SITE: WarbandMove = { kind: WarbandMoveKind.BoardToSite }

function exileAtOwnSite(overrides = {}) {
    return testState(
        [
            testPlayer({
                siteId: 'c1',
                warbandsOnBoard: { ['p1']: 2 },
                warbandsInPersonalBank: { ['p1']: 9 },
                ...overrides
            })
        ],
        { warbandsBySite: { c1: { ['p1']: 3 } } }
    )
}

describe('Move Warbands To/From Your Site (R-6.5)', () => {
    it('moves warbands off your site, leaving the last one behind', () => {
        const state = exileAtOwnSite()
        expectWarbandsConserved(state, () => {
            move('p1', SITE_TO_BOARD, 'p1', 2).apply(state)
        })

        expect(state.warbandsBySite['c1']).toEqual({ ['p1']: 1 })
        expect(state.getPlayerState('p1').warbandsOnBoard).toEqual({ ['p1']: 4 })
    })

    it('costs no Supply (R-6)', () => {
        const state = exileAtOwnSite({ supply: 6 })
        move('p1', SITE_TO_BOARD, 'p1', 1).apply(state)

        const p = state.getPlayerState('p1')
        expect(p.supply).toBe(6)
        expect(p.supplySpentThisTurn).toBe(0)
    })

    it('refuses to move the last warband off your site (R-10.21)', () => {
        const state = exileAtOwnSite()
        expect(() => move('p1', SITE_TO_BOARD, 'p1', 3).apply(state)).toThrow(
            /at most 2 \(the last one must stay to keep rule of the site\)/
        )
        expect(HydratedMoveWarbands.maxMovable(state, 'p1', SITE_TO_BOARD, 'p1')).toBe(2)
    })

    it('cannot move any warband off a site holding only one', () => {
        const state = exileAtOwnSite()
        state.warbandsBySite['c1'] = { ['p1']: 1 }
        expect(HydratedMoveWarbands.maxMovable(state, 'p1', SITE_TO_BOARD, 'p1')).toBe(0)
        expect(() => move('p1', SITE_TO_BOARD, 'p1', 1).apply(state)).toThrow(/at most 0/)
    })

    it('moves warbands onto a site you rule', () => {
        const state = exileAtOwnSite()
        expectWarbandsConserved(state, () => {
            move('p1', BOARD_TO_SITE, 'p1', 2).apply(state)
        })

        expect(state.warbandsBySite['c1']).toEqual({ ['p1']: 5 })
        expect(state.getPlayerState('p1').warbandsOnBoard).toEqual({ ['p1']: 0 })
        expectOneWarbandOwnerPerSite(state)
    })

    it('refuses to move warbands onto a site you do not rule — the move is one-directional', () => {
        const state = exileAtOwnSite()
        state.warbandsBySite['c1'] = {}
        expect(() => move('p1', BOARD_TO_SITE, 'p1', 1).apply(state)).toThrow(
            /you do not rule c1, so you cannot move warbands onto it/
        )
    })

    it('refuses warbands that are not yours, even when they sit in the right place (R-10.21)', () => {
        const state = exileAtOwnSite()
        state.getPlayerState('p1').warbandsOnBoard['p2'] = 3
        expect(() => move('p1', BOARD_TO_SITE, 'p2', 1).apply(state)).toThrow(
            /p2's warbands are not yours to move \(p1\)/
        )
    })

    it('lets an Imperial player move the Empire\u2019s warbands as well as their own (R-6.6.3)', () => {
        const state = exileAtOwnSite({ status: PlayerStatus.Citizen })
        state.getPlayerState('p1').warbandsOnBoard[IMPERIAL_WARBANDS] = 2
        state.warbandsBySite['c1'] = { [IMPERIAL_WARBANDS]: 2 }

        expect(
            HydratedMoveWarbands.reasonCannotMove(state, 'p1', {
                move: BOARD_TO_SITE,
                owner: IMPERIAL_WARBANDS,
                count: 1
            })
        ).toBeUndefined()
    })

    it('refuses a move of zero or fewer (R-9.5)', () => {
        const state = exileAtOwnSite()
        expect(() => move('p1', SITE_TO_BOARD, 'p1', 0).apply(state)).toThrow(
            /must move at least one warband/
        )
    })

    it('asks nobody when the move needs no permission', () => {
        const state = exileAtOwnSite()
        move('p1', SITE_TO_BOARD, 'p1', 1).apply(state)
        expect(state.pendingConsent).toBeUndefined()
        expect(state.warbandsBySite['c1']).toEqual({ ['p1']: 2 })
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
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 },
                warbandsInPersonalBank: { ['p1']: 14 },
                ...overrides
            }),
            testPlayer({
                playerId: 'chan',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c1',
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 },
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 19 }
            })
        ],
        {
            chancellorPlayerId: 'chan',
            warbandsBySite: { c1: { [IMPERIAL_WARBANDS]: 3 } }
        }
    )
}

describe('A Citizen needs the Chancellor’s permission (R-6.5.a)', () => {
    it('asks the Chancellor, and nothing moves until they answer', () => {
        const state = citizenAndChancellor()
        const request = move('cit', SITE_TO_BOARD, IMPERIAL_WARBANDS, 1)
        request.apply(state)
        expect(state.pendingConsent).toMatchObject({
            request: { kind: ConsentRequestKind.WarbandMove, count: 1 },
            askingPlayerId: 'cit',
            askedPlayerId: 'chan'
        })
        expect(request.metadata?.awaitingConsentOf).toBe('chan')
        expect(state.warbandsBySite['c1']).toEqual({ [IMPERIAL_WARBANDS]: 3 })
    })

    it('a consent the mover writes into their own action is never read', () => {
        const state = citizenAndChancellor()
        const sent = buildAction(MoveWarbands, { playerId: 'cit', move: SITE_TO_BOARD, owner: IMPERIAL_WARBANDS, count: 1 })
        const forged = { ...sent, consent: { playerId: 'chan', granted: true } }
        new HydratedMoveWarbands(forged).apply(state)
        expect(state.pendingConsent?.askedPlayerId).toBe('chan')
        expect(state.warbandsBySite['c1']).toEqual({ [IMPERIAL_WARBANDS]: 3 })
    })

    it('only the asked player answers', () => {
        const state = citizenAndChancellor()
        move('cit', SITE_TO_BOARD, IMPERIAL_WARBANDS, 1).apply(state)
        expect(() => answerConsent(state, 'cit', true)).toThrow(/made to chan, not to cit/)
    })

    it('a refusal moves nothing and closes the request (R-X.1)', () => {
        const state = citizenAndChancellor()
        move('cit', SITE_TO_BOARD, IMPERIAL_WARBANDS, 1).apply(state)
        answerConsent(state, 'chan', false)
        expect(state.pendingConsent).toBeUndefined()
        expect(state.warbandsBySite['c1']).toEqual({ [IMPERIAL_WARBANDS]: 3 })
    })

    it('the Chancellor’s permission carries the move out', () => {
        const state = citizenAndChancellor()
        expectWarbandsConserved(state, () => {
            move('cit', SITE_TO_BOARD, IMPERIAL_WARBANDS, 2).apply(state)
            answerConsent(state, 'chan', true)
        })
        expect(state.warbandsBySite['c1']).toEqual({ [IMPERIAL_WARBANDS]: 1 })
        expect(state.getPlayerState('cit').warbandsOnBoard).toEqual({ [IMPERIAL_WARBANDS]: 4 })
    })

    it('does NOT apply to the reverse direction', () => {
        const state = citizenAndChancellor()
        move('cit', BOARD_TO_SITE, IMPERIAL_WARBANDS, 2).apply(state)
        expect(state.pendingConsent).toBeUndefined()
        expect(state.warbandsBySite['c1']).toEqual({ [IMPERIAL_WARBANDS]: 5 })
    })

    it('does not apply to the Chancellor themselves', () => {
        const state = citizenAndChancellor()
        move('chan', SITE_TO_BOARD, IMPERIAL_WARBANDS, 1).apply(state)
        expect(state.pendingConsent).toBeUndefined()
        expect(state.getPlayerState('chan').warbandsOnBoard).toEqual({ [IMPERIAL_WARBANDS]: 4 })
    })
})

describe('Imperial give and take (R-6.5.b)', () => {
    const take: WarbandMove = { kind: WarbandMoveKind.TakeFromImperial, otherPlayerId: 'chan' }
    const giveToChan: WarbandMove = { kind: WarbandMoveKind.GiveToImperial, otherPlayerId: 'chan' }

    it('gives warbands to another Imperial player with their permission', () => {
        const state = citizenAndChancellor()
        expectWarbandsConserved(state, () => {
            move('cit', giveToChan, IMPERIAL_WARBANDS, 2).apply(state)
            answerConsent(state, 'chan', true)
        })
        expect(state.getPlayerState('cit').warbandsOnBoard).toEqual({ [IMPERIAL_WARBANDS]: 0 })
        expect(state.getPlayerState('chan').warbandsOnBoard).toEqual({ [IMPERIAL_WARBANDS]: 5 })
    })

    it('takes warbands from another Imperial player with their permission', () => {
        const state = citizenAndChancellor()
        move('cit', take, IMPERIAL_WARBANDS, 3).apply(state)
        answerConsent(state, 'chan', true)
        expect(state.getPlayerState('chan').warbandsOnBoard).toEqual({ [IMPERIAL_WARBANDS]: 0 })
        expect(state.getPlayerState('cit').warbandsOnBoard).toEqual({ [IMPERIAL_WARBANDS]: 5 })
    })

    it('asks the OTHER player, not the Chancellor qua Chancellor', () => {
        // R-6.5.b asks the other end of the transfer; only R-6.5.a asks the Chancellor.
        const state = citizenAndChancellor()
        move('cit', giveToChan, IMPERIAL_WARBANDS, 1).apply(state)
        expect(state.pendingConsent?.askedPlayerId).toBe('chan')
        expect(() => move('chan', take, IMPERIAL_WARBANDS, 1).apply(citizenAndChancellor())).toThrow(
            /cannot give warbands to or take them from yourself/
        )
    })

    it('asks in BOTH directions', () => {
        const state = citizenAndChancellor()
        move('cit', take, IMPERIAL_WARBANDS, 1).apply(state)
        expect(state.pendingConsent?.askedPlayerId).toBe('chan')
        expect(state.getPlayerState('chan').warbandsOnBoard).toEqual({ [IMPERIAL_WARBANDS]: 3 })
    })

    it('a permission the board no longer allows cannot be given, and refusing still closes the request', () => {
        const state = citizenAndChancellor()
        move('cit', take, IMPERIAL_WARBANDS, 3).apply(state)
        state.getPlayerState('chan').warbandsOnBoard = { [IMPERIAL_WARBANDS]: 1 }
        expect(() => answerConsent(state, 'chan', true)).toThrow(/at most 1/)
        answerConsent(state, 'chan', false)
        expect(state.pendingConsent).toBeUndefined()
    })

    it('refuses when the other player is not Imperial (R-10.12)', () => {
        const state = citizenAndChancellor()
        state.getPlayerState('chan').status = PlayerStatus.Exile
        state.chancellorPlayerId = undefined
        expect(() => move('cit', giveToChan, IMPERIAL_WARBANDS, 1).apply(state)).toThrow(
            /chan is not an Imperial player/
        )
    })

    it('refuses when the other pawn is not at your site', () => {
        const state = citizenAndChancellor()
        state.getPlayerState('chan').siteId = 'h1'
        expect(() => move('cit', giveToChan, IMPERIAL_WARBANDS, 1).apply(state)).toThrow(
            /chan's pawn is not at your site/
        )
    })
})

describe('what R-6.5 offers', () => {
    it('offers a move only where warbands could actually go', () => {
        const state = exileAtOwnSite()
        const moves = HydratedMoveWarbands.legalMoves(state, 'p1')
        expect(moves).toEqual([
            { move: SITE_TO_BOARD, owner: 'p1', max: 2 },
            { move: BOARD_TO_SITE, owner: 'p1', max: 2 }
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

describe('R-6.5 — "except the last one" is applied per owner, not per player', () => {
    it('a site holding two owners\u2019 warbands floors at one warband PER OWNER, leaving two behind', () => {
        // Reachable only through R-6.6.2's Imperial shortage; flooring per owner is stricter than R-6.5.
        const state = testState(
            [
                testPlayer({
                    playerId: 'cit',
                    color: Color.Blue,
                    status: PlayerStatus.Citizen,
                    siteId: 'c1'
                })
            ],
            { warbandsBySite: { c1: { [IMPERIAL_WARBANDS]: 3, ['cit']: 2 } } }
        )
        const move = { kind: WarbandMoveKind.SiteToBoard } as const
        expect(HydratedMoveWarbands.maxMovable(state, 'cit', move, IMPERIAL_WARBANDS)).toBe(2)
        expect(HydratedMoveWarbands.maxMovable(state, 'cit', move, 'cit')).toBe(1)
    })
})
