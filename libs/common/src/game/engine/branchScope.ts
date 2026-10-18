import type { Patch, PatchOperation } from './gameAction.js'

export const ENGINE_MAINTAINED_FIELDS: ReadonlySet<string> = new Set([
    'machineState',
    'activePlayerIds',
    'actionCount',
    'actionChecksum',
    'parallelSpan'
])

interface Location {
    readonly ancestorOwnerId?: string
    readonly ownerId?: string
    readonly inArray: boolean
}

function pathSegments(path: string): string[] {
    return path
        .split('/')
        .slice(1)
        .map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'))
}

function carriedPlayerId(value: unknown): string | undefined {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
    const playerId: unknown = Reflect.get(value, 'playerId')
    return typeof playerId === 'string' ? playerId : undefined
}

function locate(document: unknown, segments: readonly string[]): Location {
    let current = document
    let ancestorOwnerId: string | undefined
    let inArray = false
    for (const segment of segments) {
        ancestorOwnerId ??= carriedPlayerId(current)
        inArray = Array.isArray(current)
        current =
            typeof current === 'object' && current !== null && Object.hasOwn(current, segment)
                ? Reflect.get(current, segment)
                : undefined
    }
    return { ancestorOwnerId, ownerId: carriedPlayerId(current), inArray }
}

function isOwnedBy(location: Location, playerId: string): boolean {
    return location.ancestorOwnerId === playerId || isOwnEntryOf(location, playerId)
}

function isOwnEntryOf(location: Location, playerId: string): boolean {
    return location.ancestorOwnerId === undefined && location.ownerId === playerId
}

function isOwnedByAnyone(location: Location): boolean {
    return location.ancestorOwnerId !== undefined || location.ownerId !== undefined
}

function isWithinBranchScope(
    operation: PatchOperation,
    before: unknown,
    after: unknown,
    playerId: string
): boolean {
    const segments = pathSegments(operation.path)
    if (ENGINE_MAINTAINED_FIELDS.has(segments[0])) return true
    const was = locate(before, segments)
    const is = locate(after, segments)
    const staysOwned = was.ancestorOwnerId === playerId && is.ancestorOwnerId === playerId
    if (operation.op === 'remove') return staysOwned || (isOwnEntryOf(is, playerId) && !is.inArray)
    if (operation.op === 'add') return staysOwned || (isOwnEntryOf(was, playerId) && !was.inArray)
    return operation.op === 'replace' && isOwnedBy(was, playerId) && isOwnedBy(is, playerId)
}

function isWithinCommonScope(operation: PatchOperation, before: unknown, after: unknown): boolean {
    const segments = pathSegments(operation.path)
    if (ENGINE_MAINTAINED_FIELDS.has(segments[0])) return true
    if (operation.op !== 'remove' && operation.op !== 'add' && operation.op !== 'replace') {
        return false
    }
    return !isOwnedByAnyone(locate(before, segments)) && !isOwnedByAnyone(locate(after, segments))
}

export function findBranchScopeViolation({
    undoPatch,
    before,
    after,
    playerId
}: {
    undoPatch: Patch
    before: unknown
    after: unknown
    playerId: string
}): string | undefined {
    return undoPatch.find((operation) => !isWithinBranchScope(operation, before, after, playerId))
        ?.path
}

export function findCommonScopeViolation({
    undoPatch,
    before,
    after
}: {
    undoPatch: Patch
    before: unknown
    after: unknown
}): string | undefined {
    return undoPatch.find((operation) => !isWithinCommonScope(operation, before, after))?.path
}
