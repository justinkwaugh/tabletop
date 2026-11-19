import { assertExists } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import type { SpaceId } from '../data/board.js'
import { HarvestCardChart, type ActionCardKind } from '../data/cards.js'
import { Goods, type Good } from '../data/components.js'
import type { LocationKind } from '../data/discs.js'
import { Seals, type BeadValue, type SealId } from '../data/seals.js'
import { ActionType } from '../definition/actions.js'
import { FeudumApiActions } from '../definition/apiActions.js'
import { MachineState } from '../definition/states.js'
import { HydratedFeudumGameState } from '../model/gameState.js'
import { drawGoods } from '../model/haversack.js'
import { placeMarker } from '../model/locationControl.js'
import { goodCounts, type GoodCounts } from '../model/stateSchemas.js'
import { canonicalOf } from '../testing/state.js'
import { tableAtPlayingCards, type Table } from '../testing/table.js'
import { ChooseFavours, chooseFavoursOffer, reasonChooseFavoursRefused } from './chooseFavours.js'
import { Harvest, harvestOffers, harvestTotal, reasonHarvestRefused } from './harvest.js'

const Farm: SpaceId = 'space.forest.1'
const Second: SpaceId = 'space.forest.3'
const Third: SpaceId = 'space.desert.1'

function sum(counts: Readonly<Record<Good, number>>): number {
    return Goods.reduce((total, good) => total + counts[good], 0)
}

function rule(
    state: HydratedFeudumGameState,
    playerId: string,
    spaceId: SpaceId,
    kind: LocationKind
): void {
    state.spaces[spaceId].location.kind = kind
    placeMarker(state, playerId, spaceId)
}

/** A bead of this value off the pile, in the seat's hands, so a spec knows the yield. */
function giveBead(state: HydratedFeudumGameState, playerId: string, value: BeadValue): SealId {
    const pile = state.requireVault().sealPile
    const index = pile.findIndex(
        (sealId) => Seals.find((seal) => seal.id === sealId)?.beadValue === value
    )
    expect(index).toBeGreaterThanOrEqual(0)
    const [sealId] = pile.splice(index, 1)
    state.supply.sealPileCount -= 1
    state.getPlayerState(playerId).beads.push(sealId)
    return sealId
}

/** Moves goods out of the haversack onto a space, keeping totals. */
function goodsOnto(state: HydratedFeudumGameState, spaceId: SpaceId, amount: number): void {
    let left = amount
    for (const good of Goods) {
        const moved = Math.min(left, state.supply.haversack[good])
        state.supply.haversack[good] -= moved
        state.spaces[spaceId].goods[good] += moved
        left -= moved
    }
}

/** Leaves the haversack holding `left` goods; the rest go beside a far space, keeping totals. */
function shortHaversack(state: HydratedFeudumGameState, left: number): void {
    goodsOnto(state, 'space.desert.2', sum(state.supply.haversack) - left)
}

/** Every good on a space goes back to the haversack, keeping totals. */
function clearGoods(state: HydratedFeudumGameState, spaceId: SpaceId): void {
    for (const good of Goods) {
        state.supply.haversack[good] += state.spaces[spaceId].goods[good]
        state.spaces[spaceId].goods[good] = 0
    }
}

interface Harvesting {
    readonly table: Table
    readonly playerId: string
}

const Cards: ActionCardKind[] = ['harvest', 'tax', 'guild']

/** The seat asked rules an empty farm, and `edit` sets out the rest. */
function tableHarvesting(
    edit?: (state: HydratedFeudumGameState, playerId: string) => void,
    cards: ActionCardKind[] = Cards,
    pouchGood?: 'sulfur'
): Harvesting {
    const table = tableAtPlayingCards(() => ({ cards, pouchGood }))
    const playerId = table.asked
    table.moveTo((state) => {
        clearGoods(state, Farm)
        rule(state, playerId, Farm, 'farm')
        edit?.(state, playerId)
        state.recomputeRanks()
        return MachineState.PlayingCards
    })
    return { table, playerId }
}

