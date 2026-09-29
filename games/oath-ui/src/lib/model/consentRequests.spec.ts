import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import {
    ConsentRequestKind,
    HydratedOathGameState,
    MachineState,
    WarbandMoveKind,
    type PendingConsent
} from '@tabletop/oath'
import { testPlayer, testState } from '@tabletop/oath/testing'
import { consentQuestion } from './consentRequests.js'

const nameOf = (playerId: string) => ({ p1: 'Alice', p2: 'Bob', p3: 'Cleo' })[playerId] ?? playerId

function asked(request: PendingConsent['request'], askingPlayerId = 'p1'): PendingConsent {
    return { request, askingPlayerId, askedPlayerId: 'p2', resumeMachineState: MachineState.ActPhase }
}

function table(): HydratedOathGameState {
    return testState([testPlayer({ playerId: 'p1' }), testPlayer({ playerId: 'p2' }), testPlayer({ playerId: 'p3' })])
}

describe('what a consent request asks (R-6.5.a, R-6.5.b, R-5.5.2.a)', () => {
    it('names the asker, the count, the colour and the direction of a warband move', () => {
        const state = table()
        const move = (kind: WarbandMoveKind.SiteToBoard | WarbandMoveKind.BoardToSite) => asked({ kind: ConsentRequestKind.WarbandMove, move: { kind }, color: Color.Purple, count: 2 })
        expect(consentQuestion(state, move(WarbandMoveKind.SiteToBoard), nameOf)).toBe('Alice asks your permission, as Chancellor, to move 2 purple warbands off their site to their board.')
        const take = asked({ kind: ConsentRequestKind.WarbandMove, move: { kind: WarbandMoveKind.TakeFromImperial, otherPlayerId: 'p2' }, color: Color.Purple, count: 1 })
        expect(consentQuestion(state, take, nameOf)).toBe('Alice asks your permission to take 1 purple warband from your board.')
        const give = asked({ kind: ConsentRequestKind.WarbandMove, move: { kind: WarbandMoveKind.GiveToImperial, otherPlayerId: 'p2' }, color: Color.Purple, count: 3 })
        expect(consentQuestion(state, give, nameOf)).toBe('Alice asks your permission to give you 3 purple warbands.')
    })

    it('asks a Citizen whether to join, naming the defender of the held Campaign', () => {
        const state = table()
        state.pendingCampaign = {
            declaration: { attackerPlayerId: 'p1', defenderPlayerId: 'p3', targets: [], attackDice: 1, forceSiteIds: [], allyPlayerIds: [] },
            toAsk: ['p2']
        }
        const join = asked({ kind: ConsentRequestKind.JoinDefence, citizenPlayerId: 'p2' })
        expect(consentQuestion(state, join, nameOf)).toBe('Alice is campaigning against Cleo. Your pawn is in the battle: join the defence as an Ally?')
    })

    it('asks the defender to admit the Citizen who asked to join', () => {
        const admit = asked({ kind: ConsentRequestKind.AdmitAlly, citizenPlayerId: 'p3' }, 'p3')
        expect(consentQuestion(table(), admit, nameOf)).toBe('Cleo asks to join your defence as an Ally.')
    })
})
