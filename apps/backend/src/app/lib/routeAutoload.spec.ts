import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import AutoLoad from '@fastify/autoload'
import Fastify from 'fastify'
import { expect, it } from 'vitest'
import { routeAutoloadOptions } from './routeAutoload.js'

it('loads routes without importing colocated source or compiled tests', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'backend-routes-'))
    const server = Fastify()
    try {
        for (const group of ['api', 'tasks']) {
            const routes = join(directory, group)
            await mkdir(routes)
            await writeFile(
                join(routes, 'health.mjs'),
                `
                export default async function (server) {
                    server.get('/health', async () => ({ ok: true }))
                }
            `
            )
            for (const suffix of [
                'spec.ts',
                'test.ts',
                'spec.js',
                'test.js',
                'spec.mjs',
                'test.cjs'
            ]) {
                await writeFile(
                    join(routes, `health.${suffix}`),
                    `
                    throw new Error('Route discovery imported a test: ${suffix}')
                `
                )
            }
            await server.register(AutoLoad, {
                ...routeAutoloadOptions,
                dir: routes,
                options: { prefix: `/${group}` }
            })
        }
        await server.ready()
        for (const group of ['api', 'tasks']) {
            const response = await server.inject(`/${group}/health`)
            expect(response.statusCode).toBe(200)
            expect(response.json()).toEqual({ ok: true })
        }
    } finally {
        await server.close()
        await rm(directory, { recursive: true, force: true })
    }
})

it("applies a folder's autohooks to that folder's routes only", async () => {
    const directory = await mkdtemp(join(tmpdir(), 'backend-route-hooks-'))
    const server = Fastify()
    try {
        for (const folder of ['guarded', 'open']) {
            await mkdir(join(directory, folder))
            await writeFile(
                join(directory, folder, 'health.mjs'),
                `
                export default async function (server) {
                    server.get('/health', async () => ({ ok: true }))
                }
            `
            )
        }
        await writeFile(
            join(directory, 'guarded', 'autohooks.mjs'),
            `
            export default async function (server) {
                server.addHook('onRequest', async (_request, reply) => reply.code(404).send())
            }
        `
        )
        await server.register(AutoLoad, { ...routeAutoloadOptions, dir: directory })
        await server.ready()
        expect((await server.inject('/guarded/health')).statusCode).toBe(404)
        expect((await server.inject('/open/health')).statusCode).toBe(200)
    } finally {
        await server.close()
        await rm(directory, { recursive: true, force: true })
    }
})
