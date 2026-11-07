import { describe, expect, it } from 'vitest'
import type { SpaceId } from '../data/board.js'
import type { LandscapeKind, TileId } from '../data/regionTiles.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { fillLandscape } from '../model/landscapes.js'
import { landscapeTender, placeMarker } from '../model/locationControl.js'
import { collectTileOf, giveGood, setUp, spaceOfKind } from '../testing/improving.js'
import { tableAtPlayingCards, type Table } from '../testing/table.js'
import { collectLandscapesOffer, collectLandscapesPreview } from './collectLandscapes.js'
import { tendLandscapeOffers, tendLandscapePreview } from './tendLandscape.js'

interface Tending {
    readonly table: Table
    readonly playerId: string
    readonly rulerId: string
    readonly spaceId: SpaceId
    readonly tileId: TileId
}

/** The seat asked is serf under the next seat, holding a wood and a collected tile. */
function tending(landscape: LandscapeKind, wood = 1): Tending {
    const table = tableAtPlayingCards(() => ({ cards: ['improve', 'move', 'tax', 'guild'] }))
    const playerId = table.asked
    const rulerId = table.order[1]
    const spaceId = spaceOfKind(table.hydrated(), 'farm')
    let tileId: TileId = 'tile.sea.i'
    setUp(table, (state) => {
        placeMarker(state, rulerId, spaceId)
        placeMarker(state, playerId, spaceId)
        state.recomputeRanks()
        giveGood(state, playerId, 'wood', wood)
        tileId = collectTileOf(state, playerId, landscape)
    })
    return { table, playerId, rulerId, spaceId, tileId }
}

function tend({ table, playerId, spaceId, tileId }: Tending, collect: boolean, more = {}) {
    return table.send(playerId, {
        type: ActionType.TendLandscape,
        tileId,
        spaceId,
        collect,
        ...more
    })
}

describe('R-3.9.3 Tend Landscape', () => {
    it('S17 turns in a wood, places the tile back side up, scores 2 vp and fills with 3', () => {
        const start = tending('orchard')
        const { table, playerId, spaceId, tileId } = start
        const before = table.hydrated()
        const seatBefore = before.getPlayerState(playerId)
        const { food, wood } = before.supply.haversack
        const { score } = seatBefore

        const [action] = tend(start, false)

        const after = table.hydrated()
        const seat = after.getPlayerState(playerId)
        const space = after.spaces[spaceId]
        expect(space.landscape).toEqual({ tileId, amount: 3 })
        expect(landscapeTender(space)).toBe(playerId)
        expect(seat.regionTiles).toEqual([])
        expect(seat.goods.wood).toBe(0)
        expect(seat.score).toBe(score + 2)
        expect(after.supply.haversack.wood).toBe(wood + 1)
        expect(after.supply.haversack.food).toBe(food - 3)
        expect(seat.played).toEqual([{ kind: 'improve', use: 'special' }])
        expect(action).toMatchObject({
            metadata: { landscape: 'orchard', filled: 3, vp: 2, rankChanges: [] }
        })
        expect(action).not.toHaveProperty('metadata.collected')
    })

    it('R-3.2 passes the turn, and R-X.2 is not a barrier', () => {
        const start = tending('orchard')
        const [action] = tend(start, true)
        expect(start.table.state.machineState).toBe(MachineState.PlayingCards)
        expect(start.table.asked).toBe(start.table.order[1])
        expect(action.revealsInfo).toBeFalsy()
    })

    it('R-3.4 needs a wood', () => {
        const start = tending('orchard', 0)
        expect(() => tend(start, false)).toThrow('Tend Landscape needs a wood.')
    })

    it('needs the tile collected', () => {
        const start = tending('orchard')
        expect(() => tend({ ...start, tileId: 'tile.mountain.iv' }, false)).toThrow(
            "You haven't collected that tile."
        )
    })

    it('R-3.9.3 only where the seat is serf', () => {
        const start = tending('orchard')
        const { table, playerId } = start
        const free = spaceOfKind(table.hydrated(), 'outpost')
        expect(() => tend({ ...start, spaceId: free }, false)).toThrow("You aren't the serf there.")
        setUp(table, (state) => {
            placeMarker(state, playerId, free)
        })
        expect(() => tend({ ...start, spaceId: free }, false)).toThrow("You aren't the serf there.")
    })

    it('R-4.3.4 one landscape per space, never replaced', () => {
        const start = tending('orchard')
        const { table, spaceId } = start
        setUp(table, (state) => {
            const taken = state.regionStacks.mountain.shift()
            if (taken) {
                state.tileLandscapes[taken] = state.requireVault().tileLandscapes[taken]
                delete state.requireVault().tileLandscapes[taken]
                state.spaces[spaceId].landscape = { tileId: taken, amount: 0 }
            }
        })
        expect(() => tend(start, false)).toThrow('That location already has a landscape.')
    })

    it('R-3.15.2 replays only by Déjà Vu, for a saltpeter on top of the wood', () => {
        const table = tableAtPlayingCards(
            () => ({ cards: ['improve', 'repeat', 'move', 'tax'] }),
            2
        )
        const playerId = table.asked
        const other = table.order[1]
        const ruled = spaceOfKind(table.hydrated(), 'farm')
        const spaceId = spaceOfKind(table.hydrated(), 'farm', [ruled])
        setUp(table, (state) => {
            placeMarker(state, playerId, ruled)
            placeMarker(state, other, spaceId)
            placeMarker(state, playerId, spaceId)
            state.recomputeRanks()
            giveGood(state, playerId, 'wood')
        })
        table.send(playerId, {
            type: ActionType.Improve,
            spaceId: ruled,
            discId: 'disc.double.1'
        })
        table.send(other, { type: ActionType.ForfeitCard, kind: 'move' })
        const [tileId] = table.seat(playerId).regionTiles
        const move = { type: ActionType.TendLandscape, tileId, spaceId, collect: false }

        expect(() => table.send(playerId, { ...move, asRepeat: 'repeat' })).toThrow(
            'Improve has no x2: only Déjà Vu replays it.'
        )
        table.send(playerId, { ...move, asRepeat: 'deja-vu' })

        expect(table.hydrated().spaces[spaceId].landscape).toEqual({ tileId, amount: 3 })
        expect(table.seat(playerId).played.at(-1)).toMatchObject({
            kind: 'repeat',
            replayedKind: 'improve',
            dejaVu: true
        })
    })
})