function harvest(
    table: Table,
    playerId: string,
    mode: 'plain' | 'favours' | 'inspect',
    extra: Record<string, unknown> = {}
) {
    const [action] = table.send(playerId, {
        type: ActionType.Harvest,
        revealsInfo: true,
        spaceId: Farm,
        mode,
        ...extra
    })
    return action
}

function noFarmerPawn(state: HydratedFeudumGameState, playerId: string): void {
    state.getPlayerState(playerId).pawns[0].character = 'knight'
}

/** A choice of `count` goods from what the Action drew, by the order of `Goods`. */
function firstOf(drawn: GoodCounts, count: number): GoodCounts {
    const chosen = goodCounts()
    let left = count
    for (const good of Goods) {
        chosen[good] = Math.min(left, drawn[good])
        left -= chosen[good]
    }
    return chosen
}

describe('Harvest: R-3.11.1', () => {
    it('R-3.11.1 one farm: 5 goods onto it and 1 vp', () => {
        const { table, playerId } = tableHarvesting()
        const { score } = table.seat(playerId)
        const before = { ...table.state.supply.haversack }

        const action = harvest(table, playerId, 'plain')

        const after = table.hydrated()
        const onFarm = after.spaces[Farm].goods
        expect(sum(onFarm)).toBe(5)
        for (const good of Goods) {
            expect(after.supply.haversack[good]).toBe(before[good] - onFarm[good])
        }
        expect(after.getPlayerState(playerId).score).toBe(score + 1)
        expect(after.getPlayerState(playerId).played).toEqual([{ kind: 'harvest', use: 'regular' }])
        expect(action).toMatchObject({
            metadata: { total: 5, drawn: onFarm, vp: 1, beadsFlipped: 0 }
        })
        expect(action).not.toHaveProperty('metadata.favours')
    })

    it('R-3.11.1 +1 per other farm or feudum ruled; a town or outpost adds nothing', () => {
        const { table, playerId } = tableHarvesting((state, seat) => {
            rule(state, seat, Second, 'farm')
            rule(state, seat, Third, 'feudum')
        })
        expect(harvestTotal(table.hydrated(), playerId)).toBe(7)

        const other = tableHarvesting((state, seat) => {
            rule(state, seat, Second, 'town')
            rule(state, seat, Third, 'outpost')
        })
        expect(harvestTotal(other.table.hydrated(), other.playerId)).toBe(5)
    })

    it("R-3.11.1 +each held bead's value", () => {
        const { table, playerId } = tableHarvesting((state, seat) => {
            giveBead(state, seat, 2)
            giveBead(state, seat, 3)
        })
        expect(harvestTotal(table.hydrated(), playerId)).toBe(10)

        const action = harvest(table, playerId, 'plain')

        expect(action).toMatchObject({ metadata: { total: 10 } })
        expect(sum(table.hydrated().spaces[Farm].goods)).toBe(10)
    })

    it('R-3.11.1 at most 10, whatever the yield', () => {
        const { table, playerId } = tableHarvesting((state, seat) => {
            giveBead(state, seat, 3)
            giveBead(state, seat, 3)
        })
        expect(harvestTotal(table.hydrated(), playerId)).toBe(10)
    })

    it('R-3.11.1 a farm at 9 takes the whole draw: only the harvest itself is capped', () => {
        const { table, playerId } = tableHarvesting((state) => goodsOnto(state, Farm, 9))

        harvest(table, playerId, 'plain')

        expect(sum(table.hydrated().spaces[Farm].goods)).toBe(14)
    })

    it('R-3.11.1 refuses a farm at 10, one not ruled, and what is no farm', () => {
        const { table, playerId } = tableHarvesting((state) => goodsOnto(state, Farm, 10))
        const state = table.hydrated()

        expect(reasonHarvestRefused(state, playerId, { spaceId: Farm, mode: 'plain' })).toBe(
            'That farm has 10 goods: it takes no harvest until it drops below that.'
        )
        expect(() => harvest(table, playerId, 'plain')).toThrow(
            'That farm has 10 goods: it takes no harvest until it drops below that.'
        )

        const unruled = tableHarvesting((edit) => {
            edit.spaces[Second].location.kind = 'farm'
        })
        expect(
            reasonHarvestRefused(unruled.table.hydrated(), unruled.playerId, {
                spaceId: Second,
                mode: 'plain'
            })
        ).toBe("You don't rule that farm.")

        const town = tableHarvesting((edit, seat) => rule(edit, seat, Second, 'town'))
        expect(
            reasonHarvestRefused(town.table.hydrated(), town.playerId, {
                spaceId: Second,
                mode: 'plain'
            })
        ).toBe("That isn't a farm.")
    })

    it('R-3.2 refuses when it is not your turn or the card is not in the hand', () => {
        const { table, playerId } = tableHarvesting()
        const other = table.order.find((seat) => seat !== playerId) ?? ''
        expect(
            reasonHarvestRefused(table.hydrated(), other, { spaceId: Farm, mode: 'plain' })
        ).toBe("It isn't your turn.")

        const noCard = tableHarvesting(undefined, ['tax', 'guild'])
        expect(
            reasonHarvestRefused(noCard.table.hydrated(), noCard.playerId, {
                spaceId: Farm,
                mode: 'plain'
            })
        ).toBe("Harvest isn't in your hand.")
    })

    it('R-1.1-H1 a haversack that runs short gives what remains, and the vp still scores', () => {
        const { table, playerId } = tableHarvesting((state) => shortHaversack(state, 3))
        const { score } = table.seat(playerId)

        const action = harvest(table, playerId, 'plain')

        expect(sum(table.hydrated().spaces[Farm].goods)).toBe(3)
        expect(sum(table.state.supply.haversack)).toBe(0)
        expect(table.seat(playerId).score).toBe(score + 1)
        expect(action).toMatchObject({ metadata: { total: 5 } })
    })

    it('R-X.2 Harvest is a barrier, in every mode', () => {
        for (const mode of ['plain', 'favours', 'inspect'] as const) {
            const { table, playerId } = tableHarvesting()
            expect(harvest(table, playerId, mode).revealsInfo).toBe(true)
        }
    })

    it('R-5.2 the draw moves the protected cursor and not the public one', () => {
        const { table, playerId } = tableHarvesting()
        const before = table.hydrated()
        const protectedBefore = before.protectedPrng?.invocations ?? 0
        const publicBefore = before.prng.invocations

        harvest(table, playerId, 'plain')

        // The public cursor pays only for the AdvanceTurn's id, as a card that draws nothing does.
        const { table: forfeiting, playerId: seat } = tableHarvesting()
        forfeiting.send(seat, { type: ActionType.ForfeitCard, kind: 'harvest' })
        const idOnly = forfeiting.hydrated().prng.invocations - publicBefore

        const after = table.hydrated()
        expect(after.protectedPrng?.invocations).toBe(protectedBefore + 5)
        expect(after.prng.invocations).toBe(publicBefore + idOnly)
    })

    it('R-3.2 ends the turn: the next seat is asked', () => {
        const { table, playerId } = tableHarvesting()

        harvest(table, playerId, 'plain')

        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).not.toBe(playerId)
    })

    it('R-3.15 Déjà Vu replays Harvest for a saltpeter, which goes back before the draw', () => {
        const { table, playerId } = tableHarvesting(
            (state, seat) => {
                rule(state, seat, Second, 'farm')
                state.getPlayerState(seat).played = [{ kind: 'harvest', use: 'regular' }]
            },
            ['repeat', 'tax', 'guild']
        )
        const { saltpeter } = table.seat(playerId).goods
        const before = sum(table.state.supply.haversack)

        harvest(table, playerId, 'plain', { asRepeat: 'deja-vu' })

        expect(table.seat(playerId).goods.saltpeter).toBe(saltpeter - 1)
        expect(sum(table.state.supply.haversack)).toBe(before + 1 - 6)
        expect(table.seat(playerId).repeatUsed).toBe(true)
    })

    it('the validator refuses a mode the card has none of', () => {
        const { table, playerId } = tableHarvesting()
        expect(() => harvest(table, playerId, 'plain', { mode: 'all' })).toThrow()
    })

    it('is an API action', () => {
        expect(FeudumApiActions[ActionType.Harvest]).toBe(Harvest)
        expect(FeudumApiActions[ActionType.ChooseFavours]).toBe(ChooseFavours)
    })
})

