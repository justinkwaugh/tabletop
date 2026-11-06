import { describe, expect, it, beforeAll } from 'vitest'
import type { VesselType } from '../data/components.js'
import { WineBarrelCapacity } from '../data/components.js'
import { ActionType } from '../definition/actions.js'
import { RegionIds } from '../data/regionTiles.js'
import { MachineState } from '../definition/states.js'
import { atWillWindow, writsOverLimit } from '../model/atWill.js'
import { conservationBreaks } from '../model/canonicalValidator.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { placeMarker } from '../model/locationControl.js'
import { moveConcealedSeal } from '../model/seals.js'
import {
    Charter,
    Charters,
    giveTile,
    holdSealedCharter,
    registerTestMandates,
    ShillingMandate,
    tableInWindow,
    VesselMandate,
    Weapon,
    WindowStates,
    type WindowName
} from '../testing/atWill.js'
import {
    Battlefield,
    buildFeudum,
    conquer,
    holdWrit,
    PawnOf,
    tableAtCombat
} from '../testing/combat.js'
import {
    setPawns,
    tableAtGuild,
    setMaster,
    setMarket,
    setCarts,
    StandingSpace
} from '../testing/guilds.js'
import { giveGood, giveSeal, setUp, spaceOfKind, tableImproving } from '../testing/improving.js'
import { canonicalOf } from '../testing/state.js'
import { tableAtPlayingCards } from '../testing/table.js'
import { reasonPlaceVesselRefused, placeVesselOffers } from './placeVessel.js'
import { reasonDiscardWritRefused } from './discardWrit.js'
import { reasonSealCharterRefused } from './sealCharter.js'
import { reasonSpendRegionTileRefused, spendRegionTileOffers } from './spendRegionTile.js'
import { keepWritsOffer } from './keepWrits.js'

const Windows: readonly WindowName[] = [
    'before a card',
    'hand selection',
    'nourishing',
    'writ limit'
]

const NOT_YOUR_TURN = "It isn't your turn."

beforeAll(registerTestMandates)

/** A seat with something to do with every at-will action. */
function equip(state: HydratedFeudumGameState, playerId: string): void {
    const player = state.getPlayerState(playerId)
    holdWrit(state, playerId, ShillingMandate)
    holdWrit(state, playerId, Charter)
    holdWrit(state, playerId, VesselMandate)
    holdWrit(state, playerId, Charters[1])
    giveGood(state, playerId, 'food')
    giveSeal(state, playerId)
    giveTile(state, playerId)
    state.supply.vessels.ship -= 1
    player.vessels.ship += 1
    setPawns(state, playerId, ['knight'])
    const ruler = state.turnManager.turnOrder.find((seat) => seat !== playerId) ?? ''
    buildFeudum(state, ruler)
    placeMarker(state, playerId, Battlefield)
    moveConcealedSeal(
        state,
        { kind: 'pile' },
        { kind: 'immunity', spaceId: Battlefield, role: 'serf' }
    )
}

const EveryWindowAction = [
    ActionType.PlayMandate,
    ActionType.SealCharter,
    ActionType.SpendRegionTile,
    ActionType.DiscardWrit,
    ActionType.ReclaimImmunitySeal
]

