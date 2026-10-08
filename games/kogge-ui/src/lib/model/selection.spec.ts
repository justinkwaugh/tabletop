import { describe, expect, it } from 'vitest'
import { SailRouteKind } from '@tabletop/kogge'
import {
    TurnTool,
    clearStage,
    hasManualSelection,
    popSelection,
    selectStage,
    stageValue
} from './selection.js'

describe('Kogge staged selection', () => {
    it('clears every later stage when an earlier one is chosen', () => {
        let selection = selectStage({}, 'sailRoute', { kind: SailRouteKind.Route, slot: 1 })
        selection = selectStage(selection, 'payment', [{ kind: 'marker', value: 3 }])
        selection = selectStage(selection, 'tool', TurnTool.Trade)
        expect(stageValue(selection, 'tool')).toBe(TurnTool.Trade)
        expect(stageValue(selection, 'sailRoute')).toBeUndefined()
        expect(stageValue(selection, 'payment')).toBeUndefined()
    })

    it('pops the highest manual stage on Undo', () => {
        let selection = selectStage({}, 'tool', TurnTool.ChangeRoute)
        selection = selectStage(selection, 'routeSlot', 0)
        selection = popSelection(selection)
        expect(stageValue(selection, 'routeSlot')).toBeUndefined()
        expect(stageValue(selection, 'tool')).toBe(TurnTool.ChangeRoute)
        selection = popSelection(selection)
        expect(hasManualSelection(selection)).toBe(false)
    })

    it('clears a stage and those after it', () => {
        let selection = selectStage({}, 'bid', [4, 4])
        selection = clearStage(selection, 'bid')
        expect(hasManualSelection(selection)).toBe(false)
    })
})
