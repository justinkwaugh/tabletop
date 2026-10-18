import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSyntheticHost as createHost, syntheticUser as user } from './tests/syntheticHost.js'
import {
    DEFERRED_TURN_REMINDER_INDEX,
    FIRST_TURN_REMINDER_INDEX,
    TurnReminderTask
} from './turnReminders.js'
import * as Value from 'typebox/value'
import { DisallowedActionError, DisallowedUndoError, RacedActionError } from './errors.js'
import { RedisCacheService } from '../cache/cacheService.js'
import { UserService } from '../users/userService.js'

afterEach(() => vi.restoreAllMocks())

describe('Out-of-turn Actions on the host', () => {
    it('accepts a declaration from a waiting Player and replaces the one it names', async () => {
        const host = createHost()
        await host.apply(host.step('s1', 'p1'))
        expect(host.state().activePlayerIds).toEqual(['p2'])
        await host.apply(host.note('n1', 'p3', 'first'))
        expect(host.summary()).toEqual(['0:s1', '1:n1'])
        expect(host.state().activePlayerIds).toEqual(['p2'])

        const undo = vi.mocked(host.store.undoActionsFromGame)
        await expect(host.apply(host.note('dup', 'p3', 'unnamed', 2))).rejects.toBeInstanceOf(
            DisallowedActionError
        )
        await expect(host.apply(host.note('stale', 'p3', 'stale', 2, 's1'))).rejects.toBeInstanceOf(
            DisallowedActionError
        )
        expect(undo).not.toHaveBeenCalled()
        const replaced = await host.apply(host.note('n2', 'p3', 'second', 2, 'n1'))
        expect(undo).toHaveBeenCalledTimes(1)
        expect(host.summary()).toEqual(['0:s1', '1:n2'])
        expect(replaced.actions.map((action) => action.index)).toEqual([1])
        expect(Reflect.get(host.state(), 'notes')).toEqual({ p3: 'second' })
        expect(host.state().actionCount).toBe(2)
    })

    it('keeps the declaration when the replacement would be invalid without it', async () => {
        const host = createHost()
        await host.apply(host.step('s1', 'p1'))
        await host.apply(host.note('n1', 'p3', 'first'))
        await expect(host.apply(host.note('n2', 'p3', 'invalid', 2, 'n1'))).rejects.toBeInstanceOf(
            DisallowedActionError
        )
        expect(vi.mocked(host.store.undoActionsFromGame)).not.toHaveBeenCalled()
        expect(host.summary()).toEqual(['0:s1', '1:n1'])
        expect(Reflect.get(host.state(), 'notes')).toEqual({ p3: 'first' })
    })

    it('replaces a declaration farther back when the Actions after it did not depend on it', async () => {
        const host = createHost()
        await host.apply(host.step('s1', 'p1'))
        await host.apply(host.note('n1', 'p3', 'first'))
        await host.apply(host.step('s2', 'p2'))
        expect(host.summary()).toEqual(['0:s1', '1:n1', '2:s2'])
        await host.apply(host.note('n2', 'p3', 'second', 3, 'n1'))
        expect(vi.mocked(host.store.undoActionsFromGame)).toHaveBeenCalledTimes(1)
        expect(host.summary()).toEqual(['0:s1', '1:s2', '2:n2'])
        expect(Reflect.get(host.state(), 'notes')).toEqual({ p3: 'second' })
        expect(host.state().activePlayerIds).toEqual(['p3'])
    })

    it('appends an unnamed declaration once another Action follows the standing one', async () => {
        const host = createHost()
        await host.apply(host.step('s1', 'p1'))
        await host.apply(host.note('n1', 'p3', 'first'))
        await host.apply(host.step('s2', 'p2'))
        await host.apply(host.note('n2', 'p3', 'second', 1))
        expect(vi.mocked(host.store.undoActionsFromGame)).not.toHaveBeenCalled()
        expect(host.summary()).toEqual(['0:s1', '1:n1', '2:s2', '3:n2'])
    })

    it('does not let a declaration block another Player’s Undo and re-applies it afterwards', async () => {
        const host = createHost()
        await host.apply(host.step('s1', 'p1'))
        await host.apply(host.step('s2', 'p2'))
        await host.apply(host.note('n1', 'p1', 'standing'))
        expect(host.summary()).toEqual(['0:s1', '1:s2', '2:n1'])

        await host.undo('s2', 'p2')
        expect(host.summary()).toEqual(['0:s1', '1:n1'])
        expect(host.state().activePlayerIds).toEqual(['p2'])
        expect(Reflect.get(host.state(), 'notes')).toEqual({ p1: 'standing' })

        await expect(host.undo('s1', 'p2')).rejects.toBeInstanceOf(DisallowedUndoError)
    })
})

