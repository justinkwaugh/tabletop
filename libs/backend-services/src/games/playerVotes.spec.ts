import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    GameCallKind,
    GameEngine,
    GameResult,
    GameStatus,
    PlayerVoteKind,
    UserNotificationAction,
    type Notification
} from '@tabletop/common'
import { SyntheticDefinition as Definition } from './tests/syntheticGame.js'
import { createSyntheticHost, syntheticUser } from './tests/syntheticHost.js'
import {
    DisallowedPlayerVoteError,
    DisallowedUndoError,
    GameUpdateCollisionError
} from './errors.js'

afterEach(() => vi.restoreAllMocks())

function createHost(playerIds?: string[]) {
    const host = createSyntheticHost({ playerIds })
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

describe('Call votes', () => {
    function createCallHost(playerIds?: string[]) {
        const host = createHost(playerIds)
        const call = (
            declaredWinnerId: string | undefined,
            by: string,
            publishedUiSupportsCalls = true
        ) =>
            host.service.requestCall({
                definition: Definition,
                gameId: host.game.id,
                declaredWinnerId,
                publishedUiSupportsCalls,
                user: syntheticUser(by)
            })
        return { ...host, call }
    }

    it('ends the game once a strict majority agrees, with the declared winner', async () => {
        const host = createCallHost()
        await host.apply(host.step('s1', 'p1'))
        await host.call('p2', 'p1')
        expect(host.game.vote).toMatchObject({
            kind: PlayerVoteKind.Call,
            declaredWinnerId: 'p2',
            approvingPlayerIds: ['p1']
        })
        expect(host.state().result).toBeUndefined()

        await host.vote(true, 'p3')
        expect(host.game.vote).toBeUndefined()
        expect(host.game.call).toEqual({
            kind: GameCallKind.Called,
            initiatorPlayerId: 'p1',
            declaredWinnerId: 'p2',
            approvingPlayerIds: ['p1', 'p3'],
            decliningPlayerIds: []
        })
        expect(host.game.status).toBe(GameStatus.Finished)
        expect(host.state()).toMatchObject({
            result: GameResult.Win,
            winningPlayerIds: ['p2'],
            activePlayerIds: []
        })
        expect(host.summary()).toEqual(['0:s1', expect.stringMatching(/^1:/)])
    })

    it('abandons the game when nobody is declared the winner', async () => {
        const host = createCallHost()
        await host.call(undefined, 'p1')
        await host.vote(true, 'p2')
        expect(host.state()).toMatchObject({ result: GameResult.Abandoned, winningPlayerIds: [] })
    })

    it('fails once a majority is out of reach and play goes on', async () => {
        const host = createCallHost()
        await host.call(undefined, 'p1')
        await host.vote(false, 'p2')
        expect(
            host.game.vote?.kind === PlayerVoteKind.Call && host.game.vote.decliningPlayerIds
        ).toEqual(['p2'])
        await host.vote(false, 'p3')
        expect(host.game.vote).toBeUndefined()
        expect(host.state().result).toBeUndefined()
        await host.apply(host.step('s1', 'p1'))
    })

    it('concedes at once in a two-player game and makes the opponent the winner', async () => {
        const host = createCallHost(['p1', 'p2'])
        await expect(host.call(undefined, 'p1')).rejects.toBeInstanceOf(DisallowedPlayerVoteError)
        await expect(host.call('p1', 'p1')).rejects.toBeInstanceOf(DisallowedPlayerVoteError)

        await host.call('p2', 'p1')
        expect(host.game.vote).toBeUndefined()
        expect(host.game.call?.kind).toBe(GameCallKind.Conceded)
        expect(host.state()).toMatchObject({ result: GameResult.Win, winningPlayerIds: ['p2'] })
        expect(host.sentUserNotifications()).toEqual([])
    })

    it('refuses calls before the published UI supports them', async () => {
        const host = createCallHost()
        await expect(host.call(undefined, 'p1', false)).rejects.toBeInstanceOf(
            DisallowedPlayerVoteError
        )
    })

    it('refuses a winner who is not a player and calls once the game is over', async () => {
        const host = createCallHost()
        await expect(host.call('stranger', 'p1')).rejects.toBeInstanceOf(DisallowedPlayerVoteError)
        await host.call(undefined, 'p1')
        await host.vote(true, 'p2')
        await expect(host.call(undefined, 'p3')).rejects.toBeInstanceOf(DisallowedPlayerVoteError)
    })

    it('refuses an approval from a player who declined', async () => {
        const host = createCallHost()
        await host.call(undefined, 'p1')
        await host.vote(false, 'p2')
        await expect(host.vote(true, 'p2')).rejects.toBeInstanceOf(DisallowedPlayerVoteError)
        expect(host.game.vote).toMatchObject({
            approvingPlayerIds: ['p1'],
            decliningPlayerIds: ['p2']
        })
    })

    it('refuses a passed call once the game has ended by its rules', async () => {
        const host = createCallHost()
        await host.call(undefined, 'p1')
        const find = vi.mocked(host.store.findGameById)
        const current = find.getMockImplementation()
        find.mockImplementation(async (id, withState) => {
            const found = await current?.(id, withState)
            return found && withState ? { ...found, status: GameStatus.Finished } : found
        })
        await expect(host.vote(true, 'p2')).rejects.toBeInstanceOf(DisallowedPlayerVoteError)
        expect(host.game.vote).toBeUndefined()
    })

    it('closes a passed call that cannot be appended', async () => {
        const host = createCallHost()
        await host.call(undefined, 'p1')
        vi.mocked(host.store.addActionsToGame).mockImplementation(async () => {
            throw new GameUpdateCollisionError({ id: host.game.id })
        })
        await expect(host.vote(true, 'p2')).rejects.toThrow()
        expect(host.game.vote).toBeUndefined()
        expect(host.state().result).toBeUndefined()
    })

    it('stops players undoing a called game', async () => {
        const host = createCallHost()
        await host.apply(host.step('s1', 'p1'))
        await host.call(undefined, 'p1')
        await host.vote(true, 'p2')
        await expect(host.undo('s1', 'p1')).rejects.toBeInstanceOf(DisallowedUndoError)
        await expect(host.preview(0, 'p1')).rejects.toBeInstanceOf(DisallowedPlayerVoteError)
    })

    it('closes an open call when the game ends by its rules', async () => {
        const host = createCallHost()
        await host.call(undefined, 'p1')
        const execute = GameEngine.prototype.executeCanonicalAction
        vi.spyOn(GameEngine.prototype, 'executeCanonicalAction').mockImplementationOnce(function (
            this: GameEngine,
            input
        ) {
            const executed = execute.call(this, input)
            executed.updatedState.result = GameResult.Abandoned
            return executed
        })
        await host.apply(host.step('s1', 'p1'))
        expect(host.game.vote).toBeUndefined()
    })

    it('retries the call when another action lands at the same moment', async () => {
        const host = createCallHost()
        await host.call(undefined, 'p1')

        const add = vi.mocked(host.store.addActionsToGame)
        const stored = add.getMockImplementation()
        add.mockImplementationOnce(async () => {
            throw new GameUpdateCollisionError({ id: host.game.id })
        })
        if (stored) add.mockImplementation(stored)
        await host.vote(true, 'p2')
        expect(host.state().result).toBe(GameResult.Abandoned)
    })
})
