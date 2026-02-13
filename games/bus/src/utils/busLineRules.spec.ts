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

    it('disallows occupied-by-other segments unless head-to-head when primary options exist', () => {
        const selfLine: BusNodeId[] = ['N01', 'N05']
        const otherLine: BusNodeId[] = ['N01', 'N05', 'N09', 'N14'] // Occupies edge N05-N09 as an internal segment.

        const segments = validBusLineExtensionSegments(selfLine, [otherLine])
        expect(segments).not.toContainEqual(['N05', 'N09'])
        expect(isValidBusLineSegmentPlacement(selfLine, ['N05', 'N09'], [otherLine])).toBe(false)
    })

    it('allows occupied-by-other segment when it is a head-to-head extension from either terminal end', () => {
        const selfLine: BusNodeId[] = ['N01', 'N05']
        const otherLine: BusNodeId[] = ['N14', 'N09', 'N05'] // Tail segment is N09-N05

        const segments = validBusLineExtensionSegments(selfLine, [otherLine])
        expect(segments).toContainEqual(['N05', 'N09'])
        expect(isValidBusLineSegmentPlacement(selfLine, ['N05', 'N09'], [otherLine])).toBe(true)
    })

    it('requires all occupying other lines on a shared segment to terminate at the same source node', () => {
        const selfLine: BusNodeId[] = ['N01', 'N05']

        const bothHeadOn: BusNodeId[][] = [
            ['N05', 'N09', 'N14'],
            ['N18', 'N13', 'N07', 'N09', 'N05']
        ]
        expect(validBusLineExtensionSegments(selfLine, bothHeadOn)).toContainEqual(['N05', 'N09'])

        const mixedTerminal: BusNodeId[][] = [
            ['N05', 'N09', 'N14'],
            ['N01', 'N05', 'N09', 'N14']
        ]
        expect(validBusLineExtensionSegments(selfLine, mixedTerminal)).not.toContainEqual([
            'N05',
            'N09'
        ])
    })

    it('falls back to allowing occupied-by-other segments when all endpoint options are blocked', () => {
        const selfLine: BusNodeId[] = ['N29', 'N25']
        const otherLines: BusNodeId[][] = [
            ['N28', 'N29'],
            ['N28', 'N25'],
            ['N18', 'N25']
        ]

        const segments = validBusLineExtensionSegments(selfLine, otherLines)
        const segmentKeys = new Set(segments.map(([source, target]) => `${source}:${target}`))

        expect(segmentKeys).toEqual(new Set(['N29:N28', 'N25:N28', 'N25:N18']))
        expect(isValidBusLineSegmentPlacement(selfLine, ['N29', 'N28'], otherLines)).toBe(true)
    })

    it('applies fallback per endpoint so one deadlocked end can still continue', () => {
        const selfLine: BusNodeId[] = ['N01', 'N05']
        const otherLines: BusNodeId[][] = [
            ['N01', 'N05', 'N02', 'N04'],
            ['N01', 'N05', 'N08', 'N04'],
            ['N01', 'N05', 'N09', 'N14'],
            ['N01', 'N05', 'N10', 'N08']
        ]

        const segments = validBusLineExtensionSegments(selfLine, otherLines)
        const segmentKeys = new Set(segments.map(([source, target]) => `${source}:${target}`))

        // N01 still has primary legal options.
        expect(segmentKeys).toEqual(
            new Set([
                'N01:N03',
                'N01:N07',
                'N01:N09',
                // N05 has no primary legal options, so fallback keeps it extendable.
                'N05:N02',
                'N05:N08',
                'N05:N09',
                'N05:N10'
            ])
        )
    })
})
