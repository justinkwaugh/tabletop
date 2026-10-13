import type { Patch, PatchOperation } from './gameAction.js'

export const ENGINE_MAINTAINED_FIELDS: ReadonlySet<string> = new Set([
    'machineState',
    'activePlayerIds',
    'actionCount',
    'actionChecksum',
    'parallelSpan'
])

interface Location {
    readonly ownedByAncestor: boolean
    readonly ownedByItself: boolean
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

function locate(document: unknown, segments: readonly string[], playerId: string): Location {
    let current = document
    let outermostOwnerId: string | undefined
    let inArray = false
    for (const segment of segments) {
        outermostOwnerId ??= carriedPlayerId(current)
        inArray = Array.isArray(current)
        current =
            typeof current === 'object' && current !== null && Object.hasOwn(current, segment)
                ? Reflect.get(current, segment)
                : undefined
    }
    return {
        ownedByAncestor: outermostOwnerId === playerId,
        ownedByItself: outermostOwnerId === undefined && carriedPlayerId(current) === playerId,
        inArray
    }
}

function isOwnEntry(location: Location): boolean {
    return location.ownedByItself && !location.inArray
}

function isWithinScope(
    operation: PatchOperation,
    before: unknown,
    after: unknown,
    playerId: string
): boolean {
    const segments = pathSegments(operation.path)
    if (ENGINE_MAINTAINED_FIELDS.has(segments[0])) return true
    const was = locate(before, segments, playerId)
    const is = locate(after, segments, playerId)
    const staysOwned = was.ownedByAncestor && is.ownedByAncestor
    if (operation.op === 'remove') return staysOwned || isOwnEntry(is)
    if (operation.op === 'add') return staysOwned || isOwnEntry(was)
    return (
        operation.op === 'replace' &&
        (was.ownedByAncestor || was.ownedByItself) &&
        (is.ownedByAncestor || is.ownedByItself)
    )
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
    return undoPatch.find((operation) => !isWithinScope(operation, before, after, playerId))?.path
}
