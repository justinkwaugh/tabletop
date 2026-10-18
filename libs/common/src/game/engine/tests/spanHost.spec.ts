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
        expect(summary(waiting.mainLine?.processedActions ?? [])).toEqual(['closeBranch:p2'])
        expect(waiting.unmergedBranch?.branch.closed).toBe(true)
        expect(host.game.activePlayerIds).toEqual(['p3', 'p1'])

        const merged = host.submit(spanAction('f3', 'finish', 'p3'))
        expect(summary(merged.mainLine?.processedActions ?? [])).toEqual([
            'closeBranch:p3',
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
        expect(host.undoInBranch('p2', 'w2').unmergedBranch?.branch.actionCount).toBe(1)
        expect(host.unmergedBranch('p2')?.actions).toHaveLength(1)
    })

    it('reopens a Closed Branch and takes its Branch Close off the Main Line', () => {
        const host = new SpanHost()
        host.submit(spanAction('begin', 'begin', 'p1'))
        host.submit(spanAction('f2', 'finish', 'p2'))
        expect(summary(host.actions)).toEqual(['begin:p1', 'closeBranch:p2'])
        const undone = host.undoInBranch('p2', 'f2')
        expect(undone.unmergedBranch?.branch.closed).toBe(false)
        expect(undone.replay).toEqual({ startIndex: 1, actions: [] })
        expect(summary(host.actions)).toEqual(['begin:p1'])
        expect(host.game.activePlayerIds).toEqual(['p3', 'p2', 'p1'])
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

    describe('Common Actions', () => {
        const offer = (id: string, proposerId: string, partnerId: string) =>
            spanAction(id, 'propose', proposerId, { partnerId, itemId: `start-${proposerId}` })

        it('runs one on the Main Line even when its Player has an open Branch', () => {
            const host = new SpanHost()
            host.submit(spanAction('begin', 'begin', 'p1'))
            host.submit(spanAction('w2', 'work', 'p2'))
            const response = host.submit(offer('o2', 'p2', 'p3'))
            expect(summary(response.mainLine?.processedActions ?? [])).toEqual(['propose:p2'])
            expect(response.unmergedBranch).toBeUndefined()
            expect(summary(host.actions)).toEqual(['begin:p1', 'propose:p2'])
            expect(host.state.offers.o2).toMatchObject({ proposerId: 'p2', partnerId: 'p3' })
            expect(host.unmergedBranch('p2')?.branch.actionCount).toBe(2)
            expect(host.game.activePlayerIds).toEqual(['p3', 'p2', 'p1'])
        })

        it('checks the acting Player’s side against their stored Branch', () => {
            const host = new SpanHost()
            host.submit(spanAction('begin', 'begin', 'p1'))
            host.submit(spanAction('d2', 'drop', 'p2', { itemId: 'start-p2' }))
            expect(() => host.submit(offer('o2', 'p2', 'p3'))).toThrow(
                'not valid in state branching'
            )
            expect(summary(host.actions)).toEqual(['begin:p1'])
        })

        it('records one raced by a Branch Close after it, and answers with what it raced', () => {
            const host = new SpanHost()
            host.submit(spanAction('begin', 'begin', 'p1'))
            const position = host.state.actionCount
            host.submit(spanAction('f1', 'finish', 'p1'))
            const response = host.submit({ ...offer('o2', 'p2', 'p3'), index: position })
            expect(summary(response.raced ?? [])).toEqual(['closeBranch:p1'])
            expect(response.mainLine?.processedActions[0].index).toBe(2)
            expect(summary(host.actions)).toEqual(['begin:p1', 'closeBranch:p1', 'propose:p2'])
        })

        it('refuses one raced by a Branch Close that made it lapse', () => {
            const host = new SpanHost()
            host.submit(spanAction('begin', 'begin', 'p1'))
            const position = host.state.actionCount
            host.submit(spanAction('f3', 'finish', 'p3'))
            expect(() => host.submit({ ...offer('o2', 'p2', 'p3'), index: position })).toThrow(
                'was raced'
            )
        })

        it('undoes a Player’s own latest Common Action and replays the closes that followed', () => {
            const host = new SpanHost()
            host.submit(spanAction('begin', 'begin', 'p1'))
            host.submit(offer('o2', 'p2', 'p3'))
            host.submit(spanAction('f1', 'finish', 'p1'))
            expect(() => host.undo('p3', 'o2')).toThrow('may not undo')
            const undone = host.undo('p2', 'o2')
            expect(undone.undoneActionIds).toEqual(['o2'])
            expect(summary(undone.replay.actions)).toEqual(['closeBranch:p1'])
            expect(undone.replay.startIndex).toBe(1)
            expect(summary(host.actions)).toEqual(['begin:p1', 'closeBranch:p1'])
            expect(host.state.offers).toEqual({})
        })
    })
})
