import { describe, expect, it, vi } from 'vitest'
import { REALTIME_CONTROL_CHANNEL, RealtimeControl } from './realtimeControl.js'

function recordingPublisher() {
    const published: { topic: string; message: string }[] = []
    return {
        published,
        publishMessage: async (message: { topic: string; message: string }) => {
            published.push(message)
        }
    }
}

describe('RealtimeControl', () => {
    const now = () => new Date('2026-10-27T12:00:00.500Z')

    it('revokes an account with the moment of revocation on the control feed', async () => {
        const publisher = recordingPublisher()
        await new RealtimeControl(publisher, now).revokeAccount('u1')
        expect(publisher.published).toEqual([
            {
                topic: REALTIME_CONTROL_CHANNEL,
                message: JSON.stringify({ revoke: 'u1', at: 1793102400.5 })
            }
        ])
    })

    it('revokes named topics without naming the whole account', async () => {
        const publisher = recordingPublisher()
        await new RealtimeControl(publisher, now).revokeTopics('u1', ['relay-stats'])
        expect(JSON.parse(publisher.published[0]?.message ?? '')).toEqual({
            revoke: 'u1',
            topics: ['relay-stats'],
            at: 1793102400.5
        })
    })

    it('publishes nothing for an empty topic list or without a publisher', async () => {
        const publisher = recordingPublisher()
        await new RealtimeControl(publisher, now).revokeTopics('u1', [])
        expect(publisher.published).toEqual([])
        await expect(
            new RealtimeControl(undefined, now).revokeAccount('u1')
        ).resolves.toBeUndefined()
    })

    it('drops a message the publisher cannot deliver, naming only the kind of message', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const failing = {
            publishMessage: async () => {
                throw new Error('redis is away')
            }
        }
        await expect(
            new RealtimeControl(failing, now).revokeTopics('u1', ['relay-stats'])
        ).resolves.toBeUndefined()
        expect(warn).toHaveBeenCalledWith('Realtime revocation not published', {
            kind: 'topics',
            error: expect.any(Error)
        })
        warn.mockRestore()
    })
})
