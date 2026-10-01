import * as Value from 'typebox/value'
import type { Patch } from './gameAction.js'

// fast-json-patch compares arrays index by index, so removing a leading element rewrites every later one.
export function createPatch(from: unknown, to: unknown): Patch {
    const patch: Patch = []
    appendDifferences(from, to, '', patch)
    return patch
}

function appendDifferences(from: unknown, to: unknown, path: string, patch: Patch): void {
    if (from === to) return
    if (Array.isArray(from) && Array.isArray(to)) {
        appendArrayDifferences(from, to, path, patch)
    } else if (isRecord(from) && isRecord(to)) {
        appendRecordDifferences(from, to, path, patch)
    } else if (!Value.Equal(from, to)) {
        patch.push({ op: 'replace', path, value: cloneValue(to) })
    }
}

function appendRecordDifferences(
    from: Record<string, unknown>,
    to: Record<string, unknown>,
    path: string,
    patch: Patch
): void {
    for (const [key, value] of Object.entries(from)) {
        if (value === undefined) continue
        const next = ownValue(to, key)
        const childPath = `${path}/${escapePathSegment(key)}`
        if (next === undefined) patch.push({ op: 'remove', path: childPath })
        else appendDifferences(value, next, childPath, patch)
    }
    for (const [key, value] of Object.entries(to)) {
        if (value === undefined || ownValue(from, key) !== undefined) continue
        patch.push({
            op: 'add',
            path: `${path}/${escapePathSegment(key)}`,
            value: cloneValue(value)
        })
    }
}

function appendArrayDifferences(
    from: readonly unknown[],
    to: readonly unknown[],
    path: string,
    patch: Patch
): void {
    let start = 0
    while (start < from.length && start < to.length && Value.Equal(from[start], to[start])) start++
    let fromEnd = from.length
    let toEnd = to.length
    while (fromEnd > start && toEnd > start && Value.Equal(from[fromEnd - 1], to[toEnd - 1])) {
        fromEnd--
        toEnd--
    }
    const pairedEnd = start + Math.min(fromEnd - start, toEnd - start)
    for (let index = start; index < pairedEnd; index++) {
        appendDifferences(from[index], to[index], `${path}/${index}`, patch)
    }
    for (let index = fromEnd - 1; index >= pairedEnd; index--) {
        patch.push({ op: 'remove', path: `${path}/${index}` })
    }
    for (let index = pairedEnd; index < toEnd; index++) {
        patch.push({ op: 'add', path: `${path}/${index}`, value: cloneValue(to[index]) })
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function ownValue(record: Record<string, unknown>, key: string): unknown {
    return Object.hasOwn(record, key) ? record[key] : undefined
}

function escapePathSegment(segment: string): string {
    return segment.replaceAll('~', '~0').replaceAll('/', '~1')
}

function cloneValue(value: unknown): unknown {
    if (value === undefined) return null
    return typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : value
}
