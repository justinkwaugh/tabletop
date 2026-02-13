import { BUS_EDGE_IDS, BUS_NODE_IDS, type BusNodeId } from './busGraph.js'

export type BusLineSegment = readonly [BusNodeId, BusNodeId]

const nodeIdSet = new Set<BusNodeId>(BUS_NODE_IDS)

const adjacencyByNode = (() => {
    const neighborsByNode = Object.fromEntries(
        BUS_NODE_IDS.map((nodeId) => [nodeId, [] as BusNodeId[]])
    ) as Record<BusNodeId, BusNodeId[]>

    for (const [left, right] of BUS_EDGE_IDS) {
        neighborsByNode[left].push(right)
        neighborsByNode[right].push(left)
    }

    return neighborsByNode
})()

export function isBusNodeId(value: string): value is BusNodeId {
    return nodeIdSet.has(value as BusNodeId)
}

export function busLineEdgeKey(left: BusNodeId, right: BusNodeId): string {
    return left < right ? `${left}:${right}` : `${right}:${left}`
}

const graphEdgeKeySet = new Set(BUS_EDGE_IDS.map(([left, right]) => busLineEdgeKey(left, right)))

export function isBusGraphEdge(left: BusNodeId, right: BusNodeId): boolean {
    return graphEdgeKeySet.has(busLineEdgeKey(left, right))
}

export function busLineEndpoints(
    line: readonly BusNodeId[]
): readonly [BusNodeId, BusNodeId] | undefined {
    if (line.length === 0) {
        return undefined
    }

    const head = line[0]
    const tail = line[line.length - 1]
    if (!head || !tail) {
        return undefined
    }

    return [head, tail]
}

export function usedBusLineEdgeKeys(line: readonly BusNodeId[]): Set<string> {
    const keys = new Set<string>()
    for (let index = 0; index < line.length - 1; index += 1) {
        const from = line[index]
        const to = line[index + 1]
        if (!from || !to) {
            continue
        }
        keys.add(busLineEdgeKey(from, to))
    }
    return keys
}

export function validStartingBusLineSegments(): BusLineSegment[] {
    return BUS_EDGE_IDS.map(([left, right]) => [left, right] as const)
}

function validBusLineExtensionSegmentsWithOccupancy(
    line: readonly BusNodeId[],
    otherLines: readonly (readonly BusNodeId[])[]
): BusLineSegment[] {
    const endpoints = busLineEndpoints(line)
    if (!endpoints) {
        return []
    }

    const [head, tail] = endpoints
    const usedEdgeKeys = usedBusLineEdgeKeys(line)
    const otherLineEdgeKeys = otherLines.map((otherLine) => ({
        line: otherLine,
        edgeKeys: usedBusLineEdgeKeys(otherLine)
    }))

    const candidatesBySource = new Map<
        BusNodeId,
        { segment: BusLineSegment; allowedUnderPrimaryRule: boolean }[]
    >()
    candidatesBySource.set(head, [])
    if (tail !== head) {
        candidatesBySource.set(tail, [])
    }
    const seen = new Set<string>()

    const hasTerminalOnEdgeAtSource = (
        otherLine: readonly BusNodeId[],
        source: BusNodeId,
        target: BusNodeId
    ): boolean => {
        if (otherLine.length < 2) {
            return false
        }

        const firstNodeId = otherLine[0]
        const secondNodeId = otherLine[1]
        if (firstNodeId === source && secondNodeId === target) {
            return true
        }

        const lastNodeId = otherLine[otherLine.length - 1]
        const previousNodeId = otherLine[otherLine.length - 2]
        return lastNodeId === source && previousNodeId === target
    }

    const pushSegment = (source: BusNodeId, target: BusNodeId) => {
        const edgeKey = busLineEdgeKey(source, target)
        const directedKey = `${source}>${target}`
        if (usedEdgeKeys.has(edgeKey) || seen.has(directedKey)) {
            return
        }

        const occupyingOtherLines = otherLineEdgeKeys.filter((otherLine) =>
            otherLine.edgeKeys.has(edgeKey)
        )
        const occupiedByOtherLine = occupyingOtherLines.length > 0
        const isHeadToHeadWithOtherLine = occupiedByOtherLine
            ? occupyingOtherLines.every((otherLine) =>
                  hasTerminalOnEdgeAtSource(otherLine.line, source, target)
              )
            : false

        const sourceCandidates = candidatesBySource.get(source)
        if (!sourceCandidates) {
            return
        }

        sourceCandidates.push({
            segment: [source, target],
            allowedUnderPrimaryRule: !occupiedByOtherLine || isHeadToHeadWithOtherLine
        })
        seen.add(directedKey)
    }

    for (const neighborId of adjacencyByNode[head]) {
        pushSegment(head, neighborId)
    }

    for (const neighborId of adjacencyByNode[tail]) {
        pushSegment(tail, neighborId)
    }

    const segments: BusLineSegment[] = []
    for (const endpointCandidates of candidatesBySource.values()) {
        const primaryAllowedSegments = endpointCandidates
            .filter((candidate) => candidate.allowedUnderPrimaryRule)
            .map((candidate) => candidate.segment)
        if (primaryAllowedSegments.length > 0) {
            segments.push(...primaryAllowedSegments)
            continue
        }

        // Endpoint-specific fallback: if this end has no primary-legal options,
        // allow any non-self edge from that end.
        segments.push(...endpointCandidates.map((candidate) => candidate.segment))
    }

    return segments
}

