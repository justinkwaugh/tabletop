import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import {
    listJsonFiles,
    saveScenarioRecording,
    saveScenarioRequest,
    scenarioRequestFolder
} from './harnessScenarioFiles.js'

describe('scenario recording files', () => {
    let root: string
    let dir: string

    beforeEach(async () => {
        root = await mkdtemp(join(tmpdir(), 'harness-scenarios-'))
        dir = join(root, 'recordings')
    })

    afterEach(async () => {
        await rm(root, { recursive: true, force: true })
    })

    test('writes the recording beside a .gitignore that keeps the folder local', async () => {
        const file = await saveScenarioRecording(dir, JSON.stringify({ id: 'three-way-duel' }))

        expect(file).toBe(join(dir, 'three-way-duel.json'))
        expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ id: 'three-way-duel' })
        expect(await readFile(join(dir, '.gitignore'), 'utf8')).toBe('*\n')
    })

    test('keeps a .gitignore the folder already has', async () => {
        await saveScenarioRecording(dir, JSON.stringify({ id: 'first' }))
        await writeFile(join(dir, '.gitignore'), '*\n!keep.json\n')

        await saveScenarioRecording(dir, JSON.stringify({ id: 'second' }))

        expect(await readFile(join(dir, '.gitignore'), 'utf8')).toBe('*\n!keep.json\n')
    })

    test.each(['../escape', 'Upper', '', 'a/b'])('refuses the id %j', async (id) => {
        await expect(saveScenarioRecording(dir, JSON.stringify({ id }))).rejects.toThrow(
            'lowercase letters, digits and dashes'
        )
        await expect(readdir(dir)).rejects.toThrow()
    })

    test('lists every recording by file name, and a file that is not JSON by its error', async () => {
        await saveScenarioRecording(dir, JSON.stringify({ id: 'b-second' }))
        await saveScenarioRecording(dir, JSON.stringify({ id: 'a-first' }))
        await writeFile(join(dir, 'broken.json'), '{ not json')

        const listed = await listJsonFiles(dir)

        expect(Object.keys(listed)).toEqual(['a-first.json', 'b-second.json', 'broken.json'])
        expect(listed['a-first.json']).toEqual({ id: 'a-first' })
        expect(listed['broken.json']).toEqual({ error: expect.any(String) })
    })

    test('lists nothing before any recording is saved', async () => {
        expect(await listJsonFiles(dir)).toEqual({})
    })

    test('keeps requests in their own folder, ignored with the recordings', async () => {
        const file = await saveScenarioRequest(dir, JSON.stringify({ id: 'four-way-tie' }))

        expect(file).toBe(join(scenarioRequestFolder(dir), 'four-way-tie.json'))
        expect(await readFile(join(dir, '.gitignore'), 'utf8')).toBe('*\n')
        expect(await listJsonFiles(dir)).toEqual({})
        expect(await listJsonFiles(scenarioRequestFolder(dir))).toEqual({
            'four-way-tie.json': { id: 'four-way-tie' }
        })
    })
})