describe('Harvest with favours: R-3.11.2, R-3.11-H1', () => {
    const YieldBeads: readonly (readonly [number, readonly BeadValue[]])[] = [
        [5, []],
        [7, [2]],
        [8, [3]],
        [9, [2, 2]],
        [10, [2, 3]]
    ]

    it.each(YieldBeads)('R-3.11.2 total %i: the chart splits it', (total, beads) => {
        const { table, playerId } = tableHarvesting((state, seat) => {
            for (const bead of beads) {
                giveBead(state, seat, bead)
            }
        })
        const row = HarvestCardChart.find((candidate) => candidate.total === total)
        const before = { ...table.seat(playerId).goods }

        const action = harvest(table, playerId, 'favours')

        const after = table.hydrated()
        const seat = after.getPlayerState(playerId).goods
        const toSeat = goodCounts()
        for (const good of Goods) {
            toSeat[good] = seat[good] - before[good]
        }
        expect(sum(after.spaces[Farm].goods)).toBe(row?.partial)
        expect(sum(toSeat)).toBe(row?.favors)
        expect(action).toMatchObject({ metadata: { total, favours: toSeat } })
    })

    it('R-3.11.2 total 6, from another farm: 5 and 1', () => {
        const { table, playerId } = tableHarvesting((state, seat) =>
            rule(state, seat, Second, 'farm')
        )

        const action = harvest(table, playerId, 'favours')

        expect(sum(table.hydrated().spaces[Farm].goods)).toBe(5)
        expect(action).toMatchObject({ metadata: { total: 6, beadsFlipped: 0 } })
    })

    it('R-3.11-H1 the seat chooses nothing: the partial is drawn first, the favours after', () => {
        const { table, playerId } = tableHarvesting()
        const copy = new HydratedFeudumGameState(table.state)
        const order = drawGoods(copy, 5)
        const expected = goodCounts()
        expected[order[4]] = 1

        const action = harvest(table, playerId, 'favours')

        expect(action).toMatchObject({ metadata: { favours: expected } })
    })

    it('R-4.10-H2 favours drawn unseen go to the supply: the seat could not name the barrel', () => {
        const { table, playerId } = tableHarvesting((state, seat) => {
            for (const good of ['food', 'wood', 'iron', 'saltpeter'] as const) {
                state.getPlayerState(seat).goods[good] += state.supply.haversack[good]
                state.supply.haversack[good] = 0
            }
        })
        const { sulfur } = table.seat(playerId).goods

        const action = harvest(table, playerId, 'favours')

        expect(action).toMatchObject({ metadata: { favours: { sulfur: 1 } } })
        expect(table.seat(playerId).goods.sulfur).toBe(sulfur + 1)
        expect(table.seat(playerId).barrel).toBe(0)
    })

    it('R-3.11.2 every held bead flips to a seal, whose identity goes into the vault', () => {
        let beads: SealId[] = []
        const { table, playerId } = tableHarvesting((state, seat) => {
            beads = [giveBead(state, seat, 2), giveBead(state, seat, 3)]
        })
        const { sealCount } = table.seat(playerId)

        const action = harvest(table, playerId, 'favours')

        const after = table.hydrated()
        const player = after.getPlayerState(playerId)
        expect(player.beads).toEqual([])
        expect(player.sealCount).toBe(sealCount + 2)
        expect(after.requireVault().heldSeals[playerId]).toEqual(expect.arrayContaining(beads))
        expect(action).toMatchObject({ metadata: { beadsFlipped: 2 } })
    })

    it('R-5-H1 no public field or record names the flipped seal', () => {
        let bead: SealId = 'seal.1'
        const { table, playerId } = tableHarvesting((state, seat) => {
            bead = giveBead(state, seat, 2)
        })
        const named = new RegExp(`"${bead}"`)

        const action = harvest(table, playerId, 'favours')

        const { vault, ...publicState } = canonicalOf(table.hydrated())
        expect(JSON.stringify(publicState)).not.toMatch(named)
        expect(JSON.stringify(vault)).toMatch(named)
        expect(action).toMatchObject({ metadata: { beadsFlipped: 1 } })
        expect(JSON.stringify('metadata' in action && action.metadata)).not.toMatch(named)
    })

    it('R-3.11.2 plain keeps the beads', () => {
        const { table, playerId } = tableHarvesting((state, seat) => {
            giveBead(state, seat, 2)
        })

        harvest(table, playerId, 'plain')

        expect(table.seat(playerId).beads).toHaveLength(1)
    })

    it('R-3.11-H2 a short haversack fills the partial first', () => {
        const { table, playerId } = tableHarvesting((state, seat) => {
            shortHaversack(state, 6)
            giveBead(state, seat, 2)
        })
        const held = sum(table.seat(playerId).goods)

        const action = harvest(table, playerId, 'favours')

        expect(sum(table.hydrated().spaces[Farm].goods)).toBe(5)
        expect(sum(table.seat(playerId).goods)).toBe(held + 1)
        expect(action).toMatchObject({ metadata: { total: 7, beadsFlipped: 1 } })
    })

    it('R-3.11-H2 with no good left for a favour none was taken, so the beads stay', () => {
        const { table, playerId } = tableHarvesting((state, seat) => {
            shortHaversack(state, 4)
            giveBead(state, seat, 2)
        })

        const action = harvest(table, playerId, 'favours')

        expect(sum(table.hydrated().spaces[Farm].goods)).toBe(4)
        expect(table.seat(playerId).beads).toHaveLength(1)
        expect(action).toMatchObject({ metadata: { beadsFlipped: 0 } })
    })
})

