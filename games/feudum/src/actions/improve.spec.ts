import { describe, expect, it } from 'vitest'
import type { SpaceId } from '../data/board.js'
import type { GuildId } from '../data/components.js'
import type { DiscId } from '../data/discs.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { discChoices } from '../model/locationDiscs.js'
import { placeMarker } from '../model/locationControl.js'
import { giveGood, giveSeal, setUp, spaceOfKind, tableImproving } from '../testing/improving.js'
import { tableAtPlayingCards, type Table } from '../testing/table.js'
import { improveOffers, isImprove, reasonImproveRefused } from './improve.js'

/** Puts a disc of the supply on another space of this kind, whose own disc returns to the supply. */
function takeOutOfSupply(state: HydratedFeudumGameState, discId: DiscId, onto: SpaceId): void {
    const { location } = state.spaces[onto]
    state.supply.discs = [...state.supply.discs.filter((id) => id !== discId), location.discId]
    location.discId = discId
}

function improve(table: Table, playerId: string, spaceId: SpaceId, more = {}) {
    return table.send(playerId, { type: ActionType.Improve, spaceId, ...more })
}

const FarmDisc: DiscId = 'disc.double.1'
const OutpostFarmDisc: DiscId = 'disc.double.9'
const OutpostTownDisc: DiscId = 'disc.double.10'

describe('R-3.9.1 outpost to farm', () => {
    function atOutpost() {
        const start = tableImproving('outpost')
        setUp(start.table, (state) => {
            giveGood(state, start.playerId, 'wood')
        })
        return start
    }

    it('turns in a wood, takes a farm disc, returns the outpost, and keeps the goods as harvest', () => {
        const { table, playerId, spaceId } = atOutpost()
        setUp(table, (state) => {
            state.supply.haversack.food -= 1
            state.spaces[spaceId].goods.food += 1
        })
        const before = table.hydrated()
        const { discId: oldDisc } = before.spaces[spaceId].location
        const goods = { ...before.spaces[spaceId].goods }
        const wood = before.supply.haversack.wood

        const [action] = improve(table, playerId, spaceId, { discId: FarmDisc })

        const after = table.hydrated()
        const space = after.spaces[spaceId]
        expect(space.location).toEqual({ kind: 'farm', discId: FarmDisc, face: 'a' })
        expect(space.ruler).toEqual({ playerId, subject: false })
        expect(after.supply.discs).toContain(oldDisc)
        expect(after.supply.discs).not.toContain(FarmDisc)
        expect(after.getPlayerState(playerId).goods.wood).toBe(0)
        expect(after.supply.haversack.wood).toBe(wood + 1)
        expect(space.goods).toEqual(goods)
        expect(after.getPlayerState(playerId).played).toEqual([{ kind: 'improve', use: 'regular' }])
        expect(after.getPlayerState(playerId).hand).toEqual(['move', 'tax', 'guild'])
        expect(action).toMatchObject({
            metadata: { from: 'outpost', to: 'farm', discId: FarmDisc }
        })
        expect(action).not.toHaveProperty('metadata.goodsToHaversack')
    })

    it('R-3.2 passes the turn', () => {
        const { table, playerId, spaceId } = atOutpost()
        improve(table, playerId, spaceId, { discId: FarmDisc })
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).toBe(table.order[1])
    })

    it('R-X.2, R-1.4-H2 is a barrier when it takes a tile, whose landscape was hidden', () => {
        const { table, playerId, spaceId } = atOutpost()
        const [action] = improve(table, playerId, spaceId, { discId: FarmDisc })
        expect(action).toHaveProperty('metadata.tile')
        expect(action.revealsInfo).toBe(true)
    })

    it('needs a wood', () => {
        const { table, playerId, spaceId } = tableImproving('outpost')
        expect(() => improve(table, playerId, spaceId, { discId: FarmDisc })).toThrow(
            'Improving an outpost to a farm needs a wood.'
        )
    })
})