describe('R-4.3.4 filled and collected at once', () => {
    it('food: two to the seat, one to the ruler', () => {
        const start = tending('orchard')
        const { table, playerId, rulerId, spaceId } = start
        const before = table.hydrated()
        const seatFood = before.getPlayerState(playerId).goods.food
        const rulerFood = before.getPlayerState(rulerId).goods.food

        const [action] = tend(start, true)

        const after = table.hydrated()
        expect(after.getPlayerState(playerId).goods.food).toBe(seatFood + 2)
        expect(after.getPlayerState(rulerId).goods.food).toBe(rulerFood + 1)
        expect(after.spaces[spaceId].landscape?.amount).toBe(0)
        expect(action).toMatchObject({
            metadata: { filled: 3, collected: { kept: 2, paid: 1, rulerId } }
        })
    })

    it('silver mine: shillings', () => {
        const start = tending('silver-mine')
        const before = start.table.hydrated()
        const seat = before.getPlayerState(start.playerId).shillings
        const ruler = before.getPlayerState(start.rulerId).shillings
        const { shillings } = before.supply

        tend(start, true)

        const after = start.table.hydrated()
        expect(after.getPlayerState(start.playerId).shillings).toBe(seat + 2)
        expect(after.getPlayerState(start.rulerId).shillings).toBe(ruler + 1)
        expect(after.supply.shillings).toBe(shillings - 3)
    })

    it('sulfur mine: sulfur to goods, not the barrel', () => {
        const start = tending('sulfur-mine')
        const before = start.table.hydrated()
        const seat = before.getPlayerState(start.playerId)
        const sulfur = seat.goods.sulfur
        const { barrel } = seat
        const ruler = before.getPlayerState(start.rulerId).goods.sulfur

        tend(start, true)

        const after = start.table.hydrated()
        expect(after.getPlayerState(start.playerId).goods.sulfur).toBe(sulfur + 2)
        expect(after.getPlayerState(start.playerId).barrel).toBe(barrel)
        expect(after.getPlayerState(start.rulerId).goods.sulfur).toBe(ruler + 1)
    })

    it('archery butt: targets become markers from the general supply, the targets go back', () => {
        const start = tending('archery-butt')
        const { table, playerId, rulerId } = start
        const before = table.hydrated()
        const seat = before.getPlayerState(playerId)
        const ruler = before.getPlayerState(rulerId)
        const seatMarkers = seat.influenceSupply
        const rulerMarkers = ruler.influenceSupply
        const seatGeneral = before.supply.influence[seat.color]
        const rulerGeneral = before.supply.influence[ruler.color]
        const { targets } = before.supply

        const [action] = tend(start, true)

        const after = table.hydrated()
        expect(after.getPlayerState(playerId).influenceSupply).toBe(seatMarkers + 2)
        expect(after.getPlayerState(rulerId).influenceSupply).toBe(rulerMarkers + 1)
        expect(after.supply.influence[seat.color]).toBe(seatGeneral - 2)
        expect(after.supply.influence[ruler.color]).toBe(rulerGeneral - 1)
        expect(after.supply.targets).toBe(targets)
        expect(action).toMatchObject({
            metadata: { collected: { kept: 2, paid: 1, seatMarkers: 2, rulerMarkers: 1 } }
        })
    })

    it('left, an archery butt holds its targets out of the supply', () => {
        const start = tending('archery-butt')
        const { targets } = start.table.hydrated().supply
        tend(start, false)
        const after = start.table.hydrated()
        expect(after.supply.targets).toBe(targets - 3)
        expect(after.spaces[start.spaceId].landscape?.amount).toBe(3)
    })

    it('R-4.3.4 markers short: never from the Knight Guild, the excess targets discarded', () => {
        const start = tending('archery-butt')
        const { table, playerId } = start
        let held = 0
        setUp(table, (state) => {
            const seat = state.getPlayerState(playerId)
            seat.influenceSupply += state.supply.influence[seat.color] - 1
            state.supply.influence[seat.color] = 1
            held = seat.influenceSupply
        })
        const knights = JSON.stringify(table.hydrated().guilds.knight)
        const { targets } = table.hydrated().supply

        const [action] = tend(start, true)

        const after = table.hydrated()
        const seat = after.getPlayerState(playerId)
        expect(seat.influenceSupply).toBe(held + 1)
        expect(after.supply.influence[seat.color]).toBe(0)
        expect(after.supply.targets).toBe(targets)
        expect(JSON.stringify(after.guilds.knight)).toBe(knights)
        expect(action).toMatchObject({ metadata: { collected: { kept: 2, seatMarkers: 1 } } })
    })

    it('R-4.5.2 a marker gained lets a seat with stars join its guild', () => {
        const start = tending('archery-butt')
        const { table, playerId } = start
        setUp(table, (state) => {
            const seat = state.getPlayerState(playerId)
            state.supply.influence[seat.color] += seat.influenceSupply
            seat.influenceSupply = 0
            seat.pawns[1].character = 'monk'
            seat.pawns[1].spaceId = 'space.desert.3'
        })
        const [action] = tend(start, true)
        expect(action).toMatchObject({
            metadata: { rankChanges: [{ guildId: 'monk', playerId, to: 'master' }] }
        })
    })

    it('R-1.1-H1 a short haversack fills what remains; a lone resource goes to the ruler', () => {
        const start = tending('orchard')
        const { table, playerId, rulerId } = start
        setUp(table, (state) => {
            const short = state.supply.haversack.food - 1
            giveGood(state, playerId, 'food', short)
        })
        const before = table.hydrated()
        const seatFood = before.getPlayerState(playerId).goods.food
        const rulerFood = before.getPlayerState(rulerId).goods.food

        const [action] = tend(start, true)

        const after = table.hydrated()
        expect(after.getPlayerState(playerId).goods.food).toBe(seatFood)
        expect(after.getPlayerState(rulerId).goods.food).toBe(rulerFood + 1)
        expect(action).toMatchObject({ metadata: { filled: 1, collected: { kept: 0, paid: 1 } } })
    })

    it('R-1.1-H1 fills count on top of what a landscape holds', () => {
        const start = tending('orchard')
        tend(start, false)
        const state = start.table.hydrated()
        expect(fillLandscape(state, start.spaceId)).toBe(3)
        expect(state.spaces[start.spaceId].landscape?.amount).toBe(6)
    })
})

