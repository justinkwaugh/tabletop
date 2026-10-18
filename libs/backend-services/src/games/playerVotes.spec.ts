import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserNotificationAction, type Notification } from '@tabletop/common'
import { SyntheticDefinition as Definition } from './tests/syntheticGame.js'
import { createSyntheticHost, syntheticUser } from './tests/syntheticHost.js'
import { DisallowedPlayerVoteError, GameUpdateCollisionError } from './errors.js'

afterEach(() => vi.restoreAllMocks())

function createHost() {
    const host = createSyntheticHost()
    const preview = (actionIndex: number, by: string) =>
        host.service.previewUndoVote({
            definition: Definition,
            gameId: host.game.id,
            actionIndex,
            user: syntheticUser(by)
        })
    const request = async (actionIndex: number, by: string) => {
        const { targetActionId } = await preview(actionIndex, by)
        return host.service.openUndoVote({
            definition: Definition,
            gameId: host.game.id,
            actionIndex,
            targetActionId,
            user: syntheticUser(by)
        })
    }
    const vote = (approve: boolean, by: string) => {
        const target = {
            gameId: host.game.id,
            voteId: host.game.vote?.id ?? 'none',
            user: syntheticUser(by)
        }
        return approve
            ? host.service.approveVote({ definition: Definition, ...target })
            : host.service.declineVote(target)
    }
    const withdraw = (by: string) =>
        host.service.withdrawVote({
            gameId: host.game.id,
            voteId: host.game.vote?.id ?? 'none',
            user: syntheticUser(by)
        })
    const sentUserNotifications = () =>
        vi
            .mocked(host.notifications.sendNotification)
            .mock.calls.map(([{ notification }]) => notification)
            .filter((notification: Notification) => notification.type === 'user')
    return { ...host, preview, request, vote, withdraw, sentUserNotifications }
}

