import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { CoralColor, countColors } from '../components/colors.js'
import { HydratedReefEncounterPlayerState, newPlayerState } from './playerState.js'

function player(): HydratedReefEncounterPlayerState {
    const state = newPlayerState('a', Color.Red, countColors([CoralColor.Pink, CoralColor.Grey]))
    state.knownSupplyPolyps = countColors([CoralColor.Pink])
    state.secretParrotfishPolyps = countColors([CoralColor.White])
    state.knownParrotfishPolyps = countColors([CoralColor.White, CoralColor.Yellow])
    return new HydratedReefEncounterPlayerState(state)
}

describe('what a viewer can see of a player', () => {
    it('adds the secret polyps when the viewer may see them', () => {
        const owner = player()
        expect(owner.visibleSupplyPolyps()).toEqual(
            countColors([CoralColor.Pink, CoralColor.Pink, CoralColor.Grey])
        )
        expect(owner.visibleParrotfishPolyps()).toEqual(
            countColors([CoralColor.White, CoralColor.White, CoralColor.Yellow])
        )
        expect(owner.getSupplyPolyps()).toEqual(owner.visibleSupplyPolyps())
    })

    it('shows only the known polyps when the secret ones are withheld', () => {
        const other = player()
        other.secretSupplyPolyps = undefined
        other.secretParrotfishPolyps = undefined
        expect(other.visibleSupplyPolyps()).toEqual(countColors([CoralColor.Pink]))
        expect(other.visibleParrotfishPolyps()).toEqual(
            countColors([CoralColor.White, CoralColor.Yellow])
        )
    })

    it('shows nothing when a Concealed game withholds the known polyps too', () => {
        const concealed = player()
        concealed.knownSupplyPolyps = undefined
        concealed.knownParrotfishPolyps = undefined
        expect(concealed.visibleSupplyPolyps()).toBeUndefined()
        expect(concealed.visibleParrotfishPolyps()).toBeUndefined()
    })
})
