import { beforeEach, describe, expect, it } from 'vitest'
import type { SpaceId } from '../data/board.js'
import { canonicalOf, initialState } from '../testing/state.js'
import { conservationBreaks } from './conservation.js'
import type { HydratedFeudumGameState } from './gameState.js'
import { canPlaceMarker, landscapeTender, nextMarkerRole, placeMarker } from './locationControl.js'
import { immunityKey, moveConcealedSeal } from './seals.js'

const space: SpaceId = 'space.forest.2'

describe('location control', () => {
    let state: HydratedFeudumGameState

    beforeEach(() => {
        state = initialState()
    })

    it('R-4.1.2 the first marker is the ruler and comes from the supply', () => {
        expect(placeMarker(state, 'p1', space)).toBe('ruler')
        expect(state.spaces[space].ruler).toEqual({ playerId: 'p1', subject: false })
        expect(state.spaces[space].serf).toBeUndefined()
        expect(state.getPlayerState('p1').influenceSupply).toBe(6)
    })

    it("R-4.1.2 a different player's marker is the serf", () => {
        placeMarker(state, 'p1', space)
        expect(placeMarker(state, 'p2', space)).toBe('serf')
        expect(state.spaces[space].ruler).toEqual({ playerId: 'p1', subject: false })
        expect(state.spaces[space].serf).toEqual({ playerId: 'p2' })
    })

    it("R-4.1.2 the ruler's own second marker is the subject, no serf needed first", () => {
        placeMarker(state, 'p1', space)
        expect(placeMarker(state, 'p1', space)).toBe('subject')
        expect(state.spaces[space].ruler).toEqual({ playerId: 'p1', subject: true })
        expect(state.spaces[space].serf).toBeUndefined()
    })

    it('R-4.1.2 a serf adding a marker becomes ruler with a subject, the old ruler the serf', () => {
        placeMarker(state, 'p1', space)
        placeMarker(state, 'p2', space)
        expect(placeMarker(state, 'p2', space)).toBe('ruler')
        expect(state.spaces[space].ruler).toEqual({ playerId: 'p2', subject: true })
        expect(state.spaces[space].serf).toEqual({ playerId: 'p1' })
        expect(state.ruledSpaceIds('p1')).toEqual([])
        expect(state.ruledSpaceIds('p2')).toEqual([space])
    })

    it('R-4.1.2 nobody is ever both ruler and serf of one space', () => {
        placeMarker(state, 'p1', space)
        placeMarker(state, 'p2', space)
        placeMarker(state, 'p2', space)
        const { ruler, serf } = state.spaces[space]
        expect(ruler?.playerId).not.toBe(serf?.playerId)
    })

    it('R-4.1.1 allows a third marker from the ruler beside a serf', () => {
        placeMarker(state, 'p1', space)
        placeMarker(state, 'p2', space)
        expect(placeMarker(state, 'p1', space)).toBe('subject')
        expect(state.spaces[space].ruler).toEqual({ playerId: 'p1', subject: true })
        expect(state.spaces[space].serf).toEqual({ playerId: 'p2' })
    })

    it('R-4.1.1 refuses a third player', () => {
        placeMarker(state, 'p1', space)
        placeMarker(state, 'p2', space)
        expect(nextMarkerRole(state.spaces[space], 'p3')).toBeUndefined()
        expect(canPlaceMarker(state, 'p3', space)).toBe(false)
        expect(() => placeMarker(state, 'p3', space)).toThrow('R-4.1.1')
    })

    it('R-4.1.1 refuses a third marker from one player', () => {
        placeMarker(state, 'p1', space)
        placeMarker(state, 'p1', space)
        expect(canPlaceMarker(state, 'p1', space)).toBe(false)
        expect(canPlaceMarker(state, 'p2', space)).toBe(true)
    })

    it('R-4.1.1 a space with three markers takes no more', () => {
        placeMarker(state, 'p1', space)
        placeMarker(state, 'p2', space)
        placeMarker(state, 'p1', space)
        for (const playerId of ['p1', 'p2', 'p3']) {
            expect(canPlaceMarker(state, playerId, space)).toBe(false)
        }
    })

    it('R-4.5.2 a player with no marker in supply cannot place one', () => {
        state.getPlayerState('p1').influenceSupply = 0
        expect(canPlaceMarker(state, 'p1', space)).toBe(false)
        expect(() => placeMarker(state, 'p1', space)).toThrow('R-4.1')
    })

    it('R-4.1.3 a landscape belongs to the current serf and follows them', () => {
        state.spaces[space].landscape = { tileId: 'tile.sea.i', amount: 0 }
        expect(landscapeTender(state.spaces[space])).toBeUndefined()
        placeMarker(state, 'p1', space)
        expect(landscapeTender(state.spaces[space])).toBeUndefined()
        placeMarker(state, 'p2', space)
        expect(landscapeTender(state.spaces[space])).toBe('p2')
        placeMarker(state, 'p2', space)
        expect(landscapeTender(state.spaces[space])).toBe('p1')
    })

    it('R-4.1.3 no landscape on the space: nothing to tend', () => {
        placeMarker(state, 'p1', space)
        placeMarker(state, 'p2', space)
        expect(landscapeTender(state.spaces[space])).toBeUndefined()
    })

    it('R-4.1-H1 the seal under a serf stays under that marker, now the subject', () => {
        placeMarker(state, 'p1', space)
        placeMarker(state, 'p2', space)
        moveConcealedSeal(
            state,
            { kind: 'pile' },
            { kind: 'immunity', spaceId: space, role: 'serf' }
        )
        const sealId = state.requireVault().immunitySeals[immunityKey(space, 'serf')]
        placeMarker(state, 'p2', space)
        expect(state.spaces[space].ruler).toEqual({
            playerId: 'p2',
            subject: true,
            subjectImmune: true
        })
        expect(state.spaces[space].serf).toEqual({ playerId: 'p1' })
        expect(state.requireVault().immunitySeals).toEqual({
            [immunityKey(space, 'subject')]: sealId
        })
    })

    it('R-4.1.4 serfs and subjects are not ruled locations', () => {
        placeMarker(state, 'p1', space)
        placeMarker(state, 'p1', space)
        placeMarker(state, 'p2', space)
        expect(state.ruledSpaceIds('p1')).toEqual([space])
        expect(state.ruledSpaceIds('p2')).toEqual([])
    })

    it('R-1.1 keeps every marker counted through placement and promotion', () => {
        placeMarker(state, 'p1', space)
        placeMarker(state, 'p2', space)
        placeMarker(state, 'p2', space)
        expect(conservationBreaks(canonicalOf(state))).toEqual([])
    })
})
