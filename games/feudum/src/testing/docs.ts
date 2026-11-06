import { vi } from 'vitest'

interface DocFiles {
    readFileSync(path: URL, encoding: 'utf8'): string
}

/** The text of one of this package's `docs/` files, for specs that check data against them. */
export async function readDoc(name: string): Promise<string> {
    const fs = await vi.importActual<DocFiles>('node:fs')
    return fs.readFileSync(new URL(`../../docs/${name}`, import.meta.url), 'utf8')
}

/** The lines under a heading, up to the next heading of the same or a higher level. */
export function docSection(doc: string, heading: string): string[] {
    const lines = doc.split('\n')
    const start = lines.indexOf(heading)
    if (start < 0) {
        throw new Error(`No heading "${heading}"`)
    }
    const level = heading.indexOf(' ')
    const rest = lines.slice(start + 1)
    const end = rest.findIndex((line) => {
        const hashes = /^#+ /.exec(line)
        return hashes !== null && hashes[0].length - 1 <= level
    })
    return end < 0 ? rest : rest.slice(0, end)
}

/** The rows of the table directly under a heading, keyed by column title, cells bare of padding and backticks. */
export function docTableRows(doc: string, heading: string): Record<string, string>[] {
    const section = docSection(doc, heading)
    const subheading = section.findIndex((line) => line.startsWith('#'))
    const rows = (subheading < 0 ? section : section.slice(0, subheading))
        .filter((line) => line.startsWith('|'))
        .map((line) =>
            line
                .slice(1, line.lastIndexOf('|'))
                .split('|')
                .map((cell) => cell.trim().replaceAll('`', ''))
        )
    const [titles = [], , ...body] = rows
    return body.map((cells) =>
        Object.fromEntries(titles.map((title, column) => [title, cells[column] ?? '']))
    )
}
