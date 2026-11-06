import { describe, expect, it } from 'vitest'
import { Routes, Spaces, type Route, type RouteId } from '../data/board.js'
import { MonsterIds } from '../data/components.js'
import { initialState } from '../testing/state.js'
import {
    FerryFare,
    ferriesOpen,
    isPinned,
    monsterMayUse,
    monsterReaches,
    monsterSteps,
    pawnRouteOptions,
    pawnSteps,
    pinningMonsters,
    routeBetween,
    routeEnd,
    routesAt
} from './media.js'
import { payShillingsToSupply } from './supply.js'
import { vesselCounts } from './stateSchemas.js'

function route(id: RouteId): Route {
    const found = Routes.find((candidate) => candidate.id === id)
    if (!found) throw new Error(`no route ${id}`)
    return found
}

const Road = route('route.road.forest-1--forest-2')
const Ship = route('route.ship.sea-1--forest-1')
const Submersible = route('route.submersible.sea-1--forest-1')
const Flying = route('route.flying-machine.island-2--desert-1')
const Ferry = route('route.ferry.island-1--forest-2')

function withPawn(spaceId: Route['a']) {
    const state = initialState()
    const player = state.getPlayerState('p1')
    player.pawns[0].spaceId = spaceId
    player.pawns[0].character = 'farmer'
    return { state, player, pawn: player.pawns[0] }
}

describe('R-1.2.2 route lookups', () => {
    it('finds every route from both of its ends', () => {
        for (const candidate of Routes) {
            expect(routesAt(candidate.a)).toContain(candidate)
            expect(routesAt(candidate.b)).toContain(candidate)
            expect(routeEnd(candidate, candidate.a)).toBe(candidate.b)
            expect(routeEnd(candidate, candidate.b)).toBe(candidate.a)
        }
    })

    it('finds a route by its ends and medium, either way round', () => {
        expect(routeBetween('space.forest.1', 'space.sea.1', 'ship')).toBe(Ship)
        expect(routeBetween('space.sea.1', 'space.forest.1', 'submersible')).toBe(Submersible)
        expect(routeBetween('space.sea.1', 'space.forest.1', 'road')).toBeUndefined()
    })
})

describe('R-4.2.1 roads', () => {
    it('take any pawn, on foot or leaving a vessel', () => {
        const { state, pawn } = withPawn(Road.a)
        expect(pawnRouteOptions(state, 'p1', 1, Road)).toEqual([{ route: Road, to: Road.b }])
        pawn.vessel = 'ship'
        expect(pawnRouteOptions(state, 'p1', 1, Road)).toEqual([{ route: Road, to: Road.b }])
    })
})

describe('R-4.2.2 a vessel route needs that vessel', () => {
    it.each([
        { routeOf: Ship, vessel: 'ship' },
        { routeOf: Submersible, vessel: 'submersible' },
        { routeOf: Flying, vessel: 'flying-machine' }
    ] as const)('$vessel', ({ routeOf, vessel }) => {
        const { state, player, pawn } = withPawn(routeOf.a)

        expect(pawnRouteOptions(state, 'p1', 1, routeOf)).toEqual([])

        pawn.vessel = vessel
        expect(pawnRouteOptions(state, 'p1', 1, routeOf)).toEqual([
            { route: routeOf, to: routeOf.b }
        ])

        pawn.vessel = undefined
        player.vessels[vessel] = 1
        expect(pawnRouteOptions(state, 'p1', 1, routeOf)).toEqual([
            { route: routeOf, to: routeOf.b, vessel: 'place' }
        ])

        player.vessels[vessel] = 0
        state.spaces[routeOf.a].vessels = vesselCounts({ [vessel]: 1 })
        expect(pawnRouteOptions(state, 'p1', 1, routeOf)).toEqual([
            { route: routeOf, to: routeOf.b, vessel: 'board' }
        ])

        player.vessels[vessel] = 1
        expect(pawnRouteOptions(state, 'p1', 1, routeOf)).toEqual([
            { route: routeOf, to: routeOf.b, vessel: 'board' },
            { route: routeOf, to: routeOf.b, vessel: 'place' }
        ])
    })

    it("another type of vessel doesn't take the route", () => {
        const { state, player, pawn } = withPawn(Ship.a)
        pawn.vessel = 'submersible'
        player.vessels.submersible = 2
        state.spaces[Ship.a].vessels = vesselCounts({ 'flying-machine': 1 })
        expect(pawnRouteOptions(state, 'p1', 1, Ship)).toEqual([])
    })

    it('a pawn may change vessels to continue', () => {
        const { state, player, pawn } = withPawn(Ship.a)
        pawn.vessel = 'submersible'
        player.vessels.ship = 1
        expect(pawnRouteOptions(state, 'p1', 1, Ship)).toEqual([
            { route: Ship, to: Ship.b, vessel: 'place' }
        ])
    })

    it('a vessel left on the other end of the route does not help', () => {
        const { state } = withPawn(Ship.a)
        state.spaces[Ship.b].vessels = vesselCounts({ ship: 1 })
        expect(pawnRouteOptions(state, 'p1', 1, Ship)).toEqual([])
    })
})

