import { ActionSource, assertExists, type GameAction } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { Regions, Spaces, type SpaceId } from '../data/board.js'
import { Goods, GuildIds } from '../data/components.js'
import {
    AlchemistCartSpaces,
    ChickenSpaces,
    FarmerBarn,
    GuildSetupSpaces,
    MarketSpaces,
    ScrollSpaces,
    type ChickenSpaceId
} from '../data/guilds.js'
import { LandscapeFill } from '../data/regionTiles.js'
import type { Epoch, MapDirection } from '../data/tracks.js'
import { ActionType } from '../definition/actions.js'
import { PhaseName } from '../definition/phases.js'
import { MachineState } from '../definition/states.js'
import { replenishMap } from '../model/dawn.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { placeMarker } from '../model/locationControl.js'
import { goodsTotal } from '../model/collections.js'
import { flipSeal, moveBead } from '../model/seals.js'
import { placeLandscape, playToDawn } from '../testing/dawn.js'
import {
    setBarn,
    setBeads,
    setCarts,
    setFarmGoods,
    setMarket,
    setPawns,
    setRowMarkers,
    setScrolls,
    setSealPile,
    setShillings,
    setVesselsForSale
} from '../testing/guilds.js'
import { giveGood, spaceOfKind } from '../testing/improving.js'
import { typesOf } from '../testing/roundEnd.js'
import { isBeginDawn } from './beginDawn.js'
import { isReplenishGuilds } from './replenishGuilds.js'
import { isReplenishMap } from './replenishMap.js'
import { knightRows, rowSeat } from '../model/knightRows.js'
import { epochAt } from '../testing/state.js'
import { sunray } from '../model/tracks.js'
import { locationKindOf } from '../model/locationDiscs.js'

const SetupChicken = chickenWhere(true)

/** R-1.4-H3 The chicken that takes the setup bead, or one that does not. */
function chickenWhere(setupBead: boolean): ChickenSpaceId {
    const space = ChickenSpaces.find((chicken) => chicken.setupBead === setupBead)
    assertExists(space, 'R-1.4-H3 There is such a chicken')
    return space.id
}

function dawnOf(processed: readonly GameAction[]) {
    const dawn = processed.find((action) => isBeginDawn(action))
    assertExists(dawn?.metadata, 'R-4.12 The dawn ran')
    return dawn.metadata
}

function rowOf(processed: readonly GameAction[], playerId: string) {
    const row = dawnOf(processed).sheet.find((entry) => entry.playerId === playerId)
    assertExists(row, 'R-4.12 Every seat has a row')
    return row
}

function mapGoodsOf(processed: readonly GameAction[]) {
    const action = processed.find((candidate) => isReplenishMap(candidate))
    assertExists(action?.metadata, 'R-4.12.4 The map was replenished')
    return action.metadata.goods
}

function refillOf(processed: readonly GameAction[]) {
    const action = processed.find((candidate) => isReplenishGuilds(candidate))
    assertExists(action?.metadata, 'R-4.12.5 The guilds were refilled')
    return action.metadata
}

/** Keeps this many of each good in the haversack, the rest on the seat; no pawn returns food. */
function drainHaversack(state: HydratedFeudumGameState, order: readonly string[], left: number) {
    for (const playerId of order) {
        setPawns(state, playerId, [])
    }
    state.recomputeRanks()
    for (const good of Goods) {
        giveGood(state, order[0], good, Math.max(state.supply.haversack[good] - left, 0))
    }
}

/** R-1.1 Leaves this many shillings in the supply, the rest with the seat. */
function leaveShillings(state: HydratedFeudumGameState, playerId: string, left: number) {
    const held = state.getPlayerState(playerId).shillings
    setShillings(state, playerId, held + state.supply.shillings - left)
}

function regionSpace(region: (typeof Regions)[number], direction: MapDirection): SpaceId {
    const space = region.spaces.find(({ letters }) => letters.includes(direction))
    assertExists(space, `R-1.2.1 ${region.region} has a ${direction} space`)
    return space.id
}

