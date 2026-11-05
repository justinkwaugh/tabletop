import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType, PalaceColor, Tower, WallSide } from '@tabletop/medina'
import { describe, expect, it } from 'vitest'
import { describeAction } from './describeAction.js'

const base = { id: 'a', gameId: 'g', source: ActionSource.User, playerId: 'p0' }

function line<T extends GameAction>(action: T) {
    return describeAction(action, (playerId) => playerId.toUpperCase())
}

describe('describing an action', () => {
    it('names a palace started or added to', () => {
        const action = {
            ...base,
            type: ActionType.PlaceBuilding,
            color: PalaceColor.Orange,
            coords: { x: 1, y: 1 }
        }
        expect(line({ ...action, metadata: { palaceId: 'x', startedPalace: true } })?.text).toBe(
            'Started an orange palace'
        )
        expect(line({ ...action, metadata: { palaceId: 'x', startedPalace: false } })?.text).toBe(
            'Added to the orange palace'
        )
    })

    it('reports what a claim earned', () => {
        const described = line({
            ...base,
            type: ActionType.PlaceRooftop,
            coords: { x: 1, y: 1 },
            neutral: false,
            metadata: {
                palaceId: 'x',
                color: PalaceColor.Purple,
                size: 5,
                teaTiles: 3,
                buildingsReturned: false,
                awards: {
                    palaceOwnerId: 'p0',
                    palaceTile: PalaceColor.Purple,
                    towers: [Tower.NorthWest],
                    merchants: 3
                }
            }
        })
        expect(described?.text).toBe(
            'Claimed a purple palace of 5, the purple palace tile, tower tile 1, 3 merchants and 3 tea tiles'
        )
        expect(described?.notes).toEqual([])
    })

    it('calls a merchant added, unless it starts a street', () => {
        const action = { ...base, type: ActionType.PlaceMerchant, coords: { x: 1, y: 1 } }
        expect(line({ ...action, metadata: { newStreet: false } })?.text).toBe('Added a merchant')
        expect(line({ ...action, metadata: { newStreet: true } })?.text).toBe(
            'Started a new market street'
        )
    })

    it('names the tower a wall grew from', () => {
        expect(
            line({
                ...base,
                type: ActionType.PlaceWall,
                side: WallSide.North,
                position: 0,
                metadata: { tower: Tower.NorthWest }
            })?.text
        ).toBe('Extended the wall from tower 1')
    })

    it('joins a tile to the placement that claimed it', () => {
        const stable = (palaceOwnerId: string | undefined) =>
            line({
                ...base,
                type: ActionType.PlaceStable,
                coords: { x: 2, y: 2 },
                metadata: {
                    palaceId: 'x',
                    color: PalaceColor.Grey,
                    awards: { palaceOwnerId, towers: [Tower.SouthEast], merchants: 0 }
                }
            })?.text
        expect(stable('p0')).toBe('Added a stable to the grey palace and claimed tower tile 2')
        expect(stable('p3')).toBe('Added a stable to the grey palace and P3 claimed tower tile 2')
        expect(stable(undefined)).toBe(
            'Added a stable to the grey palace and the neutral palace claimed tower tile 2'
        )
    })

    it('leaves out actions that are not placements', () => {
        expect(line({ ...base, type: 'somethingElse' })).toBeUndefined()
    })
})