describe('R-4.2.3 ferries', () => {
    it('are open only while the Alchemist Guild has no vessel for sale', () => {
        const state = initialState()
        state.guilds.alchemist.vesselsForSale = ['ship']
        expect(ferriesOpen(state)).toBe(false)
        state.guilds.alchemist.vesselsForSale = []
        expect(ferriesOpen(state)).toBe(true)
    })

    it('take any pawn for 2 shillings', () => {
        const { state, player, pawn } = withPawn(Ferry.a)
        state.guilds.alchemist.vesselsForSale = []
        player.shillings = FerryFare
        const option = { route: Ferry, to: Ferry.b, ferry: true }

        expect(FerryFare).toBe(2)
        expect(pawnRouteOptions(state, 'p1', 1, Ferry)).toEqual([option])
        pawn.vessel = 'ship'
        expect(pawnRouteOptions(state, 'p1', 1, Ferry)).toEqual([option])
    })

    it('are refused while a vessel is for sale, or without the fare', () => {
        const { state, player } = withPawn(Ferry.a)
        player.shillings = FerryFare
        state.guilds.alchemist.vesselsForSale = ['submersible']
        expect(pawnRouteOptions(state, 'p1', 1, Ferry)).toEqual([])

        state.guilds.alchemist.vesselsForSale = []
        player.shillings = FerryFare - 1
        expect(pawnRouteOptions(state, 'p1', 1, Ferry)).toEqual([])
    })

    it('the fare goes to the general supply', () => {
        const { state, player } = withPawn(Ferry.a)
        state.supply.shillings = 0
        player.shillings = FerryFare
        payShillingsToSupply(state, 'p1', FerryFare)
        expect(state.supply.shillings).toBe(FerryFare)
        expect(player.shillings).toBe(0)
    })

    it('never take a monster', () => {
        for (const monster of MonsterIds) {
            expect(monsterMayUse(monster, Ferry)).toBe(false)
        }
    })
})

describe('R-4.2.4 monsters', () => {
    it.each([
        { monster: 'behemoth', routeOf: Road, may: true },
        { monster: 'behemoth', routeOf: Flying, may: true },
        { monster: 'behemoth', routeOf: Ship, may: false },
        { monster: 'behemoth', routeOf: Submersible, may: false },
        { monster: 'sea-serpent', routeOf: Ship, may: true },
        { monster: 'sea-serpent', routeOf: Submersible, may: true },
        { monster: 'sea-serpent', routeOf: Road, may: false },
        { monster: 'sea-serpent', routeOf: Flying, may: false }
    ] as const)('$monster on $routeOf.medium: $may', ({ monster, routeOf, may }) => {
        expect(monsterMayUse(monster, routeOf)).toBe(may)
    })

    it('step along what they may use, from where they stand', () => {
        const state = initialState()
        expect(monsterSteps(state, 'behemoth')).toEqual([])

        state.monsters['sea-serpent'] = { playerId: 'p1', spaceId: 'space.forest.1' }
        const steps = monsterSteps(state, 'sea-serpent')
        expect(steps.length).toBeGreaterThan(0)
        for (const step of steps) {
            expect(['ship', 'submersible']).toContain(step.route.medium)
            expect(routesAt('space.forest.1')).toContain(step.route)
            expect(step.to).toBe(routeEnd(step.route, 'space.forest.1'))
        }

        state.monsters.behemoth = { playerId: 'p1', spaceId: 'space.mountain.1' }
        expect(monsterSteps(state, 'behemoth').map((step) => step.to)).toEqual([
            'space.mountain.2',
            'space.mountain.2',
            'space.badlands.2'
        ])
    })

    it('R-4.6.3 the sea serpent deploys to a port', () => {
        for (const space of Spaces) {
            expect(monsterReaches('sea-serpent', space.id), space.id).toBe(space.port)
        }
    })

    it('R-4.6.3 the behemoth deploys where a road or flying-machine route reaches', () => {
        for (const space of Spaces) {
            const reached = Routes.some(
                (candidate) =>
                    (candidate.medium === 'road' || candidate.medium === 'flying-machine') &&
                    (candidate.a === space.id || candidate.b === space.id)
            )
            expect(monsterReaches('behemoth', space.id), space.id).toBe(reached)
        }
    })
})