describe('R-4.12 the dawn follows the roll', () => {
    it('R-4.12 BeginDawn moves the marker, clears the flag and marks the Dawn phase', () => {
        const { table, processed } = playToDawn(2, (state, [ruler, serf]) => {
            placeLandscape(state, { rulerId: ruler, serfId: serf })
        })

        expect(processed.find((action) => isBeginDawn(action))).toMatchObject({
            source: ActionSource.System,
            metadata: { epoch: epochAt(2) }
        })
        expect(table.state.epoch).toBe(epochAt(2))
        expect(table.state.flow.epochTriggered).toBeUndefined()
        expect(table.hydrated().phaseManager.currentPhase?.name).toBe(PhaseName.Dawn)
    })

    const OnToNextRound: { epoch: Exclude<Epoch, 1>; extra: ActionType[] }[] = [
        { epoch: 2, extra: [] },
        { epoch: 3, extra: [ActionType.ReplenishGuilds] },
        { epoch: 4, extra: [] }
    ]

    it.each(OnToNextRound)('R-4.12 epoch $epoch runs on to the next round', ({ epoch, extra }) => {
        const { table, processed } = playToDawn(epoch)

        expect(typesOf(processed)).toEqual([
            ActionType.ForfeitCard,
            ActionType.AdvanceTurn,
            ActionType.NourishPawns,
            ActionType.RollProgressDie,
            ActionType.BeginDawn,
            ActionType.ReplenishMap,
            ...extra,
            ActionType.EndRound,
            ActionType.StartRound
        ])
        expect(table.state.machineState).toBe(MachineState.SelectingHands)
    })

    it('R-4.12, R-6.1-H2 at V the dawn scores and fills, replenishes neither map nor guilds, and the game is scored', () => {
        const { processed, order } = playToDawn(5, (state, [ruler]) => {
            placeLandscape(state, { rulerId: ruler })
        })

        const types = typesOf(processed)
        expect(types).toContain(ActionType.BeginDawn)
        expect(types).not.toContain(ActionType.ReplenishMap)
        expect(types).not.toContain(ActionType.ReplenishGuilds)
        expect(types.at(types.indexOf(ActionType.BeginDawn) + 1)).toBe(ActionType.ScoreGame)
        expect(dawnOf(processed).fills).toHaveLength(1)
        expect(rowOf(processed, order[0]).activeRegions.vp).toBe(1)
    })
})

describe('R-4.12.1 the dawn sheet', () => {
    it.each(GuildIds)('R-4.12.1 %s ranks score 5, 3 and 1', (guild) => {
        const { table, processed, order } = playToDawn(
            2,
            (state, [master, journeyman, apprentice, none]) => {
                setPawns(state, master, [guild, guild, guild])
                setPawns(state, journeyman, [guild, guild])
                setPawns(state, apprentice, [guild])
                setPawns(state, none, [])
                state.recomputeRanks()
            },
            4
        )
        const [master, journeyman, apprentice, none] = order

        expect(rowOf(processed, master).ranks).toEqual([{ guild, rank: 'master', vp: 5 }])
        expect(rowOf(processed, journeyman).ranks).toEqual([{ guild, rank: 'journeyman', vp: 3 }])
        expect(rowOf(processed, apprentice).ranks).toEqual([{ guild, rank: 'apprentice', vp: 1 }])
        expect(rowOf(processed, none).ranks).toEqual([])
        expect(order.map((playerId) => table.seat(playerId).score)).toEqual([5, 3, 1, 0])
    })

    it('R-4.12.1 a tended landscape scores 2 empty, 4 with a resource, read before the fill', () => {
        let empty: SpaceId | undefined
        const { table, processed, order } = playToDawn(2, (state, [ruler, serf]) => {
            empty = placeLandscape(state, { rulerId: ruler, serfId: serf })
            placeLandscape(state, {
                rulerId: ruler,
                serfId: serf,
                filled: true,
                except: [empty]
            })
        })
        const [ruler, serf] = order
        assertExists(empty, 'The landscape was placed')

        expect(rowOf(processed, serf).landscapes).toEqual({ empty: 1, filled: 1, vp: 6 })
        expect(rowOf(processed, ruler).landscapes).toEqual({ empty: 0, filled: 0, vp: 0 })
        expect(table.hydrated().spaces[empty].landscape?.amount).toBe(LandscapeFill)
    })

    it('R-4.12.1 an untended landscape scores nobody', () => {
        const { processed, order } = playToDawn(2, (state, [ruler]) => {
            placeLandscape(state, { rulerId: ruler, filled: true })
        })

        for (const playerId of order) {
            expect(rowOf(processed, playerId).landscapes.vp).toBe(0)
        }
    })

    it.each([
        { regions: 1, vp: 1 },
        { regions: 2, vp: 3 },
        { regions: 3, vp: 5 },
        { regions: 4, vp: 7 },
        { regions: 5, vp: 9 },
        { regions: 6, vp: 11 }
    ])('R-4.12.1 $regions active regions score $vp', ({ regions, vp }) => {
        const active = Regions.slice(0, regions)
        const { processed, order } = playToDawn(2, (state, [playerId]) => {
            for (const region of active) {
                placeMarker(state, playerId, region.spaces[0].id)
            }
        })

        expect(rowOf(processed, order[0]).activeRegions).toEqual({
            regions: active.map(({ region }) => region),
            vp
        })
    })

    it('R-4.12 each row sums what the seat scored, and the score moves by it', () => {
        const { table, processed, order } = playToDawn(2, (state, [ruler, serf]) => {
            setPawns(state, serf, ['monk'])
            state.recomputeRanks()
            placeLandscape(state, { rulerId: ruler, serfId: serf, filled: true })
        })

        const { sheet } = dawnOf(processed)
        expect(sheet.map((row) => row.playerId)).toEqual(order)
        for (const row of sheet) {
            expect(row.total).toBe(
                row.ranks.reduce((sum, rank) => sum + rank.vp, 0) +
                    row.landscapes.vp +
                    row.activeRegions.vp +
                    row.disloyaltyVp
            )
            expect(table.seat(row.playerId).score).toBe(row.total)
        }
        expect(rowOf(processed, order[1]).total).toBeGreaterThan(0)
    })
})

