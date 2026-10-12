import { describe, expect, it } from 'vitest'
import { Visibility } from '../../../index.js'
import { spanAction, summary } from './spanGame.js'
import { SpanHost } from './spanHost.js'

describe('The in-memory host for the span fixture', () => {
    it('creates every Branch when the span begins and keeps private play off the Main Line', () => {
        const host = new SpanHost()
        const begun = host.submit(spanAction('begin', 'begin', 'p1'))
        expect(summary(begun.mainLine?.processedActions ?? [])).toEqual(['begin:p1'])
        expect(summary(begun.unmergedBranch?.actions ?? [])).toEqual(['openBranch:p1'])
        expect(host.unmergedBranch('p2')?.branch.actionCount).toBe(1)

        const worked = host.submit(spanAction('w2', 'work', 'p2'))
        expect(worked.mainLine).toBeUndefined()
        expect(summary(worked.unmergedBranch?.actions ?? [])).toEqual(['work:p2'])
        expect(host.state.actionCount).toBe(1)
        expect(host.game.activePlayerIds).toEqual(['p3', 'p2', 'p1'])
    })

    it('merges in Merge Order and ends with the history a Local Game would have', () => {
        const host = new SpanHost()
        host.submit(spanAction('begin', 'begin', 'p1'))
        const waiting = host.submit(spanAction('f2', 'finish', 'p2'))
        expect(waiting.mainLine).toBeUndefined()
        expect(waiting.unmergedBranch?.branch.closed).toBe(true)
        expect(host.game.activePlayerIds).toEqual(['p3', 'p1'])

        const merged = host.submit(spanAction('f3', 'finish', 'p3'))
        expect(summary(merged.mainLine?.processedActions ?? [])).toEqual([
            'openBranch:p3',
            'finish:p3',
            'openBranch:p2',
            'finish:p2'
        ])
        expect(merged.unmergedBranch).toBeUndefined()

        host.submit(spanAction('f1', 'finish', 'p1'))
        expect(host.state.machineState).toBe('scoring')
        expect(summary(host.actions).at(-1)).toBe('complete:')
    })

    it('reverses a Player’s own Branch Action', () => {
        const host = new SpanHost()
        host.submit(spanAction('begin', 'begin', 'p1'))
        host.submit(spanAction('w2', 'work', 'p2'))
        expect(host.undoInBranch('p2', 'w2').branch.actionCount).toBe(1)
        expect(host.unmergedBranch('p2')?.actions).toHaveLength(1)
    })

    it('gives a Branch’s Player their own Branch with host-only values projected away', () => {
        const host = new SpanHost()
        host.submit(spanAction('begin', 'begin', 'p1'))
        host.submit(spanAction('r2', 'roll', 'p2'))
        const record = host.unmergedBranch('p2')
        if (record === undefined || host.runtime.visibility === undefined) throw Error('No Branch')
        const projected = Visibility.projectUnmergedBranch({
            game: host.game,
            state: host.state,
            ...record,
            visibility: host.runtime.visibility
        })
        expect(summary(projected.actions)).toEqual(['openBranch:p2', 'roll:p2'])
        expect(JSON.stringify(projected)).toContain('rolls')
        expect(JSON.stringify(projected)).not.toContain('"rules"')
    })
})
