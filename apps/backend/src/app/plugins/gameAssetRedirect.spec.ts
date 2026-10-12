import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import gameAssetRedirect from './gameAssetRedirect.js'

const ASSET_BASE_URL = 'https://assets.example.com/bucket'
const ASSET_PATH = '/games/oath/ui/0.16.0/assets/cover-dd2ac357.jpg'
const UI_MODULE_PATH = '/games/oath/ui/0.16.0/index.js'
const LOGIC_PATH = '/games/oath/logic/0.12.0/index.js'

let gamesRoot: string

async function fixture(assetBaseUrl?: string) {
    const server = Fastify()
    await server.register(gameAssetRedirect, { assetBaseUrl })
    await server.register(fastifyStatic, { root: gamesRoot, prefix: '/games/' })
    return server
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

    afterEach(() => vi.unstubAllEnvs())

    it('redirects a UI asset to the same path under the asset base URL', async () => {
        const server = await fixture(ASSET_BASE_URL)

        const response = await server.inject(`${ASSET_PATH}?v=1`)

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

    it('leaves the UI module and logic artifacts to the backend', async () => {
        const server = await fixture(ASSET_BASE_URL)

        for (const servedPath of [UI_MODULE_PATH, LOGIC_PATH]) {
            const response = await server.inject(servedPath)
            expect(response.statusCode).toBe(200)
            expect(response.body).toBe(`backend copy of ${servedPath}`)
        }
    })

    it('serves assets from the backend when no asset base URL is configured', async () => {
        vi.stubEnv('GAME_ASSET_BASE_URL', undefined)
        const server = await fixture()

        const response = await server.inject(ASSET_PATH)

        expect(response.statusCode).toBe(200)
        expect(response.body).toBe(`backend copy of ${ASSET_PATH}`)
    })

    it('reads the asset base URL from the environment', async () => {
        vi.stubEnv('GAME_ASSET_BASE_URL', ASSET_BASE_URL)
        const server = await fixture()

        const response = await server.inject(ASSET_PATH)

        expect(response.headers.location).toBe(`${ASSET_BASE_URL}${ASSET_PATH}`)
    })
})
