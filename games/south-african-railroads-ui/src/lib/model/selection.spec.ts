import { describe, expect, it } from 'vitest'
import { setStagedSelectionValue } from '@tabletop/frontend-components'
import { RailroadId } from '@tabletop/south-african-railroads'
import { BuildStageOrder, selectBuildRailroad, selectFirstLink } from './selection.js'

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
})
