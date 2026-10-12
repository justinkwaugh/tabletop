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
    readonly carriesPlayer: boolean
    readonly inArray: boolean
}

function pathSegments(path: string): string[] {
    return path
        .split('/')
        .slice(1)
        .map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'))
}

function carriesPlayer(value: unknown, playerId: string): boolean {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        Reflect.get(value, 'playerId') === playerId
    )
}

function locate(document: unknown, segments: readonly string[], playerId: string): Location {
    let current = document
    let ownedByAncestor = false
    let inArray = false
    for (const segment of segments) {
        ownedByAncestor ||= carriesPlayer(current, playerId)
        inArray = Array.isArray(current)
        current =
            typeof current === 'object' && current !== null && Object.hasOwn(current, segment)
                ? Reflect.get(current, segment)
                : undefined
    }
    return { ownedByAncestor, carriesPlayer: carriesPlayer(current, playerId), inArray }
}

function isOwnEntry(location: Location, ownedBefore: boolean): boolean {
    return ownedBefore || (location.carriesPlayer && !location.inArray)
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
    if (operation.op === 'remove') return isOwnEntry(is, was.ownedByAncestor)
    if (operation.op === 'add') return isOwnEntry(was, was.ownedByAncestor)
    return (
        operation.op === 'replace' &&
        (was.ownedByAncestor || was.carriesPlayer) &&
        (is.ownedByAncestor || is.carriesPlayer)
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
