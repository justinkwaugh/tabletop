import { describe, expect, it } from 'vitest'
import { Minors1861, RsrId } from './companies.js'
import {
    CaucasusLocationIds,
    CentralAsiaLocationIds,
    EkaterinburgLocationId,
    KharkovLocationId,
    Map1861,
    MoscowLocationId,
    PolandLocationIds,
    PrivateBlockedLocationIds,
    RomaniaLocationIds,
    StPetersburgLocationId,
    StPetersburgNodeIds
} from './map.js'
import { Phases1861, revenueStages1861 } from './trains.js'

const location = (id: string) => Map1861.location(id)

function offboardValue(id: string, phaseId: string): number {
    const node = location(id).preprintedTile.nodes[0]
    if (node.kind !== 'offboard' || node.revenue.kind !== 'staged') throw new Error(id)
    const stage = revenueStages1861(phaseId).at(-1)
    const value = node.revenue.values.find((entry) => entry.stage === stage)
    if (!value) throw new Error(`${id} has no ${stage} value`)
    return value.amount
}

describe('the map', () => {
    it('has every hex of the board once', () => {
        const ids = Map1861.definition.locations.map(({ id }) => id)
        expect(ids).toHaveLength(144)
        expect(new Set(ids).size).toBe(ids.length)
    })

    it('reserves each minor’s home station space, and the RSR’s in St. Petersburg (§7.4, §10.5)', () => {
        for (const minor of Minors1861) {
            const reservation = location(minor.home.locationId).reservations?.find(
                ({ companyId }) => companyId === minor.id
            )
            expect(reservation?.nodeId).toBe(minor.home.nodeId)
        }
        expect(Map1861.reservedLocationIds(RsrId)).toEqual([StPetersburgLocationId])
        expect(
            location(StPetersburgLocationId).reservations?.map(({ companyId, nodeId }) => [
                companyId,
                nodeId
            ])
        ).toEqual([
            ['SP-W', StPetersburgNodeIds.west],
            [RsrId, StPetersburgNodeIds.state]
        ])
    })

    it('prints Moscow and Kiev yellow with three stations and St. Petersburg green with two', () => {
        const stations = (id: string) =>
            location(id).preprintedTile.nodes.filter((node) => node.kind === 'city').length
        expect(location(MoscowLocationId).preprintedTile.color).toBe('yellow')
        expect(stations(MoscowLocationId)).toBe(3)
        expect(stations('D14')).toBe(3)
        expect(location(StPetersburgLocationId).preprintedTile.color).toBe('green')
        expect(stations(StPetersburgLocationId)).toBe(2)
    })

    it('values the red areas by phase: lowest, second, third and highest (§10.6)', () => {
        const byPhase = (id: string) =>
            Phases1861.phases.map((phase) => offboardValue(id, phase.id))
        expect(byPhase('A9')).toEqual([30, 40, 40, 50, 70, 70, 70])
        expect(byPhase('B18')).toEqual([10, 20, 20, 30, 30, 30, 30])
        expect(byPhase('J20')).toEqual([10, 20, 20, 40, 60, 60, 60])
        expect(byPhase('Q11')).toEqual([10, 20, 20, 30, 40, 40, 40])
    })

    it('counts each red area once across its hexes (§10.1)', () => {
        for (const group of [
            PolandLocationIds,
            RomaniaLocationIds,
            CaucasusLocationIds,
            CentralAsiaLocationIds
        ]) {
            const stopGroups = new Set(group.map((id) => location(id).stopGroup))
            expect(stopGroups.size).toBe(1)
            expect([...stopGroups][0]).toBeDefined()
        }
        // No track runs from one of an area's hexes into another.
        for (const id of [
            ...PolandLocationIds,
            ...RomaniaLocationIds,
            ...CaucasusLocationIds,
            ...CentralAsiaLocationIds
        ])
            for (const path of location(id).preprintedTile.paths)
                for (const end of path.endpoints)
                    if (end.kind === 'edge')
                        expect(
                            location(Map1861.across(id, end.edge)?.location.id ?? id).preprintedTile
                                .color
                        ).not.toBe('red')
    })

    it('fixes the grey and red hexes, Ekaterinburg among them at R40', () => {
        const fixed = Map1861.definition.locations.filter((entry) => !entry.buildable)
        expect(fixed.map(({ preprintedTile }) => preprintedTile.color).toSorted()).toEqual(
            [...Array(8).fill('gray'), ...Array(11).fill('red')].toSorted()
        )
        const ekaterinburg = location(EkaterinburgLocationId).preprintedTile.nodes[0]
        expect(ekaterinburg).toMatchObject({ kind: 'city', revenue: { kind: 'fixed', amount: 40 } })
    })

    it('prints water at R20, R40 and R80', () => {
        expect(location('C11').terrain).toEqual({ cost: 80, kinds: ['water'] })
        expect(location('F18').terrain?.cost).toBe(40)
        expect(location('K7').terrain?.cost).toBe(20)
        expect(location('H8').terrain).toBeUndefined()
    })

    it('labels Kharkov Y, and Kh from grey', () => {
        expect(location(KharkovLocationId).preprintedTile.labels).toEqual(['Y'])
        expect(location(KharkovLocationId).upgradeLabels).toEqual([{ color: 'gray', label: 'Kh' }])
    })

    it('marks the private companies’ hexes, closed until phase 3', () => {
        expect(PrivateBlockedLocationIds.toSorted()).toEqual(['E3', 'H6', 'I5', 'I9', 'J10'])
        for (const id of PrivateBlockedLocationIds)
            expect(location(id).markers?.[0].privateCompanyId).toBeDefined()
    })
})
