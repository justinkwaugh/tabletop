import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import Fastify, { type FastifyInstance } from 'fastify'
import fastifyStatic from '@fastify/static'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import gameAssetRedirect from './gameAssetRedirect.js'

const ASSET_BASE_URL = 'https://assets.example.com/bucket'
const ASSET_PATH = '/games/oath/ui/0.16.0/assets/cover-dd2ac357.jpg'
const UI_MODULE_PATH = '/games/oath/ui/0.16.0/index.js'
const LOGIC_PATH = '/games/oath/logic/0.12.0/index.js'

let gamesRoot: string
const servers: FastifyInstance[] = []

async function fixture(assetBaseUrl?: string) {
    vi.stubEnv('GAME_ASSET_BASE_URL', assetBaseUrl)
    const server = Fastify()
    servers.push(server)
    await server.register(gameAssetRedirect)
    await server.register(fastifyStatic, { root: gamesRoot, prefix: '/games/' })
    return server
}

async function requestUnnormalizedPath(server: FastifyInstance, requestPath: string) {
    const address = await server.listen({ port: 0, host: '127.0.0.1' })
    const { port } = new URL(address)
    return new Promise<http.IncomingMessage>((resolve, reject) => {
        http.get({ host: '127.0.0.1', port, path: requestPath }, (response) => {
            response.resume()
            resolve(response)
        }).on('error', reject)
    })
}

describe('game asset redirect', () => {
    beforeAll(async () => {
        gamesRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'game-asset-redirect-'))
        for (const servedPath of [ASSET_PATH, UI_MODULE_PATH, LOGIC_PATH]) {
            const file = path.join(gamesRoot, servedPath.replace('/games/', ''))
            await fs.mkdir(path.dirname(file), { recursive: true })
            await fs.writeFile(file, `backend copy of ${servedPath}`)
        }
    })

    afterAll(() => fs.rm(gamesRoot, { recursive: true }))

    afterEach(async () => {
        vi.unstubAllEnvs()
        await Promise.all(servers.splice(0).map((server) => server.close()))
    })

    it('redirects a UI asset to the same path under the asset base URL', async () => {
        const server = await fixture(ASSET_BASE_URL)

        const response = await server.inject(ASSET_PATH)

        expect(response.statusCode).toBe(302)
        expect(response.headers.location).toBe(`${ASSET_BASE_URL}${ASSET_PATH}`)
        expect(response.headers['cache-control']).toBe('public, max-age=86400')
    })

    it('answers HEAD the same way', async () => {
        const server = await fixture(ASSET_BASE_URL)

        const response = await server.inject({ method: 'HEAD', url: ASSET_PATH })

        expect(response.statusCode).toBe(302)
        expect(response.headers.location).toBe(`${ASSET_BASE_URL}${ASSET_PATH}`)
    })

    it('redirects an asset in a nested directory', async () => {
        const server = await fixture(ASSET_BASE_URL)

        const response = await server.inject(
            '/games/sol/ui/6.4.1/assets/fonts/Metropolis-Bold.woff'
        )

        expect(response.headers.location).toBe(
            `${ASSET_BASE_URL}/games/sol/ui/6.4.1/assets/fonts/Metropolis-Bold.woff`
        )
    })

    it('keeps an encoded file name encoded', async () => {
        const server = await fixture(ASSET_BASE_URL)

        const response = await server.inject('/games/oath/ui/0.16.0/assets/card%20back%231.jpg')

        expect(response.headers.location).toBe(
            `${ASSET_BASE_URL}/games/oath/ui/0.16.0/assets/card%20back%231.jpg`
        )
    })

    it('ignores a trailing slash on the asset base URL', async () => {
        const server = await fixture(`${ASSET_BASE_URL}/`)

        const response = await server.inject(ASSET_PATH)

        expect(response.headers.location).toBe(`${ASSET_BASE_URL}${ASSET_PATH}`)
    })

    it.each([
        '/games/oath/ui/1/assets/../../../../../other-bucket/evil.html',
        '/games/oath/ui/1/assets/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/other-bucket/evil.html',
        '/games/oath/ui/1/assets/..%2F..%2F..%2F..%2F..%2Fother-bucket/evil.html',
        '/games/oath/ui/1/assets/./cover.jpg',
        '/games/oath/ui/1/assets//cover.jpg',
        '/games/oath/ui/1/assets/',
        '/games/../ui/../assets/cover.jpg',
        '/games/%2e%2e/ui/%2e%2e/assets/cover.jpg'
    ])('does not redirect %s, which has an empty or dot segment', async (requestPath) => {
        const server = await fixture(ASSET_BASE_URL)

        const response = await requestUnnormalizedPath(server, requestPath)

        expect(response.headers.location).toBeUndefined()
        expect(response.statusCode).toBe(404)
    })

    it('leaves the UI module and logic artifacts to the backend', async () => {
        const server = await fixture(ASSET_BASE_URL)

        for (const servedPath of [UI_MODULE_PATH, LOGIC_PATH]) {
            const response = await server.inject(servedPath)
            expect(response.statusCode).toBe(200)
            expect(response.body).toBe(`backend copy of ${servedPath}`)
        }
    })

    it('serves assets from the backend when no asset base URL is configured', async () => {
        const server = await fixture()

        const response = await server.inject(ASSET_PATH)

        expect(response.statusCode).toBe(200)
        expect(response.body).toBe(`backend copy of ${ASSET_PATH}`)
    })
})
