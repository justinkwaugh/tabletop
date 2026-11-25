import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushSync } from 'svelte'
import { PlayerVoteKind, type GameAction, type UndoVote } from '@tabletop/common'
import { step } from '@tabletop/common/test-fixtures/note-game'
import { HarnessGameService } from '../harness/harnessGameService.svelte.js'
import { NoteHost, hostedSession } from './tests/noteHost.fixture.js'
import { settle } from './tests/privateHandSession.fixture.js'

afterEach(() => vi.restoreAllMocks())

const ids = (actions: readonly GameAction[]) => actions.map((action) => action.id)

function openUndoVote() {
    const held = $state<{ vote: UndoVote | undefined }>({
        vote: {
            id: 'v',
            kind: PlayerVoteKind.Undo,
            initiatorPlayerId: 'p1',
            targetActionId: 's1',
            targetActionIndex: 0,
            approvingPlayerIds: ['p1']
        }
    })
    vi.spyOn(HarnessGameService.prototype, 'getPlayerVote').mockImplementation(() => held.vote)
    return held
}

describe('A hosted Player an undo vote is waiting on', () => {
    it('cannot act until they answer', async () => {
        const host = new NoteHost()
        const gameId = host.game.id
        host.apply(step('s1', gameId, 'p1'))
        host.apply(step('s2', gameId, 'p2'))
        const held = openUndoVote()
        const { session, dispose } = hostedSession(host, { playerId: 'p3' })
        try {
            await settle(session)
            expect(session.heldUpByUndoVote).toBe(true)

            await session.applyAction(step('s3', gameId, 'p3'))
            await settle(session)
            expect(ids(host.actions)).toEqual(['s1', 's2'])

            held.vote = held.vote && { ...held.vote, approvingPlayerIds: ['p1', 'p3'] }
            flushSync()
            expect(session.heldUpByUndoVote).toBe(false)
            await session.applyAction(step('s3', gameId, 'p3'))
            await settle(session)
            expect(ids(host.actions)).toEqual(['s1', 's2', 's3'])
        } finally {
            dispose()
        }
    })

    it('does not hold up an Administrator acting for them', async () => {
        const host = new NoteHost()
        const gameId = host.game.id
        host.apply(step('s1', gameId, 'p1'))
        host.apply(step('s2', gameId, 'p2'))
        openUndoVote()
        const { session, dispose } = hostedSession(host, 'admin')
        try {
            await settle(session)
            expect(session.myPlayer?.id).toBe('p3')
            expect(session.heldUpByUndoVote).toBe(false)
        } finally {
            dispose()
        }
    })
})