describe('R-4.4-H1 the at-will windows', () => {
    it.each(Windows)('offers every at-will action to the seat asked: %s', (name) => {
        const { table, playerId } = tableInWindow(name, equip)
        const offered = table.offered(playerId)
        for (const type of EveryWindowAction) {
            expect(offered).toContain(type)
        }
        const other = table.order.find((seat) => seat !== playerId)
        expect(other).toBeDefined()
        expect(atWillWindow(table.hydrated(), other ?? '')).toBeUndefined()
        for (const type of EveryWindowAction) {
            expect(table.offered(other ?? '')).not.toContain(type)
        }
    })

    it.each([
        ['before a card', true],
        ['hand selection', false],
        ['nourishing', false],
        ['writ limit', true]
    ] as const)('R-4.2.2, R-4.2-H3 a vessel is placed on the own turn only: %s', (name, own) => {
        const { table, playerId } = tableInWindow(name, equip)
        const type = ActionType.PlaceVessel
        if (own) {
            expect(table.offered(playerId)).toContain(type)
        } else {
            expect(table.offered(playerId)).not.toContain(type)
            expect(reasonPlaceVesselRefused(table.hydrated(), playerId, 'ship', 1)).toBe(
                'You place a vessel only on your own turn.'
            )
            expect(() => table.send(playerId, { type, vesselType: 'ship', pawn: 1 })).toThrow(
                'You place a vessel only on your own turn.'
            )
        }
    })

    it.each(Windows)('each action keeps the seat in its state and asks it again: %s', (name) => {
        const { table, playerId } = tableInWindow(name, equip)
        const [tileId] = table.seat(playerId).regionTiles
        const moves: (Record<string, unknown> & { type: ActionType })[] = [
            { type: ActionType.SpendRegionTile, tileId, good: 'iron' },
            { type: ActionType.SealCharter, writId: Charter },
            { type: ActionType.ReclaimImmunitySeal, spaceId: Battlefield, role: 'serf' },
            { type: ActionType.PlayMandate, writId: ShillingMandate, alternative: 0 },
            { type: ActionType.DiscardWrit, writId: VesselMandate }
        ]
        for (const move of moves) {
            const handCount = table.seat(playerId).handCount
            const before = table.hydrated().turnManager.turnOrder
            table.send(playerId, move)
            const state = table.hydrated()
            if (name === 'writ limit' && !writsOverLimit(state, playerId)) {
                // R-4.4.4 Back within the limit, the turn goes on.
                expect(state.machineState).toBe(MachineState.PlayingCards)
                break
            }
            expect(state.machineState).toBe(WindowStates[name])
            expect(table.asked).toBe(playerId)
            expect(table.seat(playerId).handCount).toBe(handCount)
            expect(state.turnManager.turnOrder).toEqual(before)
        }
    })

    it('R-3.2-H2 an at-will action costs the turn player no card and no step', () => {
        const { table, playerId } = tableInWindow('before a card', equip)
        const turn = { ...table.hydrated().flow.turn }
        table.send(playerId, { type: ActionType.DiscardWrit, writId: VesselMandate })
        expect(table.hydrated().flow.turn).toEqual(turn)
        expect(table.seat(playerId).played).toEqual([])
    })

    it('R-3.1-H1 the next finaliser acts at will, then still finalises', () => {
        const { table, playerId } = tableInWindow('hand selection', equip)
        table.send(playerId, { type: ActionType.DiscardWrit, writId: VesselMandate })
        expect(table.asked).toBe(playerId)
        expect(table.offered(playerId)).toContain(ActionType.FinaliseHand)
        expect(table.hydrated().flow.selection?.playerId).toBe(playerId)
    })

    it('R-4.10 in nourishing, only the first seat pending is asked', () => {
        const { table, playerId } = tableInWindow('nourishing', equip)
        expect(table.asked).toBe(playerId)
        const next = table.order[1]
        expect(atWillWindow(table.hydrated(), next)).toBeUndefined()
        table.moveTo((state) => {
            state.flow.nourish = { pending: [next] }
            return MachineState.Nourishing
        })
        expect(table.asked).toBe(next)
        expect(atWillWindow(table.hydrated(), next)).toBe('nourishing')
        expect(atWillWindow(table.hydrated(), playerId)).toBeUndefined()
    })

    it('R-4.4-H1 no window while the turn player waits on a defender or keeps a draw', () => {
        const combat = tableAtCombat()
        const { table, attackerId, defenderId } = combat
        setUp(table, (state) => {
            buildFeudum(state, defenderId)
            holdWrit(state, attackerId, ShillingMandate)
            holdWrit(state, defenderId, VesselMandate)
        })
        conquer(combat, PawnOf(defenderId))
        const state = table.hydrated()
        expect(state.machineState).toBe(MachineState.AwaitingDefence)
        expect(atWillWindow(state, attackerId)).toBeUndefined()
        expect(atWillWindow(state, defenderId)).toBeUndefined()
        expect(table.offered(defenderId)).not.toContain(ActionType.PlayMandate)
        expect(reasonDiscardWritRefused(state, defenderId, VesselMandate)).toBe(NOT_YOUR_TURN)
        expect(() =>
            table.send(defenderId, { type: ActionType.DiscardWrit, writId: VesselMandate })
        ).toThrow()
    })
})

