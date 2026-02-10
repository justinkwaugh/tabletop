import { describe, expect, it } from 'vitest'
import { BUS_EDGE_IDS, type BusNodeId } from './busGraph.js'
import {
    applyBusLineSegment,
    extensionSegmentsByTargetNode,
    isValidBusLineSegmentPlacement,
    sourceCandidatesForTargetNode,
    validBusLineExtensionSegments,
    validStartingBusLineSegments
} from './busLineRules.js'

describe('busLineRules', () => {
    it('offers every graph edge as a valid starting segment', () => {
        const segments = validStartingBusLineSegments()

        expect(segments).toHaveLength(BUS_EDGE_IDS.length)

        const expected = new Set(BUS_EDGE_IDS.map(([left, right]) => `${left}:${right}`))
        const actual = new Set(segments.map(([left, right]) => `${left}:${right}`))
        expect(actual).toEqual(expected)
    })

    it('offers endpoint-only extension segments and excludes used edges', () => {
        const line: BusNodeId[] = ['N01', 'N05']
        const segments = validBusLineExtensionSegments(line)
        const segmentKeys = new Set(segments.map(([source, target]) => `${source}:${target}`))

        expect(segmentKeys).toEqual(
            new Set(['N01:N03', 'N01:N07', 'N01:N09', 'N05:N02', 'N05:N08', 'N05:N09', 'N05:N10'])
        )
    })

    it('rejects repeated edges and non-endpoint attachments', () => {
        const line: BusNodeId[] = ['N01', 'N05', 'N09']

        expect(isValidBusLineSegmentPlacement(line, ['N05', 'N10'])).toBe(false)
        expect(isValidBusLineSegmentPlacement(line, ['N09', 'N05'])).toBe(false)
        expect(isValidBusLineSegmentPlacement(line, ['N09', 'N14'])).toBe(true)
    })

    it('prepends or appends based on which endpoint is used as source', () => {
        expect(applyBusLineSegment(['N01', 'N05'], ['N01', 'N03'])).toEqual(['N03', 'N01', 'N05'])
        expect(applyBusLineSegment(['N01', 'N05'], ['N05', 'N09'])).toEqual(['N01', 'N05', 'N09'])
    })

    it('detects ambiguous targets that are reachable from both endpoints', () => {
        const line: BusNodeId[] = ['N03', 'N01', 'N07']
        const segmentsByTarget = extensionSegmentsByTargetNode(line)
        const ambiguousTargetSegments = segmentsByTarget.get('N06') ?? []

        expect(ambiguousTargetSegments).toEqual(
            expect.arrayContaining([
                ['N03', 'N06'] as const,
                ['N07', 'N06'] as const
            ])
        )
        expect(sourceCandidatesForTargetNode(line, 'N06').sort()).toEqual(['N03', 'N07'])
    })
})

