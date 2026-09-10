import { expect, it } from 'vitest'
import {
    chooseTrackLocation,
    chooseTrackTile,
    chooseTrackPlacement,
    backFromTrack
} from './trackSelection.js'
import type { TrackRequest } from '@tabletop/18xx'
const choice: TrackRequest = {
    companyId: 'A',
    locationId: 'B2',
    definitionId: '18xx:7',
    rotation: 2,
    nodeMapping: {}
}
it('Back unwinds manual placement, tile and location, skipping a single auto placement', () => {
    const location = chooseTrackLocation('B2')
    const tile = chooseTrackTile(location, '18xx:7', [choice, { ...choice, rotation: 3 }])
    expect(tile.placement).toBeUndefined()
    expect(backFromTrack(chooseTrackPlacement(tile, choice))).toEqual(tile)
    expect(backFromTrack(tile)).toEqual(location)
    expect(backFromTrack(location)).toEqual({})
    const automatic = chooseTrackTile(location, '18xx:7', [choice])
    expect(automatic.placement?.source).toBe('auto')
    expect(backFromTrack(automatic)).toEqual(location)
    expect(chooseTrackTile(automatic, '18xx:8', []).placement).toBeUndefined()
})