export function validBusLineExtensionSegments(
    line: readonly BusNodeId[],
    otherLines: readonly (readonly BusNodeId[])[] = []
): BusLineSegment[] {
    return validBusLineExtensionSegmentsWithOccupancy(line, otherLines)
}

export function validBusLineSegments(
    line: readonly BusNodeId[],
    otherLines: readonly (readonly BusNodeId[])[] = []
): BusLineSegment[] {
    if (line.length === 0) {
        return validStartingBusLineSegments()
    }
    return validBusLineExtensionSegmentsWithOccupancy(line, otherLines)
}

export function extensionSegmentsByTargetNode(
    line: readonly BusNodeId[],
    otherLines: readonly (readonly BusNodeId[])[] = []
): Map<BusNodeId, BusLineSegment[]> {
    const grouped = new Map<BusNodeId, BusLineSegment[]>()
    for (const segment of validBusLineExtensionSegmentsWithOccupancy(line, otherLines)) {
        const target = segment[1]
        const existing = grouped.get(target)
        if (existing) {
            existing.push(segment)
        } else {
            grouped.set(target, [segment])
        }
    }
    return grouped
}

export function sourceCandidatesForTargetNode(
    line: readonly BusNodeId[],
    targetNodeId: BusNodeId,
    otherLines: readonly (readonly BusNodeId[])[] = []
): BusNodeId[] {
    const segments = extensionSegmentsByTargetNode(line, otherLines).get(targetNodeId) ?? []
    const sourceNodeIds = new Set<BusNodeId>()
    for (const [sourceNodeId] of segments) {
        sourceNodeIds.add(sourceNodeId)
    }
    return [...sourceNodeIds]
}

export function isValidBusLineSegmentPlacement(
    line: readonly BusNodeId[],
    segment: BusLineSegment,
    otherLines: readonly (readonly BusNodeId[])[] = []
): boolean {
    const [left, right] = segment
    if (!isBusGraphEdge(left, right)) {
        return false
    }

    if (line.length === 0) {
        return true
    }

    const validSegments = validBusLineExtensionSegmentsWithOccupancy(line, otherLines)
    return validSegments.some(
        ([sourceNodeId, targetNodeId]) =>
            (sourceNodeId === left && targetNodeId === right) ||
            (sourceNodeId === right && targetNodeId === left)
    )
}

export function applyBusLineSegment(
    line: readonly BusNodeId[],
    segment: BusLineSegment
): BusNodeId[] | undefined {
    if (!isValidBusLineSegmentPlacement(line, segment)) {
        return undefined
    }

    const [left, right] = segment
    if (line.length === 0) {
        return [left, right]
    }

    const [head, tail] = busLineEndpoints(line)!

    if (left === head) {
        return [right, ...line]
    }
    if (right === head) {
        return [left, ...line]
    }
    if (left === tail) {
        return [...line, right]
    }
    if (right === tail) {
        return [...line, left]
    }

    return undefined
}
