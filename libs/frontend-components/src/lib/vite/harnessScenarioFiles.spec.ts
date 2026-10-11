import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { createServer, request, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { isLocalAddress, saveRoute, saveScenarioFile } from './harnessScenarioFiles.js'

describe('saveScenarioFile', () => {
    let root: string
    let dir: string

    beforeEach(async () => {
        root = await mkdtemp(join(tmpdir(), 'harness-scenarios-'))
        dir = join(root, 'scenarios')
    })

    afterEach(async () => {
        await rm(root, { recursive: true, force: true })
    })

    test('writes the scenario into the scenarios folder by id', async () => {
        const scenario = { format: 1, label: 'Three-way duel' }

        const file = await saveScenarioFile(dir, JSON.stringify({ id: 'three-way-duel', scenario }))

        expect(file).toBe(join(dir, 'three-way-duel.json'))
        expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(scenario)
    })

    test('replaces a scenario saved with the same id', async () => {
        await saveScenarioFile(dir, JSON.stringify({ id: 'duel', scenario: { label: 'First' } }))
        await saveScenarioFile(dir, JSON.stringify({ id: 'duel', scenario: { label: 'Second' } }))

        expect(await readdir(dir)).toEqual(['duel.json'])
        expect(JSON.parse(await readFile(join(dir, 'duel.json'), 'utf8'))).toEqual({
            label: 'Second'
        })
    })

    test.each(['../escape', 'Upper', '', 'a/b'])('refuses the id %j', async (id) => {
        await expect(saveScenarioFile(dir, JSON.stringify({ id, scenario: {} }))).rejects.toThrow(
            'lowercase letters, digits and dashes'
        )
        await expect(readdir(dir)).rejects.toThrow()
    })

    test('refuses a request without a scenario', async () => {
        await expect(saveScenarioFile(dir, JSON.stringify({ id: 'empty' }))).rejects.toThrow(
            'needs its scenario'
        )
    })
})

describe('saveRoute', () => {
    let root: string
    let dir: string
    let server: Server
    let url: string

    beforeEach(async () => {
        root = await mkdtemp(join(tmpdir(), 'harness-scenarios-'))
        dir = join(root, 'scenarios')
        const route = saveRoute(dir)
        server = createServer((request, response) => route(request, response, () => {}))
        await new Promise<void>((listening) => server.listen(0, '127.0.0.1', listening))
        const address = server.address()
        if (typeof address !== 'object' || address === null) throw new Error('No test server port')
        url = `http://127.0.0.1:${address.port}`
    })

    afterEach(async () => {
        await new Promise((closed) => server.close(closed))
        await rm(root, { recursive: true, force: true })
    })

    test('saves a JSON request', async () => {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: 'duel', scenario: { label: 'Duel' } })
        })

        expect(response.status).toBe(200)
        expect(await readdir(dir)).toEqual(['duel.json'])
    })

    // A cross-site form post arrives as text/plain without the browser asking the server first
    test('refuses a request that is not JSON', async () => {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ id: 'duel', scenario: { label: 'Duel' } })
        })

        expect(response.status).toBe(415)
        await expect(readdir(dir)).rejects.toThrow()
    })

    test('refuses a request too large to be a scenario', async () => {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: 'huge', scenario: 'x'.repeat(21 * 1024 * 1024) })
        })

        expect(response.status).toBe(413)
        await expect(readdir(dir)).rejects.toThrow()
    })

    test('refuses a request that grows too large without declaring its length', async () => {
        const status = await new Promise<number | undefined>((answered, failed) => {
            const sending = request(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })
            sending.on('response', (response) => answered(response.statusCode))
            sending.on('error', failed)
            const chunk = 'x'.repeat(1024 * 1024)
            for (let n = 0; n < 21; n++) sending.write(chunk)
            sending.end()
        })

        expect(status).toBe(413)
        await expect(readdir(dir)).rejects.toThrow()
    })
})

describe('isLocalAddress', () => {
    test.each(['127.0.0.1', '::1', '::ffff:127.0.0.1'])('accepts %s', (address) => {
        expect(isLocalAddress(address)).toBe(true)
    })

    test.each(['100.64.0.7', '192.168.1.20', '::ffff:10.0.0.5', undefined])(
        'refuses %s',
        (address) => {
            expect(isLocalAddress(address)).toBe(false)
        }
    )
})
