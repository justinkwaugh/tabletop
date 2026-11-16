import { describe, expect, it } from 'vitest'
import {
    StationPlacement,
    TrackConstruction,
    finiteCashOwnedBy,
    privateTrackConstruction
} from '@tabletop/18xx'
import { edit, floatCompany, givePrivate, kit, opened, type Table } from '../test/kit.js'
import { PrivatePowerRulesChesapeake } from './privatePowers.js'
import { StationRulesChesapeake } from './stations.js'
import { TileSetChesapeake } from './tiles.js'
import { TrackRulesChesapeake } from './track.js'

/** The PRR's first turn, from Harrisburg (F2), owning the private. */
function prrLaying(privateId: string): Table {
    const game = opened(4)
    floatCompany(game, 'PRR')
    kit.passStockRound(game)
    expect(game.state.trackStep?.companyId).toBe('PRR')
    edit(game, (state) => givePrivate(state, privateId, 'PRR'))
    return game
}

function privateChoices(game: Table, privateId: string, locationId: string) {
    const terms = PrivatePowerRulesChesapeake.trackTerms(game.hydrated, privateId, game.player)
    if (!terms) return []
    return privateTrackConstruction(game.hydrated, terms, TrackRulesChesapeake).choices(locationId)
}

function layPrivate(
    game: Table,
    privateId: string,
    locationId: string,
    definitionId: string,
    edges: readonly number[]
): void {
    const wanted = [...edges].sort().join()
    const choice = privateChoices(game, privateId, locationId).find(
        (entry) =>
            entry.definitionId === definitionId &&
            kit.exits(entry.definitionId, entry.rotation).join() === wanted
    )
    if (!choice) throw new Error(`No ${definitionId} joining ${wanted} in ${locationId}`)
    game.act('LayPrivateTile', {
        privateCompanyId: privateId,
        companyId: choice.companyId,
        locationId,
        definitionId,
        rotation: choice.rotation,
        nodeMapping: choice.nodeMapping,
        expectedCost: choice.cost
    })
}

const treasury = (game: Table) =>
    finiteCashOwnedBy(game.state, { kind: 'company', companyId: 'PRR' })

describe('18Chesapeake privates', () => {
    it('keeps a player-owned private’s hexes closed to track (§7.1)', () => {
        const game = opened(4)
        floatCompany(game, 'PRR')
        kit.passStockRound(game)
        for (const locationId of ['K3', 'H2', 'I3', 'F4', 'G5', 'D2'])
            expect(
                TrackRulesChesapeake.restriction(game.hydrated, {
                    companyId: 'PRR',
                    locationId,
                    definitionId: '18xx:8',
                    rotation: 0,
                    nodeMapping: {}
                })
            ).toMatch(/private/)
    })

    it('lays the Columbia – Philadelphia’s two tiles joined across their shared side, besides the ordinary lay (§7.1 P2)', () => {
        const game = prrLaying('CP')
        // Only tiles reaching the shared side (H2's south-east, I3's north-west) are offered.
        const h2 = privateChoices(game, 'CP', 'H2')
        expect(h2.length).toBeGreaterThan(0)
        expect(
            h2.every((choice) => kit.exits(choice.definitionId, choice.rotation).includes(5))
        ).toBe(true)
        expect(new Set(h2.map((choice) => choice.definitionId))).toEqual(
            new Set(['18xx:8', '18xx:9'])
        )
        const before = treasury(game)
        layPrivate(game, 'CP', 'H2', '18xx:9', [2, 5])
        // The second tile must follow at once.
        expect(game.state.privateTrackLay).toMatchObject({ privateCompanyId: 'CP', required: true })
        expect(game.valid(game.player)).not.toContain('LayTile')
        layPrivate(game, 'CP', 'I3', '18xx:8', [2, 4])
        expect(game.state.privateTrackLay).toBeUndefined()
        expect(treasury(game)).toBe(before)
        // The company's own lay is still to come, and the power is spent.
        expect(game.state.trackStep?.lays).toEqual([])
        expect(PrivatePowerRulesChesapeake.trackTerms(game.hydrated, 'CP', game.player)).toBe(
            undefined
        )
        expect(game.valid(game.player)).toContain('LayTile')
    })

    it('forfeits a two-tile power once anyone else lays a tile in either hex (§7.1 P3)', () => {
        const game = prrLaying('BS')
        expect(
            PrivatePowerRulesChesapeake.trackTerms(game.hydrated, 'BS', game.player)
        ).toBeDefined()
        // Another company's lay in one of the hexes, once a company owns the private.
        edit(game, (state) => {
            const [piece] = TileSetChesapeake.availablePieces(state.tileInventory, '18xx:9')
            state.tileInventory.placements.F4 = {
                pieceId: piece.id,
                definitionId: '18xx:9',
                rotation: 0
            }
        })
        expect(PrivatePowerRulesChesapeake.trackTerms(game.hydrated, 'BS', game.player)).toBe(
            undefined
        )
    })

    it('lays the Canal’s 57 on Berlin as the company’s lay, paying the mountain, then a free station there (§7.1 P4)', () => {
        const game = prrLaying('COC')
        const before = treasury(game)
        layPrivate(game, 'COC', 'D2', '18xx:57', [1, 4])
        expect(treasury(game)).toBe(before - 80)
        expect(new TrackConstruction(game.hydrated, TrackRulesChesapeake).choices('E3')).toEqual([])
        expect(game.state.privateStation).toMatchObject({
            privateCompanyId: 'COC',
            locationId: 'D2'
        })
        game.act('PlacePrivateStation', {
            privateCompanyId: 'COC',
            position: { locationId: 'D2', nodeId: 'city', slot: 0 }
        })
        expect(treasury(game)).toBe(before - 80)
        const placed = game.state.stations.find((station) => station.id === 'PRR:station:1')
        expect(placed).toMatchObject({ status: 'placed', position: { locationId: 'D2' } })
        // The token is the company's station for the turn.
        if (game.state.machineState === 'LayingTrack') game.act('FinishTrack', { companyId: 'PRR' })
        if (game.state.machineState === 'PlacingStation')
            expect(
                new StationPlacement(game.hydrated, StationRulesChesapeake).choices('PRR:station:2')
            ).toEqual([])
    })
})