describe('R-3.9.1 farm to town', () => {
    it('turns in an iron and sends the farm goods to the haversack', () => {
        const { table, playerId, spaceId } = tableImproving('farm')
        setUp(table, (state) => {
            state.supply.haversack.food -= 2
            state.spaces[spaceId].goods.food += 2
        })
        const before = table.hydrated()
        const iron = before.getPlayerState(playerId).goods.iron
        const { goods } = before.spaces[spaceId]
        const food = before.supply.haversack.food + goods.food

        const [action] = improve(table, playerId, spaceId, { discId: FarmDisc })

        const after = table.hydrated()
        expect(after.spaces[spaceId].location).toEqual({
            kind: 'town',
            discId: FarmDisc,
            face: 'b'
        })
        expect(Object.values(after.spaces[spaceId].goods).every((count) => count === 0)).toBe(true)
        expect(after.supply.haversack.food).toBe(food)
        expect(after.getPlayerState(playerId).goods.iron).toBe(iron - 1)
        expect(action).toMatchObject({
            metadata: { from: 'farm', to: 'town', goodsToHaversack: goods }
        })
    })

    it('needs an iron', () => {
        const { table, playerId, spaceId } = tableImproving('farm')
        setUp(table, (state) => {
            state.getPlayerState(playerId).goods.iron -= 1
            state.supply.haversack.iron += 1
        })
        expect(() => improve(table, playerId, spaceId, { discId: FarmDisc })).toThrow(
            'Improving a farm to a town needs an iron.'
        )
    })
})

describe('R-3.9.1 town to feudum', () => {
    function atTown() {
        const start = tableImproving('town')
        setUp(start.table, (state) => {
            giveSeal(state, start.playerId)
        })
        return start
    }

    it('S15 turns in a seal to the pile, reshuffled; the guild chosen; goods stay', () => {
        const { table, playerId, spaceId } = atTown()
        const before = table.hydrated()
        const vault = before.requireVault()
        const [held] = vault.heldSeals[playerId]
        const pile = [...vault.sealPile]
        const goods = { ...before.spaces[spaceId].goods }

        const [action] = improve(table, playerId, spaceId, { feudumGuild: 'noble' })

        const after = table.hydrated()
        const seat = after.getPlayerState(playerId)
        expect(after.spaces[spaceId].location).toEqual({
            kind: 'feudum',
            discId: 'disc.feudum.noble-1',
            face: 'a',
            feudumGuild: 'noble'
        })
        expect(after.spaces[spaceId].goods).toEqual(goods)
        expect(seat.sealCount).toBe(0)
        expect(after.supply.sealPileCount).toBe(pile.length + 1)
        const newPile = after.requireVault().sealPile
        expect([...newPile].sort()).toEqual([...pile, held].sort())
        expect(newPile).not.toEqual([...pile, held])
        expect(action).toMatchObject({
            metadata: { from: 'town', to: 'feudum', discId: 'disc.feudum.noble-1' }
        })
        const metadata = isImprove(action) ? action.metadata : undefined
        expect(metadata).toBeDefined()
        expect(JSON.stringify(metadata)).not.toContain(held)
        expect(after.isVassal(playerId)).toBe(true)
    })

    it('R-4.5.4 records the rank the feudum gives', () => {
        const { table, playerId, spaceId } = atTown()
        const [action] = improve(table, playerId, spaceId, { feudumGuild: 'noble' })
        expect(table.hydrated().statusStars(playerId, 'noble')).toBeGreaterThanOrEqual(3)
        expect(action).toMatchObject({
            metadata: { rankChanges: [{ guildId: 'noble', playerId, to: 'master' }] }
        })
    })

    it('takes the second feudum of a guild when the first is out', () => {
        const { table, playerId, spaceId } = atTown()
        setUp(table, (state) => {
            takeOutOfSupply(state, 'disc.feudum.noble-1', spaceOfKind(state, 'outpost'))
        })
        const [action] = improve(table, playerId, spaceId, { feudumGuild: 'noble' })
        expect(action).toMatchObject({ metadata: { discId: 'disc.feudum.noble-2' } })
    })

    it('needs a seal, a guild, and a feudum of that guild left', () => {
        const noSeal = tableImproving('town')
        expect(() =>
            improve(noSeal.table, noSeal.playerId, noSeal.spaceId, { feudumGuild: 'noble' })
        ).toThrow("Improving a town to a feudum needs a king's seal.")

        const { table, playerId, spaceId } = atTown()
        expect(() => improve(table, playerId, spaceId)).toThrow('Choose a guild for the feudum.')

        setUp(table, (state) => {
            const [first, second] = [spaceOfKind(state, 'outpost'), spaceOfKind(state, 'farm')]
            takeOutOfSupply(state, 'disc.feudum.noble-1', first)
            takeOutOfSupply(state, 'disc.feudum.noble-2', second)
        })
        expect(() => improve(table, playerId, spaceId, { feudumGuild: 'noble' })).toThrow(
            'No Noble feudum remains.'
        )
    })

    it('a guild is chosen only for a feudum', () => {
        const { table, playerId, spaceId } = tableImproving('farm')
        expect(() =>
            improve(table, playerId, spaceId, { feudumGuild: 'noble', discId: FarmDisc })
        ).toThrow('Only a feudum takes a guild.')
    })

    it.each<GuildId>(['farmer', 'merchant', 'alchemist', 'knight', 'noble', 'monk'])(
        'R-1.2.4 %s has its own feudums',
        (feudumGuild) => {
            const { table, playerId, spaceId } = atTown()
            const [action] = improve(table, playerId, spaceId, { feudumGuild })
            expect(action).toMatchObject({ metadata: { discId: `disc.feudum.${feudumGuild}-1` } })
            expect(table.hydrated().spaces[spaceId].location.feudumGuild).toBe(feudumGuild)
        }
    )
})

