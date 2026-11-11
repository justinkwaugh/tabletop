import { describe, expect, it } from 'vitest'
import { setStagedSelectionValue } from '@tabletop/frontend-components'
import { RailroadId } from '@tabletop/south-african-railroads'
import {
    BuildStageOrder,
    clearFirstLink,
    hasManualBuildSelection,
    popBuildSelection,
    selectBuildRailroad,
    selectFirstLink
} from './selection.js'

describe('South African Railroads build selection', () => {
    it('throws for a stage outside the stage order', () => {
        expect(() =>
            setStagedSelectionValue<Record<string, string>, string>(
                {},
                BuildStageOrder,
                'notAStage',
                'x',
                'manual'
            )
        ).toThrow(/does not exist in stage order/)
    })

    it('clears the first link when the railroad changes', () => {
        let selection = selectFirstLink(selectBuildRailroad({}, RailroadId.CSAR), 'link')
        selection = selectBuildRailroad(selection, RailroadId.CdFM)
        expect(selection.railroad?.value).toBe(RailroadId.CdFM)
        expect(selection.firstLink).toBeUndefined()
    })

    it('pops the first link, then the railroad', () => {
        let selection = selectFirstLink(selectBuildRailroad({}, RailroadId.CSAR), 'link')
        selection = popBuildSelection(selection)
        expect(selection.firstLink).toBeUndefined()
        expect(selection.railroad?.value).toBe(RailroadId.CSAR)

        selection = popBuildSelection(selection)
        expect(hasManualBuildSelection(selection)).toBe(false)
    })

    it('clears only the first link on request', () => {
        const selection = clearFirstLink(
            selectFirstLink(selectBuildRailroad({}, RailroadId.CSAR), 'link')
        )
        expect(selection.firstLink).toBeUndefined()
        expect(selection.railroad?.value).toBe(RailroadId.CSAR)
    })
})
