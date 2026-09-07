import { describe, expect, it } from 'vitest'
import { compareStates, loadRehearsal, runReplay } from './replay.js'

const fixturePath = new URL(
    '../../../../games/fresh-fish/rehearsals/legacy-2025/fixture.mjs',
    import.meta.url
)
const solFixturePath = new URL(
    '../../../../games/sol/rehearsals/legacy-2026/fixture.mjs',
    import.meta.url
)

describe('saved game rehearsal', () => {
    it.each([undefined, 'protected-v3'])(
        'replays the Sol export (%s), retaining its exact final outcome',
        async (variant) => {
            const rehearsal = await loadRehearsal(solFixturePath)
            const result = runReplay(rehearsal, variant)
            expect(result.report.failures).toEqual([])
            expect(result.report.inputs).toBe(494)
            expect(result.report.processedActions).toBe(512)
            expect(result.report.resumeChecks).toBe(variant ? 0 : 494)
            expect(result.report.serializationChecks).toBe(494)
            expect(result.finalState.actionChecksum).toBe(134208168)
            expect(result.finalState.winningPlayerIds).toEqual(['07sMHrXa8s-F4D5hGItFH'])
            if (!variant) expect(result.report.rawDifferencePaths).toEqual([])
        },
        30_000
    )
    it('does not normalize away active Sol effect tracking', async () => {
        const rehearsal = await loadRehearsal(solFixturePath)
        const expected = { ...rehearsal.finalState, actionCount: 101 }
        const actual = structuredClone(expected)
        Reflect.set(actual, 'effectTracking', {
            outerRingLaunches: 1,
            clustersRemaining: 0,
            squeezed: false,
            movementUsed: 0,
            catapultedIds: [],
            fuelRemaining: 0,
            passageGates: []
        })
        expect(compareStates(rehearsal, expected, actual, 'resume').matches).toBe(false)
    })
    it('replays a real completed legacy game and resumes every recorded player position', async () => {
        const rehearsal = await loadRehearsal(fixturePath)
        const result = runReplay(rehearsal)
        expect(result.report.passed).toBe(true)
        expect(result.report.inputs).toBe(158)
        expect(result.report.processedActions).toBe(183)
        expect(result.report.resumeChecks).toBe(158)
        expect(result.finalState.actionChecksum).toBe(-268498726)
        expect(result.finalState.winningPlayerIds).toEqual(['dBdKXpfWyXOEibVmsgGEn'])
    })
    it('rejects an incomplete export before attempting replay', async () => {
        const rehearsal = await loadRehearsal(fixturePath)
        rehearsal.actions.pop()
        expect(() => runReplay(rehearsal)).toThrow('complete history')
    })

    it('reports the exact recorded action that current rules reject', async () => {
        const rehearsal = await loadRehearsal(fixturePath)
        Reflect.set(rehearsal.actions[0], 'coords', [-999, -999])
        const result = runReplay(rehearsal)
        expect(result.report.passed).toBe(false)
        expect(result.report.resumeChecks).toBe(157)
        expect(result.report.failures).toContainEqual(
            expect.objectContaining({
                stage: 'replay',
                index: 0,
                type: 'placeDisk'
            })
        )
    })

    it('runs an explicitly configured protected reconstruction against the recorded outcome', async () => {
        const rehearsal = await loadRehearsal(fixturePath)
        const result = runReplay(rehearsal, 'protected-v3')
        expect(result.report.passed).toBe(true)
        expect(result.initialState.systemVersion).toBe(3)
        expect(result.game.protectedInformation).toBe(true)
        expect(result.report.processedActions).toBe(183)
        expect(result.finalState.winningPlayerIds).toEqual(['dBdKXpfWyXOEibVmsgGEn'])
    })
    it('does not accept an invalid final route as an alternative shortest path', async () => {
        const rehearsal = await loadRehearsal(fixturePath)
        Reflect.get(rehearsal.finalState.players[2], 'stalls')[2].path[0] = [-99, -99]
        const result = runReplay(rehearsal)
        expect(result.report.passed).toBe(false)
        expect(result.report.failures).toContainEqual(
            expect.objectContaining({ stage: 'final-state' })
        )
    })
})
