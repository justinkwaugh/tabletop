import { describe, expect, it } from 'vitest'
import { TrackConstruction, finiteCashOwnedBy } from '@tabletop/18xx'
import { edit, floatCompany, kit, opened } from '../test/kit.js'
import { TrackRules1882 } from './track.js'

/** The Canadian Northern's first turn, from Prince Albert (D8). */
function northernLaying() {
    const game = opened(4)
    floatCompany(game, 'CNoR')
    kit.passStockRound(game)
    expect(game.state.trackStep?.companyId).toBe('CNoR')
    return game
}
const treasury = (game: ReturnType<typeof opened>) =>
    finiteCashOwnedBy(game.state, { kind: 'company', companyId: 'CNoR' })
const trestleOwner = (game: ReturnType<typeof opened>) => {
    const owner = game.state.certificates.find((entry) => entry.companyId === 'TB')?.owner
    if (owner?.kind !== 'player') throw new Error('A player owns the Trestle Bridge')
    return owner
}

describe('1882 track', () => {
    it('pays $20 for a yellow tile laid in a rebellion hex (§11.3.1)', () => {
        const game = northernLaying()
        const before = treasury(game)
        kit.lay(game, 'E7', '18xx:8', [0, 4])
        expect(treasury(game)).toBe(before + 20)
    })

    it('charges $20 for the second yellow tile in a rebellion hex too, which its bonus repays (BGG 34745384)', () => {
        const game = northernLaying()
        const before = treasury(game)
        const layFirst = (locationId: string, definitionId: string, rotation?: number) => {
            const choice = new TrackConstruction(game.hydrated, TrackRules1882)
                .choices(locationId)
                .find(
                    (entry) =>
                        entry.definitionId === definitionId &&
                        (rotation === undefined || entry.rotation === rotation)
                )
            if (!choice) throw new Error(`No ${definitionId} in ${locationId}`)
            game.act('LayTile', {
                companyId: 'CNoR',
                locationId,
                definitionId,
                rotation: choice.rotation,
                nodeMapping: choice.nodeMapping,
                expectedCost: choice.cost
            })
            return choice.cost
        }
        expect(layFirst('E7', '18xx:7', 3)).toBe(0)
        expect(treasury(game)).toBe(before + 20)
        // D6 is a rebellion hex as well: the second tile still costs $20, and earns $20.
        expect(layFirst('D6', '18xx:57')).toBe(20)
        expect(treasury(game)).toBe(before + 20)
    })

    it('charges a river only for the crossing a lay completes, paying the Trestle Bridge $10 (§7.1.4, §11.3.3)', () => {
        const game = northernLaying()
        const owner = trestleOwner(game)
        const bridgeCash = finiteCashOwnedBy(game.state, owner)
        const before = treasury(game)
        // Laying up to an unbuilt river hexside is free.
        kit.lay(game, 'E7', '18xx:8', [0, 4])
        expect(finiteCashOwnedBy(game.state, owner)).toBe(bridgeCash)
        // The second yellow costs $20; meeting Prince Albert's track across the river costs $40.
        kit.lay(game, 'F8', '18xx:1', [0, 1, 3, 4])
        expect(treasury(game)).toBe(before + 20 - 20 - 40)
        expect(finiteCashOwnedBy(game.state, owner)).toBe(bridgeCash + 10)
    })

    it('allows two yellow tiles, or one upgrade alone (§11.3)', () => {
        const game = northernLaying()
        expect(TrackRules1882.allowance(game.hydrated, 'yellow')).toEqual({ cost: 0 })
        kit.lay(game, 'E7', '18xx:8', [0, 4])
        expect(TrackRules1882.allowance(game.hydrated, 'yellow')).toEqual({ cost: 20 })
        expect(TrackRules1882.allowance(game.hydrated, 'green', true)).toHaveProperty('reason')
        edit(game, (state) => {
            if (state.trackStep)
                state.trackStep.lays = [{ locationId: 'E5', definitionId: '18xx:59' }]
        })
        expect(TrackRules1882.allowance(game.hydrated, 'yellow')).toHaveProperty('reason')
    })

    it('keeps a player-owned private’s hex closed to track (§7.1)', () => {
        const game = northernLaying()
        const request = {
            companyId: 'CNoR',
            locationId: 'C11',
            definitionId: '18xx:57',
            rotation: 0 as const,
            nodeMapping: {}
        }
        expect(TrackRules1882.restriction(game.hydrated, request)).toMatch(/private/)
    })
})