describe('Undo votes', () => {
    it('previews what going back would undo', async () => {
        const host = createHost()
        await host.apply(host.step('s1', 'p1'))
        await host.apply(host.step('s2', 'p2'))

        expect(await host.preview(0, 'p1')).toEqual({
            targetActionId: 's1',
            targetActionIndex: 0,
            affectedPlayerIds: ['p1', 'p2'],
            ownUndoReaches: false
        })
        expect((await host.preview(1, 'p2')).ownUndoReaches).toBe(true)
    })

    it('undoes once every player agrees and closes the vote', async () => {
        const host = createHost()
        await host.apply(host.step('s1', 'p1'))
        await host.apply(host.step('s2', 'p2'))

        await host.request(0, 'p1')
        expect(host.game.vote).toMatchObject({
            initiatorPlayerId: 'p1',
            targetActionId: 's1',
            approvingPlayerIds: ['p1']
        })
        expect(host.sentUserNotifications()).toEqual([
            expect.objectContaining({
                action: UserNotificationAction.PlayerVoteRequested,
                data: expect.objectContaining({ user: { id: 'p2' } })
            }),
            expect.objectContaining({
                action: UserNotificationAction.PlayerVoteRequested,
                data: expect.objectContaining({ user: { id: 'p3' } })
            })
        ])

        await host.vote(true, 'p2')
        expect(host.summary()).toEqual(['0:s1', '1:s2'])
        expect(host.game.vote?.approvingPlayerIds).toEqual(['p1', 'p2'])

        await host.vote(true, 'p3')
        expect(host.summary()).toEqual([])
        expect(host.game.vote).toBeUndefined()
        expect(host.state().activePlayerIds).toEqual(['p1'])
    })

    it('keeps play going while the vote is open and undoes the later moves too', async () => {
        const host = createHost()
        await host.apply(host.step('s1', 'p1'))
        await host.apply(host.step('s2', 'p2'))
        await host.request(1, 'p1')
        await host.apply(host.step('s3', 'p3'))

        await host.vote(true, 'p2')
        await host.vote(true, 'p3')
        expect(host.summary()).toEqual(['0:s1'])
        expect(host.state().activePlayerIds).toEqual(['p2'])
    })

    it('goes back across an action that revealed information', async () => {
        const host = createHost()
        await host.apply(host.step('s1', 'p1'))
        await host.apply(host.draw('d1', 'p2'))
        expect((await host.preview(1, 'p2')).ownUndoReaches).toBe(false)

        await host.request(1, 'p1')
        await host.vote(true, 'p2')
        await host.vote(true, 'p3')
        expect(host.summary()).toEqual(['0:s1'])
    })

    it('closes the vote when any player declines', async () => {
        const host = createHost()
        await host.apply(host.step('s1', 'p1'))
        await host.apply(host.step('s2', 'p2'))
        await host.request(0, 'p1')

        await host.vote(false, 'p3')
        expect(host.game.vote).toBeUndefined()
        expect(host.summary()).toEqual(['0:s1', '1:s2'])
    })

    it('lets only the player who asked withdraw the vote', async () => {
        const host = createHost()
        await host.apply(host.step('s1', 'p1'))
        await host.apply(host.step('s2', 'p2'))
        await host.request(0, 'p1')

        await expect(host.withdraw('p2')).rejects.toBeInstanceOf(DisallowedPlayerVoteError)
        await host.withdraw('p1')
        expect(host.game.vote).toBeUndefined()
    })

    it('refuses a vote the player could undo alone, or while another is open', async () => {
        const host = createHost()
        await host.apply(host.step('s1', 'p1'))
        await expect(host.request(0, 'p1')).rejects.toBeInstanceOf(DisallowedPlayerVoteError)

        await host.apply(host.step('s2', 'p2'))
        await host.request(0, 'p1')
        await expect(host.request(1, 'p3')).rejects.toBeInstanceOf(DisallowedPlayerVoteError)
    })

    it('refuses a request whose target is no longer at that position', async () => {
        const host = createHost()
        await host.apply(host.step('s1', 'p1'))
        await host.apply(host.step('s2', 'p2'))
        await expect(
            host.service.openUndoVote({
                definition: Definition,
                gameId: host.game.id,
                actionIndex: 0,
                targetActionId: 's2',
                user: syntheticUser('p1')
            })
        ).rejects.toBeInstanceOf(DisallowedPlayerVoteError)
    })

    it('closes the vote when its target is undone another way', async () => {
        const host = createHost()
        await host.apply(host.step('s1', 'p1'))
        await host.apply(host.step('s2', 'p2'))
        await host.request(1, 'p1')

        await host.undo('s2', 'p2')
        expect(host.game.vote).toBeUndefined()
    })

    it('refuses votes in hotseat and tournament games', async () => {
        const host = createHost()
        await host.apply(host.step('s1', 'p1'))
        await host.apply(host.step('s2', 'p2'))

        host.game.hotseat = true
        await expect(host.preview(0, 'p1')).rejects.toBeInstanceOf(DisallowedPlayerVoteError)
        host.game.hotseat = false
        host.game.tournament = {
            tournamentId: 't',
            stageId: 's',
            tableId: 'x',
            scheduleId: 'y'
        }
        await expect(host.preview(0, 'p1')).rejects.toBeInstanceOf(DisallowedPlayerVoteError)
    })

    it('retries the undo when another action lands at the same moment', async () => {
        const host = createHost()
        await host.apply(host.step('s1', 'p1'))
        await host.apply(host.step('s2', 'p2'))
        await host.request(0, 'p1')
        await host.vote(true, 'p2')

        const undo = vi.mocked(host.store.undoActionsFromGame)
        const stored = undo.getMockImplementation()
        undo.mockImplementationOnce(async () => {
            throw new GameUpdateCollisionError({ id: host.game.id })
        })
        if (stored) undo.mockImplementation(stored)
        await host.vote(true, 'p3')
        expect(host.summary()).toEqual([])
        expect(host.game.vote).toBeUndefined()
    })

    it('needs only the players with accounts to agree', async () => {
        const host = createHost()
        delete host.game.players[2].userId
        await host.apply(host.step('s1', 'p1'))
        await host.apply(host.step('s2', 'p2'))
        await host.request(0, 'p1')

        await host.vote(true, 'p2')
        expect(host.summary()).toEqual([])
    })
})