describe('R-3.9.3 tend offers', () => {
    it('S17 names the tiles by landscape and the serf spaces with none', () => {
        const start = tending('silver-mine')
        const { table, playerId, spaceId, tileId } = start
        expect(tendLandscapeOffers(table.hydrated(), playerId)).toEqual({
            tiles: [{ tileId, landscape: 'silver-mine', resource: 'shillings' }],
            spaceIds: [spaceId]
        })
        expect(tendLandscapeOffers(table.hydrated(), start.rulerId)).toEqual({
            tiles: [],
            spaceIds: []
        })
    })

    it('R-3.4 offers nothing without a wood, as the Action refuses it', () => {
        const { table, playerId } = tending('silver-mine')
        setUp(table, (state) => {
            state.supply.haversack.wood += state.getPlayerState(playerId).goods.wood
            state.getPlayerState(playerId).goods.wood = 0
        })
        expect(tendLandscapeOffers(table.hydrated(), playerId)).toEqual({
            tiles: [],
            spaceIds: []
        })
    })

    it('S17 previews the fill and the split on a copy', () => {
        const start = tending('silver-mine')
        const state = start.table.hydrated()
        const before = JSON.stringify(state.dehydrate())
        expect(tendLandscapePreview(state, start.tileId, start.spaceId)).toEqual({
            filled: 3,
            collected: { kept: 2, paid: 1, rulerId: start.rulerId },
            sulfurKept: 0,
            sulfurToBarrel: 0
        })
        expect(JSON.stringify(state.dehydrate())).toBe(before)
    })
})

