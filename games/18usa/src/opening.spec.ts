import { describe, expect, it } from 'vitest'
import { cashOwnedBy, privateOwner } from '@tabletop/18xx'
import { kit, type Table } from '../test/kit.js'
import {
    EighteenUSAPrivateCatalog,
    EighteenUSATileSet,
    MetropolisCandidates,
    RedAreas,
    SubsidyCityIds,
    SubsidyPrivateIds,
    guaranteedPrivateIds,
    isSubsidyPrivate
} from './index.js'

function lots(game: Table): string[] {
    return game.state.companies
        .filter((company) => company.kind === 'private' && !isSubsidyPrivate(company.id))
        .map((company) => company.id)
}

describe('random setup', () => {
    it.each([2, 4, 5, 7])(
        'deals %i players their privates, metropolises and red areas',
        (count) => {
            const game = kit.table(count, 11)
            const privates = lots(game)
            expect(privates).toHaveLength(11 + guaranteedPrivateIds(count).length)
            for (const id of guaranteedPrivateIds(count)) expect(privates).toContain(id)
            const placements = EighteenUSATileSet.parseInventory(
                game.state.tileInventory
            ).placements
            const metropolises = MetropolisCandidates.filter((city) => placements[city.locationId])
            expect(metropolises.map((city) => city.locationId).sort()).toEqual(
                [...game.state.metropolisIds].sort()
            )
            expect(metropolises).toHaveLength(3)
            expect(Object.keys(game.state.citySubsidies).sort()).toEqual([...SubsidyCityIds].sort())
            for (const area of RedAreas)
                for (const locationId of area.locationIds)
                    expect(game.state.tileInventory.dealtRevenues?.[locationId]).toBeDefined()
            expect(game.state.carnegieIds.length).toBe(privates.includes('P10') ? 3 : 0)
        }
    )

    it('keeps the subsidy privates out of the opening auction', () => {
        const game = kit.table(4, 3)
        expect(game.state.selectionAuction?.remainingLotIds).not.toContain(
            SubsidyPrivateIds.boomtown
        )
        expect(game.state.selectionAuction?.remainingLotIds).toEqual(lots(game))
    })
})

describe('private auction', () => {
    it('opens at half the face value, with no seed money, so the winner pays the bid', () => {
        const game = kit.table(3, 5)
        const lotId = 'P1'
        const opener = game.player
        const cash = cashOwnedBy(game.state, { kind: 'player', playerId: opener })
        game.act('NominateLot', { lotId, amount: EighteenUSAPrivateCatalog.faceValue(lotId) / 2 })
        while (game.state.selectionAuction?.bidding) game.act('PassSelectionAuction')
        expect(privateOwner(game.state, lotId)).toEqual({ kind: 'player', playerId: opener })
        expect(cashOwnedBy(game.state, { kind: 'player', playerId: opener })).toBe(
            Number(cash) - EighteenUSAPrivateCatalog.faceValue(lotId) / 2
        )
    })

    it('refuses an opening bid below half the face value', () => {
        const game = kit.table(3, 5)
        expect(() => game.act('NominateLot', { lotId: 'P2', amount: 15 })).toThrow()
    })
})
