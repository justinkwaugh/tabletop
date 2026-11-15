import { CommonSubsequence, type SharedPair } from '../../util/commonSubsequence.js'
import { escapePointerSegment } from '../../util/jsonPointer.js'
import type { Patch, PatchOperation } from './gameAction.js'

export function createPatch(from: unknown, to: unknown): Patch {
    return new PatchWriter().patchBetween(from, to)
}

type WrittenOperation = { readonly operation: PatchOperation; readonly storedSize: number }

// fast-json-patch's compare pairs array elements by index, so one element leaving rewrites every later one.
class PatchWriter {
    private static readonly emptyOperationSize = '{"op":"","path":""},'.length
    private static readonly valueFieldSize = ',"value":'.length
    // Recorded games search past this only for a shuffle, which pairing by index serves as well.
    private static readonly searchStepsPerElement = 16

    private readonly written: WrittenOperation[] = []

    patchBetween(from: unknown, to: unknown): Patch {
        this.writeDifferences(from, to, '')
        return this.written.map(({ operation }) => operation)
    }

    private writeDifferences(from: unknown, to: unknown, path: string): void {
        if (from === to) return
        const firstOperation = this.written.length
        if (Array.isArray(from) && Array.isArray(to)) {
            this.writeArrayDifferences(from, to, path)
        } else if (PatchWriter.isRecord(from) && PatchWriter.isRecord(to)) {
            this.writeRecordDifferences(from, to, path)
        } else {
            this.writeValue('replace', path, to)
            return
        }
        this.replaceWholeIfSmaller(to, path, firstOperation)
    }

    private writeRecordDifferences(
        from: Record<string, unknown>,
        to: Record<string, unknown>,
        path: string
    ): void {
        for (const key of Object.keys(from)) {
            const value = from[key]
            if (value === undefined) continue
            const next = Object.hasOwn(to, key) ? to[key] : undefined
            if (next === value) continue
            const childPath = `${path}/${escapePointerSegment(key)}`
            if (next === undefined) this.writeRemoval(childPath)
            else this.writeDifferences(value, next, childPath)
        }
        for (const key of Object.keys(to)) {
            const value = to[key]
            if (value === undefined) continue
            if (Object.hasOwn(from, key) && from[key] !== undefined) continue
            this.writeValue('add', `${path}/${escapePointerSegment(key)}`, value)
        }
    }

    private writeArrayDifferences(
        from: readonly unknown[],
        to: readonly unknown[],
        path: string
    ): void {
        let start = 0
        while (
            start < from.length &&
            start < to.length &&
            PatchWriter.equal(from[start], to[start])
        )
            start++
        let fromEnd = from.length
        let toEnd = to.length
        while (
            fromEnd > start &&
            toEnd > start &&
            PatchWriter.equal(from[fromEnd - 1], to[toEnd - 1])
        ) {
            fromEnd--
            toEnd--
        }
        if (start === fromEnd && start === toEnd) return
        let fromAt = start
        let settled = start
        for (const [fromOffset, toOffset] of this.sharedElements(
            from.slice(start, fromEnd),
            to.slice(start, toEnd)
        )) {
            const fromShared = start + fromOffset
            const toShared = start + toOffset
            this.writeRun(
                from.slice(fromAt, fromShared),
                to.slice(settled, toShared),
                settled,
                path
            )
            this.writeDifferences(from[fromShared], to[toShared], `${path}/${toShared}`)
            fromAt = fromShared + 1
            settled = toShared + 1
        }
        this.writeRun(from.slice(fromAt, fromEnd), to.slice(settled, toEnd), settled, path)
    }