describe('R-4.2.4 pinning', () => {
    it("an opponent's monster on the space pins a pawn", () => {
        const { state } = withPawn(Road.a)
        expect(isPinned(state, 'p1', 1)).toBe(false)

        state.monsters.behemoth = { playerId: 'p2', spaceId: Road.a }

        expect(isPinned(state, 'p1', 1)).toBe(true)
        expect(pinningMonsters(state, 'p1', Road.a)).toEqual(['behemoth'])
        expect(pawnRouteOptions(state, 'p1', 1, Road)).toEqual([])
        expect(pawnSteps(state, 'p1', 1)).toEqual([])
    })

    it("the player's own monster does not", () => {
        const { state } = withPawn(Road.a)
        state.monsters.behemoth = { playerId: 'p1', spaceId: Road.a }
        expect(isPinned(state, 'p1', 1)).toBe(false)
        expect(pawnRouteOptions(state, 'p1', 1, Road)).toHaveLength(1)
    })

    it('a monster elsewhere does not, and a monster leaving lets the pawn go', () => {
        const { state } = withPawn(Road.a)
        state.monsters.behemoth = { playerId: 'p2', spaceId: Road.b }
        expect(isPinned(state, 'p1', 1)).toBe(false)

        state.monsters.behemoth = { playerId: 'p2', spaceId: Road.a }
        expect(isPinned(state, 'p1', 1)).toBe(true)
        state.monsters.behemoth = { playerId: 'p2', spaceId: Road.b }
        expect(isPinned(state, 'p1', 1)).toBe(false)
    })

    it('a pawn off the board is never pinned, and has no steps', () => {
        const state = initialState()
        state.monsters.behemoth = { playerId: 'p2', spaceId: 'space.forest.1' }
        expect(isPinned(state, 'p1', 1)).toBe(false)
        expect(pawnSteps(state, 'p1', 1)).toEqual([])
    })

    it('a pawn may walk onto a monster, and stops there', () => {
        const { state, pawn } = withPawn(Road.a)
        state.monsters.behemoth = { playerId: 'p2', spaceId: Road.b }
        expect(pawnSteps(state, 'p1', 1).map((step) => step.to)).toContain(Road.b)
        pawn.spaceId = Road.b
        expect(pawnSteps(state, 'p1', 1)).toEqual([])
    })

    it('R-4.2.4 nothing pins a monster', () => {
        const { state } = withPawn('space.mountain.1')
        state.monsters.behemoth = { playerId: 'p2', spaceId: 'space.mountain.1' }
        expect(monsterSteps(state, 'behemoth').length).toBeGreaterThan(0)
    })
})

describe('R-4.2 the steps from a pawn', () => {
    it('lists each route it may take from its space', () => {
        const { state, player } = withPawn('space.forest.2')
        state.guilds.alchemist.vesselsForSale = ['ship']
        const roads = () => pawnSteps(state, 'p1', 1).map((step) => step.route.id)

        expect(roads()).toEqual([
            'route.road.forest-1--forest-2',
            'route.road.forest-2--forest-3',
            'route.road.forest-2--badlands-1'
        ])

        state.guilds.alchemist.vesselsForSale = []
        player.shillings = FerryFare
        expect(roads()).toContain('route.ferry.island-1--forest-2')
    })
})