describe('Sequenced Out-of-Turn Actions on the host', () => {
    it('records a commuting race after the Action it raced and reports that Action', async () => {
        const host = createHost()
        await host.apply(host.step('s1', 'p1'))
        const result = await host.apply(host.tally('t1', 'p3', 0))
        expect(host.summary()).toEqual(['0:s1', '1:t1'])
        expect(result.actions.map((action) => action.index)).toEqual([1])
        expect(result.missingActions?.map((action) => action.id)).toEqual(['s1'])
        expect(Reflect.get(host.state(), 'tallies')).toEqual({ p3: 1 })
        expect(host.state().activePlayerIds).toEqual(['p2'])
    })

    it('records a turn-taking Action that raced a sequenced one', async () => {
        const host = createHost()
        await host.apply(host.tally('t1', 'p3'))
        const late = host.step('s1', 'p1')
        late.index = 0
        await host.apply(late)
        expect(host.summary()).toEqual(['0:t1', '1:s1'])
    })

    it('rejects a race whose outcome depends on the order', async () => {
        const host = createHost()
        await host.apply(host.step('s1', 'p1'))
        await expect(host.apply(host.tally('t1', 'p3', 0, { board: true }))).rejects.toBeInstanceOf(
            RacedActionError
        )
        expect(host.summary()).toEqual(['0:s1'])
    })

    it('keeps rejecting stale turn-taking races that involve no sequenced Action', async () => {
        const host = createHost()
        await host.apply(host.step('s1', 'p1'))
        const late = host.step('s2', 'p2')
        late.index = 0
        await expect(host.apply(late)).rejects.toThrow('Action index is not valid')
        expect(host.summary()).toEqual(['0:s1'])
    })

    it('blocks another Player’s Undo and is undone only by its own Player', async () => {
        const host = createHost()
        await host.apply(host.step('s1', 'p1'))
        await host.apply(host.tally('t1', 'p3'))
        await expect(host.undo('s1', 'p1')).rejects.toBeInstanceOf(DisallowedUndoError)
        await expect(host.undo('t1', 'p1')).rejects.toBeInstanceOf(DisallowedUndoError)
        await host.undo('t1', 'p3')
        expect(host.summary()).toEqual(['0:s1'])
        expect(Reflect.get(host.state(), 'tallies')).toBeUndefined()
    })
})

describe('Turn reminders after an Action', () => {
    function remindedHost(options?: { activeSeats?: number }) {
        const host = createHost(options)
        const cached = new Map<string, unknown>()
        vi.spyOn(UserService.prototype, 'getUser').mockImplementation(async (id) => user(id))
        vi.spyOn(RedisCacheService.prototype, 'set').mockImplementation(async (key, value) => {
            cached.set(key, value)
        })
        vi.mocked(host.tasks.createPushTask).mockResolvedValue()
        const reminders = () =>
            vi
                .mocked(host.tasks.createPushTask)
                .mock.calls.map(([{ payload }]) => payload)
                .filter((payload) => Value.Check(TurnReminderTask, payload))
        const reminderTimings = () =>
            reminders().map(({ userId, reminderIndex, delay }) => ({
                userId,
                reminderIndex,
                delay
            }))
        const chainFor = (userId: string) => cached.get(`turn-notification-${userId}-standing`)
        return { ...host, reminders, reminderTimings, chainFor }
    }

    it('reminds the next Player a minute after the turn passes to them', async () => {
        const host = remindedHost()
        await host.apply(host.step('s1', 'p1'))
        expect(host.reminderTimings()).toEqual([
            { userId: 'p2', reminderIndex: FIRST_TURN_REMINDER_INDEX, delay: 60 }
        ])
    })

    it('reminds a Player four hours after an Action that leaves them active', async () => {
        const host = remindedHost()
        await host.apply(host.tally('t1', 'p1'))
        expect(host.state().activePlayerIds).toEqual(['p1'])
        expect(host.reminderTimings()).toEqual([
            { userId: 'p1', reminderIndex: DEFERRED_TURN_REMINDER_INDEX, delay: 4 * 60 * 60 }
        ])
    })

    it('replaces the earlier chain of a Player who acts and keeps the turn', async () => {
        const host = remindedHost()
        await host.apply(host.tally('t1', 'p1'))
        await host.apply(host.tally('t2', 'p1'))
        const [first, second] = host.reminders()
        expect(first.notificationId).not.toBe(second.notificationId)
        expect(host.chainFor('p1')).toBe(second.notificationId)
    })

    it('leaves the chains of other active Players alone when one acts', async () => {
        const host = remindedHost({ activeSeats: 2 })
        expect(host.state().activePlayerIds).toEqual(['p1', 'p2'])
        await host.apply(host.tally('t1', 'p1'))
        expect(host.reminderTimings().map(({ userId }) => userId)).toEqual(['p1'])
    })

    it('does not remind a waiting Player who acts out of turn', async () => {
        const host = remindedHost()
        await host.apply(host.tally('t1', 'p3'))
        expect(host.state().activePlayerIds).toEqual(['p1'])
        expect(host.reminders()).toEqual([])
    })
})