    // Two runs whose first and whose last elements differ share nothing unless they hold four elements between them.
    private sharedElements(leaving: readonly unknown[], joining: readonly unknown[]): SharedPair[] {
        const elements = leaving.length + joining.length
        if (leaving.length === 0 || joining.length === 0 || elements < 4) return []
        const ids = new Map<string | undefined, number>()
        const idOf = (element: unknown) => {
            const json = JSON.stringify(element)
            const known = ids.get(json)
            if (known !== undefined) return known
            ids.set(json, ids.size)
            return ids.size - 1
        }
        const leavingIds = Int32Array.from(leaving, idOf)
        const leavingIdCount = ids.size
        const joiningIds = Int32Array.from(joining, idOf)
        if (joiningIds.every((id) => id >= leavingIdCount)) return []
        const workLimit = PatchWriter.searchStepsPerElement * elements
        return CommonSubsequence.between(leavingIds, joiningIds, workLimit) ?? []
    }

    private writeRun(
        leaving: readonly unknown[],
        joining: readonly unknown[],
        index: number,
        path: string
    ): void {
        const paired = Math.min(leaving.length, joining.length)
        for (let offset = 0; offset < paired; offset++) {
            this.writeDifferences(leaving[offset], joining[offset], `${path}/${index + offset}`)
        }
        for (let offset = leaving.length - 1; offset >= paired; offset--) {
            this.writeRemoval(`${path}/${index + offset}`)
        }
        for (let offset = paired; offset < joining.length; offset++) {
            this.writeValue('add', `${path}/${index + offset}`, joining[offset])
        }
    }

    private replaceWholeIfSmaller(to: unknown, path: string, firstOperation: number): void {
        if (path === '' || this.written.length - firstOperation < 2) return
        let nestedSize = 0
        for (let index = firstOperation; index < this.written.length; index++)
            nestedSize += this.written[index].storedSize
        const emptyReplaceSize = PatchWriter.storedSize('replace', path, '')
        const valueSize = PatchWriter.storedSizeUpTo(to, nestedSize - emptyReplaceSize)
        if (emptyReplaceSize + valueSize >= nestedSize) return
        this.written.length = firstOperation
        this.writeValue('replace', path, to)
    }

    private writeValue(op: 'add' | 'replace', path: string, value: unknown): void {
        const json = JSON.stringify(value) ?? 'null'
        this.written.push({
            operation: { op, path, value: JSON.parse(json) },
            storedSize: PatchWriter.storedSize(op, path, json)
        })
    }

    private writeRemoval(path: string): void {
        this.written.push({
            operation: { op: 'remove', path },
            storedSize: PatchWriter.storedSize('remove', path)
        })
    }

    private static storedSize(op: string, path: string, valueJson?: string): number {
        const size = PatchWriter.emptyOperationSize + op.length + path.length
        return valueJson === undefined ? size : size + PatchWriter.valueFieldSize + valueJson.length
    }

    private static storedSizeUpTo(value: unknown, limit: number): number {
        if (typeof value === 'string') return value.length + '""'.length
        if (Array.isArray(value)) {
            let size = '[]'.length
            for (let index = 0; index < value.length && size <= limit; index++)
                size += PatchWriter.storedSizeUpTo(value[index], limit - size) + ','.length
            return size
        }
        if (!PatchWriter.isRecord(value)) return String(value).length
        let size = '{}'.length
        for (const key of Object.keys(value)) {
            if (size > limit) break
            if (value[key] === undefined) continue
            size += key.length + '"":,'.length
            size += PatchWriter.storedSizeUpTo(value[key], limit - size)
        }
        return size
    }

    // typebox's Value.Equal takes { a: undefined } for { b: 1 }.
    private static equal(left: unknown, right: unknown): boolean {
        if (left === right) return true
        if (Array.isArray(left)) {
            if (!Array.isArray(right) || left.length !== right.length) return false
            for (let index = 0; index < left.length; index++)
                if (!PatchWriter.equal(left[index], right[index])) return false
            return true
        }
        if (!PatchWriter.isRecord(left) || !PatchWriter.isRecord(right)) return false
        const keys = Object.keys(left)
        const rightKeys = Object.keys(right)
        if (keys.length !== rightKeys.length) return false
        for (let index = 0; index < keys.length; index++) {
            const key = keys[index]
            if (key !== rightKeys[index] && !Object.hasOwn(right, key)) return false
            if (!PatchWriter.equal(left[key], right[key])) return false
        }
        return true
    }

    private static isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null && !Array.isArray(value)
    }
}
