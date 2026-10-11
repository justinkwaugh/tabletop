import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { saveScenarioFile } from './harnessScenarioFiles.js'

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
