import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { writeGameCatalog } from './write-game-catalog.mjs'

test('catalog generation preserves resolved metadata without loading runtime or publishing configuration', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'catalog-build-'))
    try {
        await writeFile(path.join(directory, 'package.json'), '{"type":"module"}')
        await writeFile(path.join(directory, 'runtime.js'), 'throw new Error("Runtime was loaded")')
        await writeFile(
            path.join(directory, 'metadata.js'),
            'export const metadata = { name: "Example", beta: false }'
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
            metadata: { name: 'Example', beta: false },
            thumbnailUrl: '/games/example/ui/2.0.0/assets/cover-abc123.jpg'
        })
    } finally {
        await rm(directory, { recursive: true, force: true })
    }
})