describe('R-4.4.4, R-4.4-H6 the writ limit', () => {
    it('R-4.4.4 counts sealed charters', () => {
        const { table, playerId } = tableInWindow('before a card', (state, seat) => {
            holdSealedCharter(state, seat, Charters[0])
            holdSealedCharter(state, seat, Charters[1])
            holdWrit(state, seat, ShillingMandate)
        })
        expect(writsOverLimit(table.hydrated(), playerId)).toBe(false)
        table.moveTo((state) => {
            holdWrit(state, playerId, VesselMandate)
            return MachineState.PlayingCards
        })
        expect(table.seat(playerId).writCount).toBe(4)
        expect(writsOverLimit(table.hydrated(), playerId)).toBe(true)
    })

    it('R-4.4-H6 a seat over the limit always holds a writ to discard: the fourth seal is refused', () => {
        const { table, playerId } = tableInWindow('writ limit', (state, seat) => {
            holdSealedCharter(state, seat, Charters[0])
            holdSealedCharter(state, seat, Charters[1])
            holdSealedCharter(state, seat, Charters[2])
            holdWrit(state, seat, Charters[3])
            giveSeal(state, seat)
        })
        expect(reasonSealCharterRefused(table.hydrated(), playerId, Charters[3])).toBe(
            "You can't hold more than 3 sealed charters."
        )
        expect(table.offered(playerId)).not.toContain(ActionType.SealCharter)
        expect(table.offered(playerId)).toContain(ActionType.DiscardWrit)
        expect(() =>
            table.send(playerId, { type: ActionType.SealCharter, writId: Charters[3] })
        ).toThrow("You can't hold more than 3 sealed charters.")

        const turnPlayer = table.hydrated().flow.turn?.playerId
        table.send(playerId, { type: ActionType.DiscardWrit, writId: Charters[3] })

        const state = table.hydrated()
        const seat = state.getPlayerState(playerId)
        expect(seat.writCount).toBe(3)
        expect(seat.sealedCharterCount).toBe(3)
        expect(seat.requireSealedCharters()).toHaveLength(3)
        expect(writsOverLimit(state, playerId)).toBe(false)
        expect(state.machineState).toBe(MachineState.PlayingCards)
        expect(state.flow.turn?.playerId).not.toBe(turnPlayer)
    })

    it('R-4.4.4 stays until 3, sealing and spending not counting; a mandate counts', () => {
        const { table, playerId } = tableInWindow('writ limit', (state, seat) => {
            holdWrit(state, seat, Charters[0])
            holdWrit(state, seat, Charters[1])
            holdWrit(state, seat, ShillingMandate)
            holdWrit(state, seat, VesselMandate)
            holdWrit(state, seat, Charters[2])
            giveSeal(state, seat)
            giveGood(state, seat, 'food')
        })
        table.send(playerId, { type: ActionType.SealCharter, writId: Charters[0] })
        expect(table.hydrated().machineState).toBe(MachineState.DiscardingWrits)
        table.send(playerId, { type: ActionType.DiscardWrit, writId: Charters[1] })
        expect(table.hydrated().machineState).toBe(MachineState.DiscardingWrits)
        expect(table.asked).toBe(playerId)
        table.send(playerId, {
            type: ActionType.PlayMandate,
            writId: ShillingMandate,
            alternative: 0
        })
        const state = table.hydrated()
        expect(state.machineState).toBe(MachineState.PlayingCards)
        expect(state.flow.turn?.playerId).not.toBe(playerId)
    })
})

