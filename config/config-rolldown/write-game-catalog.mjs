import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { writeFile } from 'node:fs/promises'
import { GameCatalogEntry } from '@tabletop/common'
import { Value } from 'typebox/value'

export async function writeGameCatalog(bundleDirectory) {
    const { UiDefinition } = await import(pathToFileURL(path.join(bundleDirectory, 'index.js')))
    const { id, metadata, thumbnailUrl, clientCapabilities } = UiDefinition.info
    if (!id || !metadata || !thumbnailUrl) {
        throw new Error('UI definition must provide catalog identity, metadata, and cover URL')
    }
    const entry = { id, metadata, thumbnailUrl, clientCapabilities }
    const error = Value.Errors(GameCatalogEntry, entry)[0]
    if (error) {
        throw new Error(
            `UI definition catalog entry is invalid at ${error.instancePath}: ${error.message}`
        )
    }
    await writeFile(path.join(bundleDirectory, 'catalog.json'), JSON.stringify(entry) + '\n')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    await writeGameCatalog(path.resolve(process.argv[2]))
}