describe('R-4.12.3 the landscapes', () => {
    it('R-4.3.4, R-4.12.3 every landscape gains 3, tended or not', () => {
        const spaces: SpaceId[] = []
        const { table, processed } = playToDawn(3, (state, [ruler, serf]) => {
            spaces.push(placeLandscape(state, { rulerId: ruler, serfId: serf, kind: 'orchard' }))
            spaces.push(
                placeLandscape(state, { rulerId: ruler, kind: 'silver-mine', except: spaces })
            )
        })
        const [tended, untended] = spaces

        expect(table.hydrated().spaces[tended].landscape?.amount).toBe(LandscapeFill)
        expect(table.hydrated().spaces[untended].landscape?.amount).toBe(LandscapeFill)
        expect(dawnOf(processed).fills).toEqual([
            { spaceId: tended, landscape: 'orchard', added: LandscapeFill },
            { spaceId: untended, landscape: 'silver-mine', added: LandscapeFill }
        ])
    })

    it('R-4.12-H1, R-1.1-H1 short of a resource, the fill follows turn order, not the map', () => {
        const spaces: SpaceId[] = []
        const { processed } = playToDawn(2, (state, [first, second]) => {
            spaces.push(
                placeLandscape(state, { rulerId: first, serfId: second, kind: 'silver-mine' })
            )
            spaces.push(
                placeLandscape(state, {
                    rulerId: second,
                    serfId: first,
                    kind: 'silver-mine',
                    except: spaces
                })
            )
            leaveShillings(state, first, LandscapeFill + 1)
        })
        const [ofSecond, ofFirst] = spaces

        expect(dawnOf(processed).fills).toEqual([
            { spaceId: ofFirst, landscape: 'silver-mine', added: LandscapeFill },
            { spaceId: ofSecond, landscape: 'silver-mine', added: 1 }
        ])
    })

    it('R-4.12-H1, R-1.1-H1 short of a resource, an untended landscape goes last', () => {
        const spaces: SpaceId[] = []
        const { processed } = playToDawn(2, (state, [ruler, serf]) => {
            spaces.push(placeLandscape(state, { rulerId: ruler, kind: 'silver-mine' }))
            spaces.push(
                placeLandscape(state, {
                    rulerId: ruler,
                    serfId: serf,
                    kind: 'silver-mine',
                    except: spaces
                })
            )
            leaveShillings(state, ruler, LandscapeFill)
        })
        const [untended, tended] = spaces

        expect(dawnOf(processed).fills).toEqual([
            { spaceId: tended, landscape: 'silver-mine', added: LandscapeFill },
            { spaceId: untended, landscape: 'silver-mine', added: 0 }
        ])
    })

    it('R-4.12.3 serfs collect in turn order, one at a time; then the dawn goes on', () => {
        const spaces: SpaceId[] = []
        const { table, order } = playToDawn(2, (state, [first, second]) => {
            spaces.push(placeLandscape(state, { rulerId: first, serfId: second }))
            spaces.push(placeLandscape(state, { rulerId: second, serfId: first, except: spaces }))
        })
        const [first, second] = order
        const [ofSecond, ofFirst] = spaces

        expect(table.state.machineState).toBe(MachineState.CollectingLandscapes)
        expect(table.asked).toBe(first)
        table.send(first, { type: ActionType.CollectLandscapes, spaceIds: [ofFirst] })

        expect(table.state.machineState).toBe(MachineState.CollectingLandscapes)
        expect(table.asked).toBe(second)
        const after = table.send(second, { type: ActionType.CollectLandscapes, spaceIds: [] })

        expect(table.hydrated().spaces[ofFirst].landscape?.amount).toBe(0)
        expect(table.hydrated().spaces[ofSecond].landscape?.amount).toBe(LandscapeFill)
        expect(typesOf(after)).toEqual([
            ActionType.CollectLandscapes,
            ActionType.ReplenishMap,
            ActionType.EndRound,
            ActionType.StartRound
        ])
    })

    it('R-4.12.3 the turn manager asks each serf; the seats still to answer keep no order', () => {
        const spaces: SpaceId[] = []
        const { table, order } = playToDawn(2, (state, [first, second]) => {
            spaces.push(placeLandscape(state, { rulerId: first, serfId: second }))
            spaces.push(placeLandscape(state, { rulerId: second, serfId: first, except: spaces }))
        })
        const [first, second] = order
        const turnOf = () => table.hydrated().turnManager.currentTurn()?.playerId

        expect(turnOf()).toBe(first)
        table.moveTo((state) => {
            state.flow.landscapes?.pending.reverse()
            return MachineState.CollectingLandscapes
        })
        expect(turnOf()).toBe(first)
        expect(table.asked).toBe(first)
        expect(table.offered(second)).toEqual([])

        table.send(first, { type: ActionType.CollectLandscapes, spaceIds: [] })
        expect(turnOf()).toBe(second)
        table.send(second, { type: ActionType.CollectLandscapes, spaceIds: [] })
        expect(table.state.flow.landscapes).toBeUndefined()
    })

    it('R-4.12.3 with no serf on a landscape, nobody is asked', () => {
        const { table } = playToDawn(2, (state, [ruler]) => {
            placeLandscape(state, { rulerId: ruler })
        })

        expect(table.state.flow.landscapes).toBeUndefined()
        expect(table.state.machineState).toBe(MachineState.SelectingHands)
    })

    it('R-4.12, R-6.1-H2 at V the last collection brings final scoring, with no replenishing', () => {
        let tended: SpaceId | undefined
        const { table, order } = playToDawn(5, (state, [ruler, serf]) => {
            tended = placeLandscape(state, { rulerId: ruler, serfId: serf })
        })
        assertExists(tended, 'The landscape was placed')

        const after = table.send(order[1], {
            type: ActionType.CollectLandscapes,
            spaceIds: [tended]
        })

        expect(typesOf(after)).toEqual([ActionType.CollectLandscapes, ActionType.ScoreGame])
    })
})