describe('R-4.4-H1 weapons', () => {
    it('are not offered and not played at will', () => {
        const { table, playerId } = tableInWindow('before a card', (state, seat) => {
            holdWrit(state, seat, Weapon)
        })
        expect(table.offered(playerId)).not.toContain(ActionType.PlayMandate)
        expect(() =>
            table.send(playerId, { type: ActionType.PlayMandate, writId: Weapon, alternative: 0 })
        ).toThrow(`${Weapon} has no at-will effect`)
    })
})

describe('SpendRegionTile', () => {
    const atTile = (edit?: (state: HydratedFeudumGameState, seat: string) => void) => {
        const { table, playerId } = tableInWindow('before a card', (state, seat) => {
            giveTile(state, seat)
            edit?.(state, seat)
        })
        const [tileId] = table.seat(playerId).regionTiles
        return { table, playerId, tileId }
    }

    it('R-4.3.3 the tile leaves the game for the chosen good; not a barrier', () => {
        const { table, playerId, tileId } = atTile()
        const before = table.seat(playerId).goods.wood
        const haversack = table.hydrated().supply.haversack.wood

        const [action] = table.send(playerId, {
            type: ActionType.SpendRegionTile,
            tileId,
            good: 'wood'
        })

        const state = table.hydrated()
        const player = state.getPlayerState(playerId)
        expect(player.regionTiles).toEqual([])
        expect(state.tilesOutOfGame).toContain(tileId)
        expect(player.goods.wood).toBe(before + 1)
        expect(state.supply.haversack.wood).toBe(haversack - 1)
        expect(action.revealsInfo).toBeFalsy()
        expect(state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).toBe(playerId)
        expect(conservationBreaks(canonicalOf(table.hydrated()))).toEqual([])
    })

    it('R-4.3.3 is refused out of turn and for a tile not held', () => {
        const { table, playerId, tileId } = atTile()
        const other = table.order[1]
        expect(
            reasonSpendRegionTileRefused(table.hydrated(), other, { tileId, good: 'iron' })
        ).toBe(NOT_YOUR_TURN)
        const notHeld = RegionIds.flatMap((id) => table.hydrated().regionStacks[id])[0]
        expect(
            reasonSpendRegionTileRefused(table.hydrated(), playerId, {
                tileId: notHeld,
                good: 'iron'
            })
        ).toBe("You don't hold that tile.")
        expect(() =>
            table.send(playerId, {
                type: ActionType.SpendRegionTile,
                tileId: notHeld,
                good: 'iron'
            })
        ).toThrow("You don't hold that tile.")
    })

    it('R-4.3-H2 is refused for a good the haversack has run out of', () => {
        const { table, playerId, tileId } = atTile((state, seat) => {
            giveGood(state, seat, 'iron', state.supply.haversack.iron)
        })
        expect(
            reasonSpendRegionTileRefused(table.hydrated(), playerId, { tileId, good: 'iron' })
        ).toBe('The haversack holds no iron.')
        expect(spendRegionTileOffers(table.hydrated(), playerId)[0]?.goods).not.toContain('iron')
    })

    it('R-4.10.2, R-4.10-H1 a sulfur may go straight into the barrel', () => {
        const { table, playerId, tileId } = atTile()
        const seat = table.seat(playerId)
        const { sulfur } = seat.goods
        const [action] = table.send(playerId, {
            type: ActionType.SpendRegionTile,
            tileId,
            good: 'sulfur',
            sulfurToBarrel: true
        })
        const after = table.seat(playerId)
        expect(after.barrel).toBe(seat.barrel + 1)
        expect(after.goods.sulfur).toBe(sulfur)
        expect(action).toMatchObject({ sulfurToBarrel: true })
        expect(conservationBreaks(canonicalOf(table.hydrated()))).toEqual([])
    })

    it('R-4.10.2 only sulfur goes in the barrel, and only while it has room', () => {
        const { table, playerId, tileId } = atTile()
        expect(
            reasonSpendRegionTileRefused(table.hydrated(), playerId, {
                tileId,
                good: 'iron',
                sulfurToBarrel: true
            })
        ).toBe('Only sulfur goes in your barrel.')
        const full = atTile((state, seat) => {
            state.supply.haversack.sulfur -= WineBarrelCapacity
            state.getPlayerState(seat).barrel = WineBarrelCapacity
        })
        expect(
            reasonSpendRegionTileRefused(full.table.hydrated(), full.playerId, {
                tileId: full.tileId,
                good: 'sulfur',
                sulfurToBarrel: true
            })
        ).toBe('Your barrel is full.')
        expect(spendRegionTileOffers(full.table.hydrated(), full.playerId)[0]?.sulfurToBarrel).toBe(
            false
        )
    })

    it('R-4.3.3 is not offered without a tile', () => {
        const { table, playerId } = tableInWindow('before a card')
        expect(table.offered(playerId)).not.toContain(ActionType.SpendRegionTile)
        expect(spendRegionTileOffers(table.hydrated(), playerId)).toEqual([])
    })
})

