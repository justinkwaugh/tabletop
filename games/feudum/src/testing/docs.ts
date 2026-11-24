/// <reference types="node" />
import { assert } from '@tabletop/common'
import { vi } from 'vitest'

export async function readDoc(name: string): Promise<string> {
    const fs = await vi.importActual<typeof import('node:fs')>('node:fs')
    return fs.readFileSync(new URL(`../../docs/${name}`, import.meta.url), 'utf8')
}

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

export function docTableRows(doc: string, heading: string): Record<string, string>[] {
    const section = docSection(doc, heading)
    const subheading = section.findIndex((line) => line.startsWith('#'))
    const tables: string[][][] = []
    let inTable = false
    for (const line of subheading < 0 ? section : section.slice(0, subheading)) {
        const row = line.startsWith('|')
        if (row && !inTable) {
            tables.push([])
        }
        inTable = row
        if (row) {
            tables[tables.length - 1].push(
                line
                    .slice(1, line.lastIndexOf('|'))
                    .split('|')
                    .map((cell) => cell.trim().replaceAll('`', ''))
            )
        }
    }
    return tables.flatMap(([titles, , ...body]) =>
        body.map((cells) => {
            assert(cells.length === titles.length, `A row under "${heading}" has a cell per column`)
            return Object.fromEntries(titles.map((title, column) => [title, cells[column]]))
        })
    )
}