describe('R-4.12.4 the map gains goods', () => {
    const Directions: { epoch: Exclude<Epoch, 1>; direction: MapDirection }[] = [
        { epoch: 2, direction: 'S' },
        { epoch: 3, direction: 'E' },
        { epoch: 4, direction: 'W' }
    ]

    it.each(Directions)(
        'R-4.12.4 at $epoch one good lies beside each region’s $direction space',
        ({ epoch, direction }) => {
            const before = new Map<SpaceId, number>()
            const { table, processed } = playToDawn(epoch, (state) => {
                for (const { id } of Spaces) {
                    before.set(id, goodsTotal(state.spaces[id].goods))
                }
            })
            const lettered = Regions.map((region) => regionSpace(region, direction))

            expect(sunray(epochAt(epoch)).mapDirection).toBe(direction)
            expect(mapGoodsOf(processed).map((entry) => entry.spaceId)).toEqual(lettered)
            for (const { id } of Spaces) {
                expect(goodsTotal(table.hydrated().spaces[id].goods)).toBe(
                    (before.get(id) ?? 0) + (lettered.includes(id) ? 1 : 0)
                )
            }
        }
    )

    it('R-4.12.4 on a farm the good joins its harvest, even with goods already there', () => {
        const spaceId = regionSpace(Regions[0], 'S')
        let held = 0
        const { table, processed } = playToDawn(2, (state) => {
            const farm = spaceOfKind(state, 'farm', [spaceId])
            const { location } = state.spaces[spaceId]
            state.spaces[spaceId].location = state.spaces[farm].location
            state.spaces[farm].location = location
            setFarmGoods(state, spaceId, { wood: 1 })
            held = goodsTotal(state.spaces[spaceId].goods)
        })

        const { good } = mapGoodsOf(processed)[0]
        const after = table.hydrated().spaces[spaceId]
        expect(locationKindOf(after.location)).toBe('farm')
        expect(goodsTotal(after.goods)).toBe(held + 1)
        expect(after.goods[good]).toBeGreaterThan(0)
    })

    it('R-1.1-H1 a haversack run dry leaves the last regions out', () => {
        const { processed } = playToDawn(2, (state, order) => {
            drainHaversack(state, order, 0)
            state.supply.haversack.wood += 2
            state.getPlayerState(order[0]).goods.wood -= 2
        })

        expect(mapGoodsOf(processed)).toEqual(
            ['sea', 'island'].map((name) => {
                const region = Regions.find(({ region: id }) => id === name)
                assertExists(region, 'The region is on the board')
                return { spaceId: regionSpace(region, 'S'), good: 'wood' }
            })
        )
    })

    it('R-4.12.4 is a barrier; BeginDawn, which draws nothing, is not', () => {
        const { processed } = playToDawn(2)

        expect(processed.find((action) => isBeginDawn(action))?.revealsInfo).toBeFalsy()
        expect(processed.find((action) => isReplenishMap(action))).toMatchObject({
            source: ActionSource.System,
            revealsInfo: true
        })
    })

    it('R-5.2 draws from the protected stream, leaving the public stream alone', () => {
        const state = playToDawn(2).table.hydrated()
        const publicCursor = state.prng.invocations
        const protectedCursor = state.protectedPrng?.invocations ?? 0

        replenishMap(state)

        expect(state.prng.invocations).toBe(publicCursor)
        expect(state.protectedPrng?.invocations ?? 0).toBeGreaterThan(protectedCursor)
    })
})

