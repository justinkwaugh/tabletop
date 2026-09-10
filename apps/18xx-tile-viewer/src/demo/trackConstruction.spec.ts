import { expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import { Definition as Top, TheOldPrinceTrackRules } from '@tabletop/the-old-prince'
import { Definition as Shikoku, Shikoku1889TrackRules } from '@tabletop/shikoku-1889'
import {
    TrackConstruction,
    cashOwnedBy,
    type TrackLayDetails,
    type LayTile,
    type FinanceExampleState,
    type FinishTrack
} from '@tabletop/18xx'
import { example } from './stockTestUtils.js'
const Titles = [
    { definition: Top, rules: TheOldPrinceTrackRules },
    { definition: Shikoku, rules: Shikoku1889TrackRules }
]
function lay(state: FinanceExampleState, details: TrackLayDetails): LayTile {
    const { companyId, locationId, definitionId, rotation, nodeMapping, cost } = details
    return {
        id: `lay-${state.actionCount}`,
        type: 'LayTile',
        gameId: state.gameId,
        playerId: state.activePlayerIds[0],
        source: ActionSource.User,
        companyId,
        locationId,
        definitionId,
        rotation,
        nodeMapping,
        expectedCost: cost
    }
}
function first<T>(value: readonly T[]): T {
    if (!value.length) throw new Error('Expected a legal choice')
    return value[0]
}
it.each(Titles)(
    'commits $definition.info.id upgrades, preserves stations, returns tiles and replays/undoes',
    ({ definition, rules }) => {
        const { game, engine, state } = example(definition, 'construction')
        const locationId = definition === Top ? 'L16' : 'E2'
        const construction = new TrackConstruction(state, rules)
        const before = structuredClone(state)
        const details = first(construction.choices(locationId))
        expect(state).toEqual(before)
        const action = lay(state, details)
        const result = engine.executeCanonicalAction({ game, state, action })
        expect(result.processedActions.map((action) => action.type)).toEqual(['LayTile'])
        expect(result.updatedState.tileInventory.placements[locationId]).toEqual(details.placement)
        expect(result.updatedState.stations).toEqual(state.stations)
        expect(result.updatedState.trackStep?.lays).toHaveLength(1)
        if (details.previous)
            expect(
                rules.tileSet
                    .availablePieces(
                        result.updatedState.tileInventory,
                        details.previous.definitionId
                    )
                    .some((piece) => piece.id === details.previous?.pieceId)
            ).toBe(true)
        expect(new TrackConstruction(result.updatedState, rules).choices(locationId)).toEqual([])
        expect(
            engine.applyProcessedAction({ game, state, action: result.processedActions[0] })
        ).toEqual(result.updatedState)
        expect(
            engine.undoProcessedAction({
                state: result.updatedState,
                action: result.processedActions[0]
            })
        ).toEqual(state)
        expect(engine.executeCanonicalAction({ game, state, action }).updatedState).toEqual(
            result.updatedState
        )
        expect(() =>
            engine.executeCanonicalAction({ game, state, action: { ...action, playerId: 'casey' } })
        ).toThrow()
        const staleCost: LayTile = { ...action, expectedCost: action.expectedCost + 1 }
        expect(() => engine.executeCanonicalAction({ game, state, action: staleCost })).toThrow()
    }
)
it('charges TOP’s optional second yellow lay and rejects a third or an upgrade afterwards', () => {
    const { game, engine, state } = example(Top, 'construction')
    const initial = new TrackConstruction(state, TheOldPrinceTrackRules)
    const firstLay = first(
        initial
            .choices('K17')
            .filter((choice) => choice.definitionId === '18xx:8' && choice.rotation === 2)
    )
    const result = engine.executeCanonicalAction({ game, state, action: lay(state, firstLay) })
    const next = new TrackConstruction(result.updatedState, TheOldPrinceTrackRules)
    expect(next.choices('L16')).toEqual([])
    const secondLay = first(
        TheOldPrinceTrackRules.map.definition.locations.flatMap((location) =>
            next
                .choices(location.id)
                .filter(
                    (choice) =>
                        !choice.consentPlayerId ||
                        choice.consentPlayerId === state.activePlayerIds[0]
                )
        )
    )
    expect(secondLay.allowanceCost).toBe(20)
    const after = engine.executeCanonicalAction({
        game,
        state: result.updatedState,
        action: lay(result.updatedState, secondLay)
    })
    expect(cashOwnedBy(after.updatedState, { kind: 'company', companyId: 'ML' })).toBe(
        Number(cashOwnedBy(state, { kind: 'company', companyId: 'ML' })) -
            firstLay.cost -
            secondLay.cost
    )
    const final = new TrackConstruction(after.updatedState, TheOldPrinceTrackRules)
    expect(
        TheOldPrinceTrackRules.map.definition.locations.flatMap((location) =>
            final.choices(location.id)
        )
    ).toEqual([])
})
it('charges 1889 terrain to its treasury and rejects overspending and unavailable physical pieces', () => {
    const { game, engine, state } = example(Shikoku, 'construction')
    const construction = new TrackConstruction(state, Shikoku1889TrackRules)
    const details = first(construction.choices('E4'))
    expect(details.terrainCost).toBe(80)
    const result = engine.executeCanonicalAction({ game, state, action: lay(state, details) })
    expect(cashOwnedBy(result.updatedState, { kind: 'company', companyId: 'IR' })).toBe(520)
    expect(cashOwnedBy(result.updatedState, { kind: 'bank' })).toBe(6200)
    const poor = structuredClone(state)
    const cash = poor.cash.find(
        (cash) => cash.owner.kind === 'company' && cash.owner.companyId === 'IR'
    )!
    cash.amount = 79
    expect(new TrackConstruction(poor, Shikoku1889TrackRules).evaluate(details).reason).toContain(
        'afford'
    )
    const exhausted = structuredClone(state)
    exhausted.tileInventory.retiredPieceIds.push(
        ...Shikoku1889TrackRules.tileSet
            .availablePieces(state.tileInventory, details.definitionId)
            .map((piece) => piece.id)
    )
    expect(
        new TrackConstruction(exhausted, Shikoku1889TrackRules).evaluate(details).reason
    ).toContain('supply')
})
it('rejects missing track, bad labels, unavailable phase colors, remote construction and forbidden fixed exits', () => {
    const { state } = example(Top, 'construction')
    const construction = new TrackConstruction(state, TheOldPrinceTrackRules)
    const upgrade = first(construction.choices('L16'))
    expect(
        construction.evaluate({ ...upgrade, definitionId: 'the-old-prince:PEI1' }).reason
    ).toContain('labels')
    const early = { ...state, phaseId: '3H' }
    expect(new TrackConstruction(early, TheOldPrinceTrackRules).evaluate(upgrade).reason).toContain(
        'color'
    )
    expect(
        construction.evaluate({
            ...upgrade,
            locationId: 'L14',
            definitionId: '18xx:7',
            nodeMapping: {},
            rotation: 0
        }).details
    ).toBeUndefined()
    expect(
        construction.evaluate({ ...upgrade, definitionId: 'the-old-prince:PEI6', rotation: 1 })
            .reason
    ).toContain('preserved')
    const { state: s } = example(Shikoku, 'construction')
    const c = new TrackConstruction(s, Shikoku1889TrackRules)
    expect(
        c.evaluate({
            companyId: 'IR',
            locationId: 'D3',
            definitionId: '18xx:7',
            rotation: 2,
            nodeMapping: {}
        }).reason
    ).toMatch(/fixed|off the map/)
})
it('allows 1889 home construction without a placed station and keeps its reservation', () => {
    const { game, engine, state } = example(Shikoku, 'construction')
    state.stations = state.stations.filter((station) => station.companyId !== 'IR')
    state.stationReservations.push({ companyId: 'IR', locationId: 'E2', nodeId: 'city' })
    const choices = new TrackConstruction(state, Shikoku1889TrackRules)
    expect(choices.choices('D3')).toEqual([])
    const details = first(choices.choices('E2'))
    const after = engine.executeCanonicalAction({
        game,
        state,
        action: lay(state, details)
    }).updatedState
    expect(after.stationReservations).toEqual(state.stationReservations)
    expect(after.stations).toEqual(state.stations)
})
it.each(Titles)(
    'finishes $definition.info.id track without placing and supports undo',
    ({ definition }) => {
        const { game, engine, state } = example(definition, 'construction')
        const action: FinishTrack = {
            id: 'finish',
            gameId: state.gameId,
            source: ActionSource.User,
            type: 'FinishTrack',
            playerId: state.activePlayerIds[0],
            companyId: state.trackStep!.companyId
        }
        const result = engine.executeCanonicalAction({ game, state, action })
        expect(result.updatedState.machineState).toBe('PlacingStation')
        expect(result.processedActions.map((action) => action.type)).toEqual(['FinishTrack'])
        expect(result.updatedState.stationStep).toEqual({
            companyId: state.trackStep!.companyId,
            placedStationIds: [],
            completed: false
        })
        expect(result.updatedState.tileInventory).toEqual(state.tileInventory)
        expect(
            engine.applyProcessedAction({ game, state, action: result.processedActions[0] })
        ).toEqual(result.updatedState)
        expect(
            engine.undoProcessedAction({
                state: result.updatedState,
                action: result.processedActions[0]
            })
        ).toEqual(state)
        expect(() =>
            engine.executeCanonicalAction({ game, state: result.updatedState, action })
        ).toThrow()
    }
)
it('respects private rights independently of ordinary topology checks', () => {
    const { state } = example(Top, 'construction')
    const request = {
        companyId: 'ML',
        locationId: 'N18',
        definitionId: '18xx:7',
        rotation: 0 as const,
        nodeMapping: {}
    }
    expect(TheOldPrinceTrackRules.consentPlayerId!(state, request)).toBe('casey')
    expect(
        TheOldPrinceTrackRules.restriction(state, {
            ...request,
            locationId: 'K17',
            definitionId: '18xx:9'
        })
    ).toContain('Schreiber')
    state.companies.find((company) => company.id === 'VR')!.closed = true
    expect(TheOldPrinceTrackRules.consentPlayerId!(state, request)).toBeUndefined()
    const { state: s } = example(Shikoku, 'construction')
    expect(
        Shikoku1889TrackRules.restriction(s, { ...request, companyId: 'IR', locationId: 'K4' })
    ).toContain('blocks')
    expect(
        Shikoku1889TrackRules.restriction(s, {
            ...request,
            companyId: 'IR',
            definitionId: '18xx:437'
        })
    ).toContain('port')
})

it('flips paired faces as one physical piece and migrates renamed stations and reservations', async () => {
    const { TileSet, TileCatalog, StandardTileCatalog } = await import('@tabletop/18xx')
    const { state } = example(Shikoku, 'construction')
    const yellow = Shikoku1889TrackRules.tileSet.definitions.find((tile) => tile.id === '18xx:5')!
    const green = Shikoku1889TrackRules.tileSet.definitions.find((tile) => tile.id === '18xx:12')!
    const renamed = new TileCatalog([
        {
            ...green,
            id: 'custom:green',
            face: {
                ...green.face,
                nodes: green.face.nodes.map((node) => ({ ...node, id: 'renamed' })),
                paths: green.face.paths.map((path) => ({
                    ...path,
                    endpoints: [
                        path.endpoints[0].kind === 'node'
                            ? { ...path.endpoints[0], nodeId: 'renamed' }
                            : path.endpoints[0],
                        path.endpoints[1].kind === 'node'
                            ? { ...path.endpoints[1], nodeId: 'renamed' }
                            : path.endpoints[1]
                    ]
                }))
            }
        }
    ])
    const tileSet = new TileSet(
        {
            id: 'paired',
            entries: [{ id: 'piece', faceDefinitionIds: [yellow.id, 'custom:green'], count: 1 }]
        },
        [StandardTileCatalog, renamed]
    )
    state.tileInventory = tileSet.createInventory([
        { locationId: 'E2', definitionId: yellow.id, rotation: 0 }
    ])
    state.stationReservations.push({ companyId: 'AR', locationId: 'E2', nodeId: 'city' })
    const construction = new TrackConstruction(state, { ...Shikoku1889TrackRules, tileSet })
    const details = first(construction.choices('E2'))
    expect(details.placement.pieceId).toBe(state.tileInventory.placements.E2.pieceId)
    expect(details.stations.find((station) => station.id === 'IR:home')).toMatchObject({
        position: { nodeId: 'renamed', slot: 0 }
    })
    expect(
        details.stationReservations.find((reservation) => reservation.locationId === 'E2')?.nodeId
    ).toBe('renamed')
    const after = construction.inventoryAfter(details)
    expect(Object.values(after.placements)).toHaveLength(1)
    expect(tileSet.counts(after).every((count) => count.available === 0)).toBe(true)
})
it('rejects TOP’s O17 upgrade when its new branch requires reversing at the hex edge', () => {
    const { game, engine, state } = example(Top, 'construction')
    state.tileInventory = TheOldPrinceTrackRules.tileSet.createInventory([
        ...Object.entries(state.tileInventory.placements).map(([locationId, tile]) => ({
            locationId,
            definitionId: tile.definitionId,
            rotation: tile.rotation
        })),
        { locationId: 'N18', definitionId: '18xx:29', rotation: 2 },
        { locationId: 'O17', definitionId: '18xx:7', rotation: 0 }
    ])
    const request = {
        companyId: 'ML',
        locationId: 'O17',
        definitionId: '18xx:30',
        rotation: 0,
        nodeMapping: {}
    } as const
    const construction = new TrackConstruction(state, TheOldPrinceTrackRules)
    expect(construction.evaluate(request).reason).toContain('connected track')
    expect(
        construction
            .choices('O17')
            .some(
                (choice) =>
                    choice.definitionId === request.definitionId &&
                    choice.rotation === request.rotation
            )
    ).toBe(false)
    const action: LayTile = {
        ...request,
        id: 'invalid-o17-upgrade',
        type: 'LayTile',
        source: ActionSource.User,
        playerId: state.activePlayerIds[0],
        gameId: state.gameId,
        expectedCost: 0
    }
    expect(() => engine.executeCanonicalAction({ game, state, action })).toThrow()
})
