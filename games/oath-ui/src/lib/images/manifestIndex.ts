import { assertExists } from '@tabletop/common'

/** A manifest's files keyed by file name, without the folder or the extension. */
export function indexByName(files: Record<string, string>): Map<string, string> {
    return new Map(Object.entries(files).map(([path, url]) => [fileStem(path), url]))
}

// The coverage specs prove every name a lookup can build is bundled.
export function imageNamed(index: ReadonlyMap<string, string>, name: string): string {
    const url = index.get(name)
    assertExists(url, `No image is bundled as ${name}`)
    return url
}

function fileStem(path: string): string {
    const name = path.slice(path.lastIndexOf('/') + 1)
    return name.slice(0, name.lastIndexOf('.'))
}