describe('R-4.12.5, R-4.12-H2 the guilds refill at III', () => {
    it.each<{ epoch: Exclude<Epoch, 1> }>([{ epoch: 2 }, { epoch: 4 }])(
        'R-4.12.5 at $epoch nothing refills',
        ({ epoch }) => {
            const { table, processed } = playToDawn(epoch, (state) => setBarn(state, {}))

            expect(processed.some((action) => isReplenishGuilds(action))).toBe(false)
            expect(goodsTotal(table.hydrated().guilds.farmer.barn)).toBe(0)
        }
    )

    it('R-4.12.5 is a barrier', () => {
        const { processed } = playToDawn(3)

        expect(processed.find((action) => isReplenishGuilds(action))).toMatchObject({
            source: ActionSource.System,
            revealsInfo: true
        })
    })

    it('R-4.12.5 the market’s setup spaces refill, and another space stays filled', () => {
        const extra = MarketSpaces.find((space) => !space.filledAtSetup)
        assertExists(extra, 'R-1.3 Setup leaves market spaces empty')
        const { table, processed } = playToDawn(3, (state) => {
            setMarket(state, { [extra.good]: extra.space })
        })

        const { market } = table.hydrated().guilds.merchant
        for (const space of MarketSpaces.filter(({ filledAtSetup }) => filledAtSetup)) {
            expect(market[space.id]).toBe(true)
        }
        expect(market[extra.id]).toBe(true)
        expect(refillOf(processed).market).toEqual(
            GuildSetupSpaces.merchant.marketSpaces.filter(
                (id) => !MarketSpaces.some((space) => space.id === id && space.good === extra.good)
            )
        )
    })

    it('R-1.1-H1 a good gone from the haversack leaves its market spaces empty', () => {
        const { table, processed } = playToDawn(3, (state, order) => {
            setMarket(state, {})
            giveGood(state, order[0], 'wood', state.supply.haversack.wood)
        })

        const wood = MarketSpaces.filter(
            ({ good, filledAtSetup }) => good === 'wood' && filledAtSetup
        )
        expect(wood.length).toBeGreaterThan(0)
        for (const space of wood) {
            expect(table.hydrated().guilds.merchant.market[space.id]).toBe(false)
            expect(refillOf(processed).market).not.toContain(space.id)
        }
    })

    it('R-4.12.5 the alchemist’s carts refill, and another cart stays filled', () => {
        const extra = AlchemistCartSpaces.find((space) => !space.filledAtSetup)
        assertExists(extra, 'R-1.3 Setup leaves carts empty')
        const { table, processed } = playToDawn(3, (state) => {
            setCarts(state, { [extra.good]: extra.space })
        })

        const { carts } = table.hydrated().guilds.alchemist
        for (const id of GuildSetupSpaces.alchemist.cartSpaces) {
            expect(carts[id]).toBe(true)
        }
        expect(carts[extra.id]).toBe(true)
        expect(refillOf(processed).carts.length).toBeGreaterThan(0)
    })

    it('R-4.12-H2 the vessel space refills to its count', () => {
        const { table, processed } = playToDawn(3, (state) => setVesselsForSale(state, []))

        const forSale = table.hydrated().guilds.alchemist.vesselsForSale
        expect(forSale).toHaveLength(GuildSetupSpaces.alchemist.vessels)
        expect(refillOf(processed).vessels).toEqual(forSale)
    })

    it('R-4.12-H2 vessels past the count stay, and none is drawn', () => {
        const count = GuildSetupSpaces.alchemist.vessels + 1
        const { table, processed } = playToDawn(3, (state) => {
            setVesselsForSale(
                state,
                Array.from({ length: count }, () => state.guilds.alchemist.vesselsForSale[0])
            )
        })

        expect(table.hydrated().guilds.alchemist.vesselsForSale).toHaveLength(count)
        expect(refillOf(processed).vessels).toEqual([])
    })

    it('R-4.12.5 every knight row refills, a dummy row too, and extras stay', () => {
        const { markersPerRow } = GuildSetupSpaces.knight
        const { table, processed } = playToDawn(3, (state) => {
            setRowMarkers(
                state,
                knightRows(state).map((_, index) => (index === 0 ? markersPerRow + 1 : 0))
            )
        })

        const [extra, ...short] = knightRows(table.hydrated())
        expect(extra.row.markers).toBe(markersPerRow + 1)
        expect(short.length).toBeGreaterThan(0)
        expect(short.some(({ row }) => 'dummy' in row.owner)).toBe(true)
        for (const { row } of short) {
            expect(row.markers).toBe(markersPerRow)
        }
        expect(refillOf(processed).knightRows).toEqual(
            short.map(({ rowId, row }) => ({ rowId, owner: row.owner, added: markersPerRow }))
        )
    })

    it('R-1.1-H1 a seat short in the supply refills its row as far as it can', () => {
        const { table, processed } = playToDawn(3, (state) => {
            setRowMarkers(state, [0])
            const [{ row }] = knightRows(state)
            const seat = rowSeat(row.owner)
            assertExists(seat, 'R-1.3 The first row is a seat’s')
            state.getPlayerState(seat).influenceSupply += state.supply.influence[seat] - 1
            state.supply.influence[seat] = 1
        })

        const [row] = knightRows(table.hydrated())
        expect(row.row.markers).toBe(1)
        expect(refillOf(processed).knightRows[0]).toMatchObject({ rowId: row.rowId, added: 1 })
    })

    it('R-5-H1, R-4.12.5 the scrolls refill concealed, and another scroll stays', () => {
        const extra = ScrollSpaces.find((space) => !space.setupSeal)
        assertExists(extra, 'R-1.3 Setup leaves scroll spaces empty')
        const { table, processed } = playToDawn(3, (state) => setScrolls(state, [extra.id]))

        const { scrolls } = table.hydrated().guilds.noble
        for (const id of [...GuildSetupSpaces.noble.scrollSpaces, extra.id]) {
            expect(scrolls[id]).toBeTruthy()
        }
        expect(refillOf(processed).scrolls).toEqual(GuildSetupSpaces.noble.scrollSpaces)
    })

    it('R-4.12-H2 the rosary refills to its count, its beads named', () => {
        const { table, processed } = playToDawn(3, (state) =>
            setBeads(state, { rosary: [], chickens: [] })
        )

        const { rosary } = table.hydrated().guilds.monk
        expect(rosary).toHaveLength(GuildSetupSpaces.monk.beads)
        expect(refillOf(processed).rosary).toEqual(rosary)
    })

    it('R-4.12-H2 a bead past the rosary’s count stays, and none is added', () => {
        const count = GuildSetupSpaces.monk.beads + 1
        const { table, processed } = playToDawn(3, (state) => {
            while (state.guilds.monk.rosary.length < count) {
                flipSeal(state, { kind: 'pile' }, { kind: 'rosary' })
            }
        })

        expect(table.hydrated().guilds.monk.rosary).toHaveLength(count)
        expect(refillOf(processed).rosary).toEqual([])
    })

    it('R-4.12-H2 an occupied setup chicken gets nothing', () => {
        let held: string | null = null
        const { table, processed } = playToDawn(3, (state) => {
            held = state.guilds.farmer.chickens[SetupChicken]
        })

        expect(held).not.toBeNull()
        expect(table.hydrated().guilds.farmer.chickens[SetupChicken]).toBe(held)
        expect(refillOf(processed).chickens).toEqual([])
    })

    it('R-4.12-H2 an empty setup chicken takes a bead, even with one on another chicken', () => {
        const other = chickenWhere(false)
        let moved: string | null = null
        const { table, processed } = playToDawn(3, (state) => {
            const bead = state.guilds.farmer.chickens[SetupChicken]
            assertExists(bead, 'R-1.4-H3 Setup puts a bead on this chicken')
            moved = bead
            moveBead(
                state,
                bead,
                { kind: 'chicken', space: SetupChicken },
                { kind: 'chicken', space: other }
            )
        })

        const { chickens } = table.hydrated().guilds.farmer
        expect(chickens[other]).toBe(moved)
        expect(chickens[SetupChicken]).not.toBeNull()
        expect(refillOf(processed).chickens).toEqual([
            { space: SetupChicken, bead: chickens[SetupChicken] }
        ])
    })

    it('R-4.12.5 the barn refills to its count, and extras stay', () => {
        const short = playToDawn(3, (state) => setBarn(state, {}))
        expect(goodsTotal(short.table.hydrated().guilds.farmer.barn)).toBe(FarmerBarn.setupGoods)
        expect(refillOf(short.processed).barn).toHaveLength(FarmerBarn.setupGoods)

        const extra = FarmerBarn.setupGoods + 1
        const full = playToDawn(3, (state) => setBarn(state, { wood: extra }))
        expect(goodsTotal(full.table.hydrated().guilds.farmer.barn)).toBe(extra)
        expect(refillOf(full.processed).barn).toEqual([])
    })

    it('R-4.12-H2, R-1.1-H1 a short seal pile fills in setup order: scrolls before beads', () => {
        const { table, processed } = playToDawn(3, (state, [playerId]) => {
            setScrolls(state, [])
            setBeads(state, { rosary: [], chickens: [] })
            setSealPile(state, playerId, 1)
        })

        const refill = refillOf(processed)
        expect(refill.scrolls).toEqual(GuildSetupSpaces.noble.scrollSpaces.slice(0, 1))
        expect(refill.rosary).toEqual([])
        expect(refill.chickens).toEqual([])
        expect(table.hydrated().supply.sealPileCount).toBe(0)
    })
})
