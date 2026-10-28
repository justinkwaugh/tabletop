import { describe, expect, it } from 'vitest'
import { AblyService, ablyClientCapability } from './ablyService.js'

const service = new AblyService('app.key:synthetic-secret-for-local-signing')

describe('Ably token requests', () => {
    it('identify the user and grant subscribe only on the listed topics', async () => {
        const request = await service.createTokenRequest({
            userId: 'u1',
            topics: ['user-u1', 'global', 'game-g1']
        })
        expect(request.clientId).toBe('u1')
        expect(JSON.parse(request.capability)).toEqual({
            'user-u1': ['subscribe'],
            global: ['subscribe'],
            'game-g1': ['subscribe']
        })
    })

    it('never fall back to the issuing key capabilities', async () => {
        const request = await service.createTokenRequest({ userId: 'u1', topics: [] })
        expect(request.capability).toBe('{}')
    })

    it('grant no publish operation on any topic', () => {
        const capability = ablyClientCapability(['user-u1', 'global', 'game-g1'])
        for (const operations of Object.values(capability)) {
            expect(operations).toEqual(['subscribe'])
        }
        expect(Object.keys(capability)).not.toContain('*')
    })
})
