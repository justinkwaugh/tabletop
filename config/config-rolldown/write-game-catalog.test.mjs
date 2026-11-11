import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { writeGameCatalog } from './write-game-catalog.mjs'

const metadata = {
    name: 'Example',
    designer: 'Example Designer',
    description: 'An example.',
    year: '2005',
    minPlayers: 2,
    maxPlayers: 4,
    defaultPlayerCount: 3,
    version: '1.0.0',
    beta: false
}

async function writeUiDefinition(directory, info) {
    await writeFile(path.join(directory, 'package.json'), '{"type":"module"}')
    await writeFile(
        path.join(directory, 'index.js'),
        `export const UiDefinition = { info: ${JSON.stringify(info)} }`
    )
}

test('catalog generation preserves resolved metadata without loading runtime or publishing configuration', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'catalog-build-'))
    try {
        await writeFile(path.join(directory, 'package.json'), '{"type":"module"}')
        await writeFile(path.join(directory, 'runtime.js'), 'throw new Error("Runtime was loaded")')
        await writeFile(
            path.join(directory, 'metadata.js'),
            `export const metadata = ${JSON.stringify({ ...metadata, bggId: 249381, hasScores: true })}`
        )
        await writeFile(
            path.join(directory, 'index.js'),
            `
            import { metadata } from './metadata.js'
            export const UiDefinition = {
                info: { id: 'example', metadata,
                    thumbnailUrl: '/games/example/ui/2.0.0/assets/cover-abc123.jpg',
                    configurator: { fields: ['not catalog data'] }
                },
                runtime: () => import('./runtime.js')
            }
        `
        )
        await writeGameCatalog(directory)
        assert.deepEqual(JSON.parse(await readFile(path.join(directory, 'catalog.json'), 'utf8')), {
            id: 'example',
            metadata: { ...metadata, bggId: 249381, hasScores: true },
            thumbnailUrl: '/games/example/ui/2.0.0/assets/cover-abc123.jpg'
        })
    } finally {
        await rm(directory, { recursive: true, force: true })
    }
})

test('catalog generation carries the client capabilities the UI declares', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'catalog-build-'))
    try {
        await writeUiDefinition(directory, {
            id: 'example',
            metadata,
            thumbnailUrl: '/cover.jpg',
            clientCapabilities: ['calledGames']
        })
        await writeGameCatalog(directory)
        assert.deepEqual(
            JSON.parse(await readFile(path.join(directory, 'catalog.json'), 'utf8'))
                .clientCapabilities,
            ['calledGames']
        )
    } finally {
        await rm(directory, { recursive: true, force: true })
    }
})

test('catalog generation rejects metadata the catalogue would refuse', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'catalog-build-'))
    try {
        await writeUiDefinition(directory, {
            id: 'example',
            metadata: {
                ...metadata,
                publisher: { name: 'Example Publisher', url: 'http://example.com/game' }
            },
            thumbnailUrl: '/cover.jpg'
        })
        await assert.rejects(writeGameCatalog(directory), /metadata\/publisher\/url/)
        await assert.rejects(readFile(path.join(directory, 'catalog.json')))
    } finally {
        await rm(directory, { recursive: true, force: true })
    }
})
