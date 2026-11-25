import { describe, expect, it } from 'vitest'
import { type GameAction } from '@tabletop/common'
import { note, step } from '@tabletop/common/test-fixtures/note-game'
import { NoteHost, hostedSession } from './tests/noteHost.fixture.js'
import { settle } from './tests/privateHandSession.fixture.js'

const ids = (actions: readonly GameAction[]) => actions.map((action) => action.id)

describe('A hosted Player replacing a standing declaration', () => {
    it('ends with the host’s history when other Actions followed the declaration', async () => {
        const host = new NoteHost()
        const gameId = host.game.id
        host.apply(step('s1', gameId, 'p1'))
        host.apply(note('n1', gameId, 'p3', 'first'))
        host.apply(step('s2', gameId, 'p2'))
        const { session, dispose } = hostedSession(host, { playerId: 'p3' })
        try {
            await settle(session)
            expect(session.busy).toBe(false)
            const replacement = session.withSupersededAction(note('n2', gameId, 'p3', 'second'))
            expect(replacement.supersedesActionId).toBe('n1')

            await session.applyAction(replacement)
            await settle(session)

            expect(ids(host.actions)).toEqual(['s1', 's2', 'n2'])
            expect(ids(session.actions)).toEqual(ids(host.actions))
            const state = session.gameState
            expect(state.steps).toEqual(['p1', 'p2'])
            expect(state.notes).toEqual({ p3: 'second' })
            expect(state.actionChecksum).toBe(host.state.actionChecksum)
        } finally {
            dispose()
        }
    })

    it('ends with the host’s history when an Administrator acts for the Player', async () => {
        const host = new NoteHost()
        const gameId = host.game.id
        host.apply(step('s1', gameId, 'p1'))
        host.apply(note('n1', gameId, 'p3', 'first'))
        host.apply(step('s2', gameId, 'p2'))
        const { session, dispose } = hostedSession(host, 'admin')
        try {
            await settle(session)
            expect(session.myPlayer?.id).toBe('p3')
            await session.applyAction(
                session.withSupersededAction(note('n2', gameId, 'p3', 'second'))
            )
            await settle(session)

            expect(ids(host.actions)).toEqual(['s1', 's2', 'n2'])
            expect(ids(session.actions)).toEqual(ids(host.actions))
            expect(session.gameState.notes).toEqual({ p3: 'second' })
            expect(session.gameState.actionChecksum).toBe(host.state.actionChecksum)
        } finally {
            dispose()
        }
    })

    it('ends with the host’s history when it replaces the last Action', async () => {
        const host = new NoteHost()
        const gameId = host.game.id
        host.apply(step('s1', gameId, 'p1'))
        host.apply(note('n1', gameId, 'p3', 'first'))
        const { session, dispose } = hostedSession(host, { playerId: 'p3' })
        try {
            await settle(session)
            await session.applyAction(
                session.withSupersededAction(note('n2', gameId, 'p3', 'second'))
            )
            await settle(session)

            expect(ids(host.actions)).toEqual(['s1', 'n2'])
            expect(ids(session.actions)).toEqual(ids(host.actions))
            expect(session.gameState.notes).toEqual({ p3: 'second' })
            expect(session.gameState.actionChecksum).toBe(host.state.actionChecksum)
        } finally {
            dispose()
        }
    })

    it('ends with the host’s history when the declaration is older than a sync check reaches', async () => {
        const host = new NoteHost()
        const gameId = host.game.id
        host.apply(note('n1', gameId, 'p3', 'first'))
        for (let turn = 0; turn < 14; turn++)
            host.apply(step(`s${turn}`, gameId, host.state.activePlayerIds[0]))
        const { session, dispose } = hostedSession(host, { playerId: 'p3' })
        try {
            await settle(session)
            await session.applyAction(
                session.withSupersededAction(note('n2', gameId, 'p3', 'second'))
            )
            await settle(session)

            expect(ids(host.actions).slice(0, 2)).toEqual(['s0', 's1'])
            expect(ids(session.actions)).toEqual(ids(host.actions))
            expect(session.gameState.notes).toEqual({ p3: 'second' })
            expect(session.gameState.actionChecksum).toBe(host.state.actionChecksum)
        } finally {
            dispose()
        }
    })
})
