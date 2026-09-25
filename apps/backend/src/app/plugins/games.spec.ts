import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'
import Games from './games.js'

describe('game route startup readiness', () => {
    it('rejects readiness when manifest-selected game logic cannot load', async () => {
        const server = Fastify()
        server.decorate('libraryService', {
            getTitles: async () => {
                throw new Error('Game artifact unavailable')
            }
        })
        try {
            await expect(server.register(Games).ready()).rejects.toThrow(
                'Game artifact unavailable'
            )
        } finally {
            await server.close()
        }
    })

    it('allows a successfully loaded empty game library', async () => {
        const server = Fastify()
        server.decorate('libraryService', { getTitles: async () => [] })
        try {
            await server.register(Games).ready()
            expect((await server.inject('/missing')).statusCode).toBe(404)
        } finally {
            await server.close()
        }
    })
})