describe('R-4.3-H3 a tile spent first covers a payment that takes no tiles', () => {
    it('Improve: a wood from a tile pays for the farm', () => {
        const { table, playerId, spaceId } = tableImproving('outpost')
        setUp(table, (state) => {
            const { goods } = state.getPlayerState(playerId)
            state.supply.haversack.wood += goods.wood
            goods.wood = 0
            giveTile(state, playerId)
        })
        const [tileId] = table.seat(playerId).regionTiles
        const improve = { type: ActionType.Improve, spaceId, discId: 'disc.double.1' }
        expect(() => table.send(playerId, improve)).toThrow()
        table.send(playerId, { type: ActionType.SpendRegionTile, tileId, good: 'wood' })
        table.send(playerId, improve)
        expect(table.hydrated().spaces[spaceId].location.kind).toBe('farm')
    })

    it('R-3.9.3 Tend Landscape: a wood from a tile pays for the landscape', () => {
        const table = tableAtPlayingCards(() => ({ cards: ['improve', 'move', 'tax', 'guild'] }))
        const playerId = table.asked
        const spaceId = spaceOfKind(table.hydrated(), 'farm')
        setUp(table, (state) => {
            placeMarker(state, table.order[1], spaceId)
            placeMarker(state, playerId, spaceId)
            state.recomputeRanks()
            const { goods } = state.getPlayerState(playerId)
            state.supply.haversack.wood += goods.wood
            goods.wood = 0
            giveTile(state, playerId)
            giveTile(state, playerId)
        })
        const [tended, spent] = table.seat(playerId).regionTiles
        const tend = { type: ActionType.TendLandscape, tileId: tended, spaceId, collect: false }
        expect(() => table.send(playerId, tend)).toThrow()
        table.send(playerId, { type: ActionType.SpendRegionTile, tileId: spent, good: 'wood' })
        table.send(playerId, tend)
        expect(table.seat(playerId).goods.wood).toBe(0)
        expect(table.seat(playerId).regionTiles).toEqual([])
    })

    it('R-3.16 Feast: a tile brings a sulfur into the barrel just before', () => {
        const { table, playerId, others } = tableAtGuild((state, seat, rest) => {
            setPawns(state, seat, ['knight'])
            setMaster(state, rest[0], 'merchant')
            setMarket(state, { iron: 2, wood: 3 })
            setCarts(state, { iron: 1 })
            giveTile(state, seat)
        })
        const [tileId] = table.seat(playerId).regionTiles
        const feast = {
            type: ActionType.Feast,
            spaceId: StandingSpace,
            opponentId: others[0],
            guildId: 'merchant',
            params: { goods: ['iron', 'wood', 'iron', 'wood'] }
        }
        expect(table.seat(playerId).barrel).toBe(0)
        expect(() => table.send(playerId, feast)).toThrow()
        table.send(playerId, {
            type: ActionType.SpendRegionTile,
            tileId,
            good: 'sulfur',
            sulfurToBarrel: true
        })
        expect(table.seat(playerId).barrel).toBe(1)
        table.send(playerId, feast)
        expect(table.seat(playerId).barrel).toBe(0)
        expect(table.seat(playerId).played.at(-1)).toMatchObject({ kind: 'guild', use: 'special' })
    })

    it('R-3.15.2 Déjà Vu: a saltpeter from a tile pays for the replay', () => {
        const table = tableAtPlayingCards(() => ({ cards: ['repeat', 'tax', 'guild', 'move'] }))
        const playerId = table.asked
        table.moveTo((state) => {
            const player = state.getPlayerState(playerId)
            state.supply.haversack.saltpeter += player.goods.saltpeter
            player.goods.saltpeter = 0
            player.played.push({ kind: 'explore', use: 'forfeited' })
            placeMarker(state, playerId, spaceOfKind(state, 'outpost'))
            giveTile(state, playerId)
            return MachineState.PlayingCards
        })
        const [tileId] = table.seat(playerId).regionTiles
        const replay = { type: ActionType.Explore, revealsInfo: true, asRepeat: 'deja-vu' }
        expect(() => table.send(playerId, replay)).toThrow()
        table.send(playerId, { type: ActionType.SpendRegionTile, tileId, good: 'saltpeter' })
        table.send(playerId, replay)
        expect(table.seat(playerId).goods.saltpeter).toBe(0)
    })
})