describe('Inspect the Harvest: R-3.11.3', () => {
    it('R-3.11.3 needs a Farmer pawn on the board', () => {
        const { table, playerId } = tableHarvesting(noFarmerPawn)

        expect(
            reasonHarvestRefused(table.hydrated(), playerId, { spaceId: Farm, mode: 'inspect' })
        ).toBe('Inspect the Harvest needs a Farmer pawn on the board.')
        expect(
            reasonHarvestRefused(table.hydrated(), playerId, { spaceId: Farm, mode: 'plain' })
        ).toBeUndefined()
    })

    it('R-3.11.3 the total waits in the open, the vp scored, the harvester asked', () => {
        const { table, playerId } = tableHarvesting((state, seat) => {
            giveBead(state, seat, 2)
        })
        const { score } = table.seat(playerId)
        const before = sum(table.state.supply.haversack)

        const action = harvest(table, playerId, 'inspect')

        expect(table.state.machineState).toBe(MachineState.InspectingHarvest)
        expect(table.asked).toBe(playerId)
        expect(table.offered(playerId)).toEqual([ActionType.ChooseFavours])
        const { flow, spaces } = table.hydrated()
        expect(flow.harvest).toMatchObject({ playerId, spaceId: Farm, favours: 2 })
        expect(sum(flow.harvest?.drawn ?? goodCounts())).toBe(7)
        expect(sum(spaces[Farm].goods)).toBe(0)
        expect(sum(table.state.supply.haversack)).toBe(before - 7)
        expect(table.seat(playerId).score).toBe(score + 1)
        expect(table.seat(playerId).played).toEqual([{ kind: 'harvest', use: 'special' }])
        expect(table.seat(playerId).beads).toHaveLength(1)
        expect(action).toMatchObject({ metadata: { total: 7, drawn: flow.harvest?.drawn, vp: 1 } })
        expect(action).not.toHaveProperty('metadata.favours')
    })

    it('R-3.11.3 ChooseFavours takes the count: favours to the seat, the rest to the farm', () => {
        let bead: SealId = 'seal.1'
        const { table, playerId } = tableHarvesting((state, seat) => {
            bead = giveBead(state, seat, 2)
        })
        harvest(table, playerId, 'inspect')
        const drawn = table.hydrated().flow.harvest?.drawn ?? goodCounts()
        const favours = firstOf(drawn, 2)
        const before = { ...table.seat(playerId).goods }
        const { sealCount } = table.seat(playerId)

        const [action] = table.send(playerId, { type: ActionType.ChooseFavours, favours })

        const after = table.hydrated()
        const seat = after.getPlayerState(playerId)
        for (const good of Goods) {
            expect(seat.goods[good]).toBe(before[good] + favours[good])
            expect(after.spaces[Farm].goods[good]).toBe(drawn[good] - favours[good])
        }
        expect(after.flow.harvest).toBeUndefined()
        expect(seat.beads).toEqual([])
        expect(seat.sealCount).toBe(sealCount + 1)
        expect(after.requireVault().heldSeals[playerId]).toContain(bead)
        expect(action).toMatchObject({
            metadata: { spaceId: Farm, drawn, favours, beadsFlipped: 1 }
        })
        expect(action.revealsInfo).toBeFalsy()
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).not.toBe(playerId)
    })

    it('R-3.11.3 none: every good to the farm, and the beads stay', () => {
        const { table, playerId } = tableHarvesting((state, seat) => {
            giveBead(state, seat, 2)
        })
        harvest(table, playerId, 'inspect')
        const drawn = table.hydrated().flow.harvest?.drawn
        const before = { ...table.seat(playerId).goods }

        const [action] = table.send(playerId, { type: ActionType.ChooseFavours, favours: null })

        expect(table.hydrated().spaces[Farm].goods).toEqual(drawn)
        expect(table.seat(playerId).goods).toEqual(before)
        expect(table.seat(playerId).beads).toHaveLength(1)
        expect(action).toMatchObject({
            metadata: { spaceId: Farm, drawn, favours: goodCounts(), beadsFlipped: 0 }
        })
        expect(action.revealsInfo).toBeFalsy()
    })

    it('R-3.11-H1 a seat with no bead may inspect and choose too', () => {
        const { table, playerId } = tableHarvesting()
        harvest(table, playerId, 'inspect')
        const drawn = table.hydrated().flow.harvest?.drawn ?? goodCounts()

        const [action] = table.send(playerId, {
            type: ActionType.ChooseFavours,
            favours: firstOf(drawn, 1)
        })

        expect(sum(table.hydrated().spaces[Farm].goods)).toBe(4)
        expect(action).toMatchObject({ metadata: { beadsFlipped: 0 } })
    })

    it('R-3.11.3 refuses a wrong count, goods not drawn, and any other seat', () => {
        const { table, playerId } = tableHarvesting((state, seat) => {
            giveBead(state, seat, 2)
        })
        harvest(table, playerId, 'inspect')
        const state = table.hydrated()
        const drawn = state.flow.harvest?.drawn ?? goodCounts()
        const other = table.order.find((seat) => seat !== playerId) ?? ''

        expect(reasonChooseFavoursRefused(state, playerId, firstOf(drawn, 1))).toBe(
            'Take 2 goods as favours, or none.'
        )
        // Seven goods of five kinds: some kind was drawn fewer than twice.
        const scarce = Goods.find((good) => drawn[good] < 2)
        assertExists(scarce, 'Some kind was drawn fewer than twice')
        expect(reasonChooseFavoursRefused(state, playerId, goodCounts({ [scarce]: 2 }))).toBe(
            "You can't take goods the harvest didn't draw."
        )
        expect(reasonChooseFavoursRefused(state, other, null)).toBe("You aren't choosing favours.")
        expect(table.offered(other)).toEqual([])
        expect(() =>
            table.send(playerId, { type: ActionType.ChooseFavours, favours: firstOf(drawn, 3) })
        ).toThrow('Take 2 goods as favours, or none.')
    })

    it('R-3.11-H2 a short draw owes only what is past the partial', () => {
        const { table, playerId } = tableHarvesting((state, seat) => {
            shortHaversack(state, 6)
            giveBead(state, seat, 2)
        })

        harvest(table, playerId, 'inspect')

        expect(table.hydrated().flow.harvest).toMatchObject({ favours: 1 })
    })

    it('R-3.11-H2 a draw of the partial or less leaves no favour to choose: no one is asked', () => {
        const { table, playerId } = tableHarvesting((state, seat) => {
            shortHaversack(state, 5)
            giveBead(state, seat, 2)
        })

        harvest(table, playerId, 'inspect')

        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.hydrated().flow.harvest).toBeUndefined()
        expect(sum(table.hydrated().spaces[Farm].goods)).toBe(5)
        expect(table.seat(playerId).beads).toHaveLength(1)
    })

    it('R-3.3-H1 a declared second card comes after the favours', () => {
        const { table, playerId } = tableHarvesting(undefined, Cards, 'sulfur')

        harvest(table, playerId, 'inspect', { secondCard: true })
        expect(table.state.machineState).toBe(MachineState.InspectingHarvest)

        table.send(playerId, { type: ActionType.ChooseFavours, favours: null })

        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).toBe(playerId)
    })
})