describe('R-3.9-H1 which disc', () => {
    it('the seat chooses when the candidates differ in their other face', () => {
        const { table } = tableImproving('outpost')
        const state = table.hydrated()
        expect(discChoices(state, 'farm')).toEqual([
            { discId: FarmDisc, other: 'town' },
            { discId: OutpostFarmDisc, other: 'outpost' }
        ])
        expect(discChoices(state, 'town')).toEqual([
            { discId: FarmDisc, other: 'farm' },
            { discId: OutpostTownDisc, other: 'outpost' }
        ])
    })

    it('a choice is required, and takes the face that shows the location', () => {
        const { table, playerId, spaceId } = tableImproving('outpost')
        setUp(table, (state) => {
            giveGood(state, playerId, 'wood')
        })
        expect(() => improve(table, playerId, spaceId)).toThrow('Choose which disc to take.')
        expect(() => improve(table, playerId, spaceId, { discId: 'disc.double.2' })).toThrow(
            'That disc is not on offer.'
        )

        improve(table, playerId, spaceId, { discId: OutpostFarmDisc })
        expect(table.hydrated().spaces[spaceId].location).toEqual({
            kind: 'farm',
            discId: OutpostFarmDisc,
            face: 'b'
        })
    })

    it('with one other face the lowest id is taken, unasked', () => {
        const { table, playerId, spaceId } = tableImproving('outpost')
        setUp(table, (state) => {
            giveGood(state, playerId, 'wood')
            // A space's outpost returns, which no farm can take.
            takeOutOfSupply(state, OutpostFarmDisc, spaceOfKind(state, 'outpost', [spaceId]))
        })
        expect(discChoices(table.hydrated(), 'farm')).toEqual([{ discId: FarmDisc, other: 'town' }])
        expect(() => improve(table, playerId, spaceId, { discId: FarmDisc })).toThrow(
            'There is no choice of disc here.'
        )

        const [action] = improve(table, playerId, spaceId)
        expect(action).toMatchObject({ metadata: { discId: FarmDisc } })
    })

    it('R-3.9-H2 a replaced disc can be taken again; a plain back is an other face of its own', () => {
        const { table, playerId, spaceId } = tableImproving('farm')
        const { discId: oldDisc } = table.hydrated().spaces[spaceId].location
        improve(table, playerId, spaceId, { discId: FarmDisc })
        const choices = discChoices(table.hydrated(), 'farm')
        expect(choices).toContainEqual({ discId: oldDisc })
        expect(choices).toHaveLength(3)
    })

    it('R-3.9-H2 with no disc of the location left, no improvement', () => {
        const { table, playerId, spaceId } = tableImproving('outpost')
        setUp(table, (state) => {
            giveGood(state, playerId, 'wood')
        })
        const state = table.hydrated()
        state.supply.discs = state.supply.discs.filter((id) => id === OutpostTownDisc)
        expect(reasonImproveRefused(state, playerId, { spaceId })).toBe('No farm disc remains.')
    })
})