describe('R-4.3-H3 Shovels & Swords, asked with no window, takes its own tile', () => {
    function atKeep(iron: number) {
        const table = tableAtPlayingCards(() => ({ cards: ['explore', 'tax', 'guild'] }))
        const playerId = table.asked
        table.moveTo((state) => {
            const player = state.getPlayerState(playerId)
            state.supply.haversack.iron += player.goods.iron - iron
            player.goods.iron = iron
            placeMarker(state, playerId, spaceOfKind(state, 'outpost'))
            giveTile(state, playerId)
            state.recomputeRanks()
            return MachineState.PlayingCards
        })
        const [tileId] = table.seat(playerId).regionTiles
        table.send(playerId, { type: ActionType.Explore, revealsInfo: true })
        const drawn = table.hydrated().flow.writDraw?.drawn ?? []
        return { table, playerId, tileId, drawn }
    }

    it('offers Shovels with no iron while a tile can bring one, needing the tile', () => {
        const { table, playerId } = atKeep(0)
        expect(keepWritsOffer(table.hydrated(), playerId)?.shovelsAndSwords).toMatchObject({
            wildTileNeeded: true
        })
    })

    it('a tile brings the iron, which goes to the haversack; the second draw follows', () => {
        const { table, playerId, tileId, drawn } = atKeep(0)
        const haversack = table.hydrated().supply.haversack.iron
        table.send(playerId, {
            type: ActionType.KeepWrits,
            revealsInfo: true,
            keep: [drawn[0]],
            shovelsAndSwords: true,
            wildTiles: [{ tileId, good: 'iron' }]
        })
        const state = table.hydrated()
        const player = state.getPlayerState(playerId)
        expect(player.regionTiles).toEqual([])
        expect(state.tilesOutOfGame).toContain(tileId)
        expect(player.goods.iron).toBe(0)
        expect(state.supply.haversack.iron).toBe(haversack)
        expect(state.flow.writDraw?.source).toBe('shovels')
    })

    it('is refused with no iron and no tile named, and for a tile with no Shovels', () => {
        const { table, playerId, tileId, drawn } = atKeep(0)
        expect(() =>
            table.send(playerId, {
                type: ActionType.KeepWrits,
                revealsInfo: true,
                keep: [drawn[0]],
                shovelsAndSwords: true
            })
        ).toThrow()
        expect(() =>
            table.send(playerId, {
                type: ActionType.KeepWrits,
                keep: [drawn[0]],
                wildTiles: [{ tileId, good: 'iron' }]
            })
        ).toThrow('Only Shovels & Swords takes a tile here.')
    })

    it('with an iron, needs no tile', () => {
        const { table, playerId } = atKeep(1)
        expect(keepWritsOffer(table.hydrated(), playerId)?.shovelsAndSwords).toMatchObject({
            wildTileNeeded: false
        })
    })
})

