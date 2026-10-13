import { describe, expect, it } from 'vitest'
import {
    ConsentRequestKind,
    HydratedOathGameState,
    MachineState,
    WarbandMoveKind,
    type PendingConsent
} from '@tabletop/oath'
import { testPlayer, testState } from '@tabletop/oath/testing'
import { consentQuestion } from './consentRequests.js'
import { IMPERIAL_WARBANDS } from '@tabletop/oath'

const nameOf = (playerId: string) => ({ p1: 'Alice', p2: 'Bob', p3: 'Cleo' })[playerId] ?? playerId

function asked(request: PendingConsent['request'], askingPlayerId = 'p1'): PendingConsent {
    return { request, askingPlayerId, askedPlayerId: 'p2', resumeMachineState: MachineState.ActPhase }
}

function table(): HydratedOathGameState {
    return testState([testPlayer({ playerId: 'p1' }), testPlayer({ playerId: 'p2' }), testPlayer({ playerId: 'p3' })])
}

const seat = (playerId: string) => ({ kind: 'seat', playerId })
const text = (words: string) => ({ kind: 'text', text: words })

describe('what a consent request asks (R-6.5.a, R-6.5.b, R-5.5.2.a)', () => {
    it('a warband move is “Move warbands”: one line asking leave, the asker a seat and the warbands counted', () => {
        const state = table()
        const move = (kind: WarbandMoveKind.SiteToBoard | WarbandMoveKind.BoardToSite) => asked({ kind: ConsentRequestKind.WarbandMove, move: { kind }, owner: IMPERIAL_WARBANDS, count: 2 })
        expect(consentQuestion(state, move(WarbandMoveKind.SiteToBoard), nameOf)).toEqual({
            heading: 'Move warbands',
            parts: [text('Let '), seat('p1'), text(' move 2 Imperial warbands off their site?')]
        })
        expect(consentQuestion(state, move(WarbandMoveKind.BoardToSite), nameOf)?.parts).toEqual([
            text('Let '),
            seat('p1'),
            text(' move 2 Imperial warbands onto their site?')
        ])
        const take = asked({ kind: ConsentRequestKind.WarbandMove, move: { kind: WarbandMoveKind.TakeFromImperial, otherPlayerId: 'p2' }, owner: IMPERIAL_WARBANDS, count: 1 })
        expect(consentQuestion(state, take, nameOf)?.parts).toEqual([text('Let '), seat('p1'), text(' take 1 Imperial warband from your board?')])
        const give = asked({ kind: ConsentRequestKind.WarbandMove, move: { kind: WarbandMoveKind.GiveToImperial, otherPlayerId: 'p2' }, owner: IMPERIAL_WARBANDS, count: 3 })
        expect(consentQuestion(state, give, nameOf)?.parts).toEqual([text('Let '), seat('p1'), text(' give you 3 Imperial warbands?')])
    })

    it('asks a Citizen whether to join the defender’s defence, under “Campaign”', () => {
        const state = table()
        state.pendingCampaign = {
            declaration: { attackerPlayerId: 'p1', defenderPlayerId: 'p3', targets: [], attackDice: 1, forceSiteIds: [], allyPlayerIds: [] },
            toAsk: ['p2']
        }
        const join = asked({ kind: ConsentRequestKind.JoinDefence, citizenPlayerId: 'p2' })
        expect(consentQuestion(state, join, nameOf)).toEqual({
            heading: 'Campaign',
            parts: [text('Join '), seat('p3'), text('’s defence?')]
        })
    })

    it('asks the defender to let the Citizen who asked join, under “Campaign”', () => {
        const admit = asked({ kind: ConsentRequestKind.AdmitAlly, citizenPlayerId: 'p3' }, 'p3')
        expect(consentQuestion(table(), admit, nameOf)).toEqual({
            heading: 'Campaign',
            parts: [text('Let '), seat('p3'), text(' join your defence?')]
        })
    })

    it('leaves a Citizenship offer to the answer’s own panel', () => {
        const offer = asked({ kind: ConsentRequestKind.CitizenshipOffer, exilePlayerId: 'p2', reliquarySlotId: 'reliquary.0' })
        expect(consentQuestion(table(), offer, nameOf)).toBeUndefined()
    })
})