describe('R-3.9.1 what may be improved', () => {
    it('only a location the seat rules', () => {
        const { table, playerId } = tableImproving('outpost')
        const other = table.order[1]
        const state = table.hydrated()
        const elsewhere = spaceOfKind(state, 'farm')
        expect(reasonImproveRefused(state, playerId, { spaceId: elsewhere })).toBe(
            "You don't rule that location."
        )
        setUp(table, (edited) => {
            placeMarker(edited, other, elsewhere)
            placeMarker(edited, playerId, elsewhere)
        })
        expect(reasonImproveRefused(table.hydrated(), playerId, { spaceId: elsewhere })).toBe(
            "You don't rule that location."
        )
    })

    it('never a feudum', () => {
        const { table, playerId, spaceId } = tableImproving('town')
        setUp(table, (state) => {
            state.spaces[spaceId].location.kind = 'feudum'
        })
        expect(reasonImproveRefused(table.hydrated(), playerId, { spaceId })).toBe(
            'A feudum cannot be improved.'
        )
    })

    it('R-3.2 only the turn player, holding the card', () => {
        const { table, playerId, spaceId } = tableImproving('farm', ['move', 'tax', 'guild'])
        expect(() => improve(table, playerId, spaceId, { discId: FarmDisc })).toThrow(
            "Improve isn't in your hand."
        )
        const start = tableImproving('farm')
        expect(
            reasonImproveRefused(start.table.hydrated(), start.table.order[1], { spaceId })
        ).toBe("It isn't your turn.")
    })
})

describe('R-3.15.2 Improve replayed', () => {
    it('has no x2, and Déjà Vu replays it for a saltpeter: one improvement per card', () => {
        const table = tableAtPlayingCards(
            () => ({ cards: ['improve', 'repeat', 'move', 'tax'] }),
            2
        )
        const playerId = table.asked
        const other = table.order[1]
        const first = spaceOfKind(table.hydrated(), 'farm')
        const second = spaceOfKind(table.hydrated(), 'farm', [first])
        setUp(table, (state) => {
            placeMarker(state, playerId, first)
            placeMarker(state, playerId, second)
            giveGood(state, playerId, 'iron')
        })
        improve(table, playerId, first, { discId: FarmDisc })
        table.send(other, { type: ActionType.ForfeitCard, kind: 'move' })

        expect(() =>
            improve(table, playerId, second, { discId: 'disc.double.2', asRepeat: 'repeat' })
        ).toThrow('Improve has no x2: only Déjà Vu replays it.')

        const choice = discChoices(table.hydrated(), 'town')[0]
        improve(table, playerId, second, { discId: choice.discId, asRepeat: 'deja-vu' })
        const seat = table.seat(playerId)
        expect(table.hydrated().spaces[second].location.kind).toBe('town')
        expect(seat.played.at(-1)).toEqual({
            kind: 'repeat',
            use: 'regular',
            replayedKind: 'improve',
            dejaVu: true
        })
    })
})

describe('R-3.9 improve offers', () => {
    it('R-3.5 the card offers both its plays', () => {
        const { table, playerId } = tableImproving('farm')
        expect(table.offered(playerId)).toEqual(
            expect.arrayContaining([ActionType.Improve, ActionType.TendLandscape])
        )
    })

    it('lights what can be improved, with the step, the cost and the tile', () => {
        const { table, playerId, spaceId } = tableImproving('farm')
        const offers = improveOffers(table.hydrated(), playerId)
        expect(offers).toHaveLength(1)
        expect(offers[0]).toMatchObject({
            spaceId,
            from: 'farm',
            to: 'town',
            cost: 'iron',
            discs: [
                { discId: FarmDisc, other: 'farm' },
                { discId: OutpostTownDisc, other: 'outpost' }
            ],
            tile: { kind: 'legal', vp: 3 }
        })
    })

    it('leaves out what the seat cannot pay for', () => {
        const { table, playerId } = tableImproving('outpost')
        expect(improveOffers(table.hydrated(), playerId)).toEqual([])
    })

    it('S15 offers the guilds with a feudum left', () => {
        const { table, playerId, spaceId } = tableImproving('town')
        setUp(table, (state) => {
            giveSeal(state, playerId)
            takeOutOfSupply(state, 'disc.feudum.noble-1', spaceOfKind(state, 'outpost'))
            takeOutOfSupply(state, 'disc.feudum.noble-2', spaceOfKind(state, 'farm'))
        })
        const [offer] = improveOffers(table.hydrated(), playerId)
        expect(offer).toMatchObject({ spaceId, to: 'feudum', cost: 'seal', discs: [] })
        expect(offer.feudumGuilds).toEqual(['farmer', 'merchant', 'alchemist', 'knight', 'monk'])
    })
})