describe('PlaceVessel', () => {
    const giveVessel = (state: HydratedFeudumGameState, seat: string, vessel: VesselType) => {
        state.supply.vessels[vessel] -= 1
        state.getPlayerState(seat).vessels[vessel] += 1
    }
    const atVessel = () =>
        tableInWindow('before a card', (state, seat) => {
            giveVessel(state, seat, 'ship')
            setPawns(state, seat, ['knight', 'farmer'])
        })

    it('R-4.2.2 goes under the seat’s pawn, free, the turn going on; not a barrier', () => {
        const { table, playerId } = atVessel()
        const { shillings, goods } = table.seat(playerId)

        const [action] = table.send(playerId, {
            type: ActionType.PlaceVessel,
            vesselType: 'ship',
            pawn: 2
        })

        const player = table.seat(playerId)
        expect(player.vessels.ship).toBe(0)
        expect(player.pawns[1].vessel).toBe('ship')
        expect(player.pawns[0].vessel).toBeUndefined()
        expect(player.shillings).toBe(shillings)
        expect(player.goods).toEqual(goods)
        expect(action.revealsInfo).toBeFalsy()
        expect(action).toMatchObject({ metadata: { spaceId: StandingSpace } })
        expect(table.hydrated().machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).toBe(playerId)
        expect(conservationBreaks(canonicalOf(table.hydrated()))).toEqual([])
    })

    it('R-4.2.2 is refused for a pawn already on a vessel, off the board, or no vessel held', () => {
        const { table, playerId } = atVessel()
        table.send(playerId, { type: ActionType.PlaceVessel, vesselType: 'ship', pawn: 1 })
        table.moveTo((state) => {
            giveVessel(state, playerId, 'ship')
            return MachineState.PlayingCards
        })
        const state = table.hydrated()
        expect(reasonPlaceVesselRefused(state, playerId, 'ship', 1)).toBe(
            'That pawn already stands on a vessel.'
        )
        expect(reasonPlaceVesselRefused(state, playerId, 'ship', 3)).toBe(
            "That pawn isn't on the board."
        )
        expect(reasonPlaceVesselRefused(state, playerId, 'flying-machine', 2)).toBe(
            'You have no flying machine in your supply.'
        )
        expect(() =>
            table.send(playerId, { type: ActionType.PlaceVessel, vesselType: 'ship', pawn: 1 })
        ).toThrow('That pawn already stands on a vessel.')
    })

    it('R-4.2.2 is refused out of turn', () => {
        const { table, playerId } = atVessel()
        const other = table.order.find((seat) => seat !== playerId) ?? ''
        expect(reasonPlaceVesselRefused(table.hydrated(), other, 'ship', 1)).toBe(NOT_YOUR_TURN)
    })

    it('R-4.2.2 offers the pawns on no vessel, per vessel held; none with no vessel', () => {
        const { table, playerId } = atVessel()
        expect(placeVesselOffers(table.hydrated(), playerId)).toEqual([
            { vesselType: 'ship', pawns: [1, 2] }
        ])
        table.send(playerId, { type: ActionType.PlaceVessel, vesselType: 'ship', pawn: 1 })
        expect(placeVesselOffers(table.hydrated(), playerId)).toEqual([])
        expect(table.offered(playerId)).not.toContain(ActionType.PlaceVessel)
    })
})
