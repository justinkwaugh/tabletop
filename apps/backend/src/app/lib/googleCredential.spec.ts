import Fastify, { type FastifyInstance } from 'fastify'
import { LoginTicket } from 'google-auth-library'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop'))
import {
    GoogleAuthorizationFailedError,
    verifyGoogleCredential,
    type GoogleCredentialVerifier
} from './googleCredential.js'
import { loggerOptions } from './logging.js'

const CREDENTIAL = 'SYNTHETIC.GOOGLE.CREDENTIAL'

const servers = new Set<FastifyInstance>()
afterEach(async () => {
    for (const server of servers) await server.close()
    servers.clear()
})

function serializedByTheLogger(error: unknown): string {
    const lines: string[] = []
    const server = Fastify({
        logger: {
            ...loggerOptions,
            stream: {
                write: (line: string) => {
                    lines.push(line)
                }
            }
        }
    })
    servers.add(server)
    server.log.error({ err: error }, 'Request failed')
    return lines.join('')
}

function refusing(message: (idToken: string) => string): GoogleCredentialVerifier {
    return {
        verifyIdToken: async ({ idToken }) => {
            throw new Error(message(idToken ?? ''))
        }
    }
}

describe('verifyGoogleCredential', () => {
    it('reports a refused credential as a 401 that names the failure but not the credential', async () => {
        const verifier = refusing((idToken) => `Wrong number of segments in token: ${idToken}`)
        const failure = await verifyGoogleCredential(CREDENTIAL, verifier).catch(
            (error: unknown) => error
        )

        expect(failure).toBeInstanceOf(GoogleAuthorizationFailedError)
        if (!(failure instanceof GoogleAuthorizationFailedError)) throw new Error('unexpected')
        expect(failure.statusCode).toBe(401)
        expect(failure.cause).toBeInstanceOf(Error)
        if (!(failure.cause instanceof Error)) throw new Error('cause lost')
        expect(failure.cause.message).toContain('Wrong number of segments in token')
        expect(failure.cause.message).not.toContain(CREDENTIAL)
        expect(failure.cause.stack).not.toContain(CREDENTIAL)

        const logged = serializedByTheLogger(failure)
        expect(logged).toContain('GoogleAuthorizationFailedError')
        expect(logged).toContain('Wrong number of segments in token')
        expect(logged).not.toContain(CREDENTIAL)
    })

    it('reports a ticket without a payload the same way', async () => {
        const verifier: GoogleCredentialVerifier = {
            verifyIdToken: async () => new LoginTicket()
        }
        await expect(verifyGoogleCredential(CREDENTIAL, verifier)).rejects.toBeInstanceOf(
            GoogleAuthorizationFailedError
        )
    })
})
