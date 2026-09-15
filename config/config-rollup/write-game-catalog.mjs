import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { writeFile } from 'node:fs/promises'

export async function writeGameCatalog(bundleDirectory) {
    const { UiDefinition } = await import(pathToFileURL(path.join(bundleDirectory, 'index.js')))
    const { id, metadata, thumbnailUrl } = UiDefinition.info
    if (!id || !metadata || !thumbnailUrl) {
        throw new Error('UI definition must provide catalog identity, metadata, and cover URL')
    }
    await writeFile(
        path.join(bundleDirectory, 'catalog.json'),
        JSON.stringify({ id, metadata, thumbnailUrl }) + '\n'
    )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    await writeGameCatalog(path.resolve(process.argv[2]))
}