describe('What the panel reads (S20, S21)', () => {
    it('R-3.11.1 offers each ruled farm under 10 goods with its split and the beads at stake', () => {
        const { table, playerId } = tableHarvesting((state, seat) => {
            rule(state, seat, Second, 'farm')
            goodsOnto(state, Second, 10)
            giveBead(state, seat, 2)
        })

        expect(harvestOffers(table.hydrated(), playerId)).toEqual({
            farms: [{ spaceId: Farm, total: 8, partial: 5, favours: 3 }],
            beads: 1,
            inspect: true
        })
    })

    it('R-3.11.1 a seat with no farm is offered none, and the rule still reads', () => {
        const table = tableAtPlayingCards(() => ({ cards: Cards }))

        expect(harvestOffers(table.hydrated(), table.asked).farms).toEqual([])
    })

    it('R-3.11.3 offers Inspect only with a Farmer pawn', () => {
        const { table, playerId } = tableHarvesting(noFarmerPawn)

        expect(harvestOffers(table.hydrated(), playerId).inspect).toBe(false)
    })

    it('R-3.11.3 the choice shows the drawn goods and how many to take', () => {
        const { table, playerId } = tableHarvesting()
        harvest(table, playerId, 'inspect')
        const state = table.hydrated()

        expect(chooseFavoursOffer(state, playerId)).toEqual({
            spaceId: Farm,
            drawn: state.flow.harvest?.drawn,
            favours: 1,
            beads: 0,
            sulfurToBarrel: Math.min(state.flow.harvest?.drawn.sulfur ?? 0, 1)
        })
        expect(chooseFavoursOffer(state, 'nobody')).toBeUndefined()
    })
})