describe('R-4.3.4, R-4.12.3 CollectLandscapes', () => {
    /** The seat tends a landscape under the next seat, filled once, and is asked to collect. */
    function asked(kinds: readonly LandscapeKind[]) {
        const table = tableAtPlayingCards(() => ({ cards: ['improve', 'move', 'tax', 'guild'] }))
        const playerId = table.asked
        const rulerId = table.order[1]
        const spaceIds: SpaceId[] = []
        table.moveTo((state) => {
            for (const kind of kinds) {
                const spaceId = spaceOfKind(state, 'farm', spaceIds)
                spaceIds.push(spaceId)
                placeMarker(state, rulerId, spaceId)
                placeMarker(state, playerId, spaceId)
                const tileId = collectTileOf(state, playerId, kind)
                const seat = state.getPlayerState(playerId)
                seat.regionTiles = seat.regionTiles.filter((held) => held !== tileId)
                state.spaces[spaceId].landscape = { tileId, amount: 0 }
                fillLandscape(state, spaceId)
            }
            state.recomputeRanks()
            state.flow.turn = undefined
            state.flow.landscapes = { pending: [playerId, rulerId] }
            return MachineState.CollectingLandscapes
        })
        return { table, playerId, rulerId, spaceIds }
    }

    const Collect = { type: ActionType.CollectLandscapes } as const

    it('S55 collects the one named, leaves the other, 1 of it to the ruler', () => {
        const { table, playerId, rulerId, spaceIds } = asked(['orchard', 'silver-mine'])
        const [orchard, mine] = spaceIds
        const food = table.seat(playerId).goods.food
        const rulerFood = table.seat(rulerId).goods.food

        const [action] = table.send(playerId, { ...Collect, spaceIds: [orchard] })

        expect(table.seat(playerId).goods.food).toBe(food + 2)
        expect(table.seat(rulerId).goods.food).toBe(rulerFood + 1)
        expect(table.hydrated().spaces[orchard].landscape?.amount).toBe(0)
        expect(table.hydrated().spaces[mine].landscape?.amount).toBe(3)
        expect(action).toMatchObject({
            metadata: {
                collections: [
                    {
                        spaceId: orchard,
                        landscape: 'orchard',
                        collected: { kept: 2, paid: 1, rulerId }
                    }
                ]
            }
        })
        expect(action.revealsInfo).toBeFalsy()
    })

    it('R-4.12.3 may leave all, and D12 the next serf is asked', () => {
        const { table, playerId, rulerId, spaceIds } = asked(['orchard'])

        table.send(playerId, { ...Collect, spaceIds: [] })

        expect(table.hydrated().spaces[spaceIds[0]].landscape?.amount).toBe(3)
        expect(table.asked).toBe(rulerId)
        expect(table.offered(rulerId)).toEqual([ActionType.CollectLandscapes])
        expect(table.offered(playerId)).toEqual([])
    })

    it('D12 no serf is asked once all have answered', () => {
        const { table, playerId, rulerId } = asked(['orchard'])
        table.send(playerId, { ...Collect, spaceIds: [] })
        table.send(rulerId, { ...Collect, spaceIds: [] })

        expect(table.state.activePlayerIds).toEqual([])
        expect(table.hydrated().flow.landscapes).toBeUndefined()
    })

    it('R-4.3.4 targets become markers from the general supply; excess is discarded', () => {
        const { table, playerId, rulerId, spaceIds } = asked(['archery-butt'])
        table.moveTo((state) => {
            const seat = state.getPlayerState(playerId)
            seat.influenceSupply += state.supply.influence[seat.color] - 1
            state.supply.influence[seat.color] = 1
            return MachineState.CollectingLandscapes
        })
        const held = table.seat(playerId).influenceSupply
        const rulerHeld = table.seat(rulerId).influenceSupply
        const { targets } = table.hydrated().supply

        const [action] = table.send(playerId, { ...Collect, spaceIds })

        const after = table.hydrated()
        expect(table.seat(playerId).influenceSupply).toBe(held + 1)
        expect(table.seat(rulerId).influenceSupply).toBe(rulerHeld + 1)
        expect(after.supply.targets).toBe(targets + 3)
        expect(action).toMatchObject({
            metadata: { collections: [{ collected: { kept: 2, seatMarkers: 1, rulerMarkers: 1 } }] }
        })
    })

    it('R-4.3.4 a resource alone goes to the ruler', () => {
        const { table, playerId, rulerId, spaceIds } = asked(['orchard'])
        table.moveTo((state) => {
            const landscape = state.spaces[spaceIds[0]].landscape
            if (landscape) {
                state.supply.haversack.food += landscape.amount - 1
                landscape.amount = 1
            }
            return MachineState.CollectingLandscapes
        })
        const food = table.seat(playerId).goods.food
        const rulerFood = table.seat(rulerId).goods.food

        table.send(playerId, { ...Collect, spaceIds })

        expect(table.seat(playerId).goods.food).toBe(food)
        expect(table.seat(rulerId).goods.food).toBe(rulerFood + 1)
    })

    it('R-4.12.3 refuses out of turn, a space not tended, an empty landscape, a repeat', () => {
        const { table, playerId, rulerId, spaceIds } = asked(['orchard'])
        const [orchard] = spaceIds
        const send = (spaces: SpaceId[]) => () =>
            table.send(playerId, { ...Collect, spaceIds: spaces })

        expect(() => table.send(rulerId, { ...Collect, spaceIds: [] })).toThrow()
        expect(send([orchard, orchard])).toThrow('Name each landscape once.')
        expect(send([spaceOfKind(table.hydrated(), 'farm', spaceIds)])).toThrow(
            "You don't tend a landscape there."
        )
        table.moveTo((state) => {
            const landscape = state.spaces[orchard].landscape
            if (landscape) {
                state.supply.haversack.food += landscape.amount
                landscape.amount = 0
            }
            return MachineState.CollectingLandscapes
        })
        expect(send([orchard])).toThrow('That landscape holds nothing.')
    })

    it('S55 offers the tended landscapes with resources, each with its split, on a copy', () => {
        const { table, playerId, rulerId, spaceIds } = asked(['orchard', 'sulfur-mine'])
        const state = table.hydrated()
        const before = JSON.stringify(state.dehydrate())

        expect(collectLandscapesOffer(state, playerId)).toMatchObject({
            spaces: expect.arrayContaining([
                {
                    spaceId: spaceIds[0],
                    landscape: 'orchard',
                    resource: 'food',
                    amount: 3,
                    collected: { kept: 2, paid: 1, rulerId }
                }
            ]),
            sulfurToBarrel: 2
        })
        expect(collectLandscapesOffer(state, rulerId)).toBeUndefined()
        expect(JSON.stringify(state.dehydrate())).toBe(before)
    })

    it('S55 previews the picks on a copy; a staged input names what refuses', () => {
        const { table, playerId, spaceIds } = asked(['orchard'])
        const state = table.hydrated()

        expect(collectLandscapesPreview(state, playerId, { spaceIds }).collections).toHaveLength(1)
        expect(
            collectLandscapesPreview(state, playerId, { spaceIds: [spaceIds[0], spaceIds[0]] })
                .refused
        ).toBe('Name each landscape once.')
    })
})
