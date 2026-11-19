import { Color } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { FeudumRuntime } from '../definition/runtime.js'
import { ComponentTotals, GoodRows } from '../data/components.js'
import { LocationDiscs } from '../data/discs.js'
import { RegionTiles } from '../data/regionTiles.js'
import { Seals } from '../data/seals.js'
import { canonicalState } from '../testing/state.js'
import {
    conservationBreaks,
    FeudumCanonicalStateValidator,
    type ConservedComponent
} from './canonicalValidator.js'
import type { FeudumGameState } from './gameState.js'

function table(numPlayers = 4): FeudumGameState {
    return canonicalState(numPlayers)
}

function colourOf(state: FeudumGameState, playerId: string): Color {
    return state.players.filter((player) => player.playerId === playerId)[0].color
}

/** Lays a tile on a space with its landscape shown. */
function landscapeOn(
    state: FeudumGameState,
    kind: 'orchard' | 'silver-mine' | 'archery-butt' | 'sulfur-mine',
    amount: number
) {
    const tileId = state.regionStacks.sea.shift()
    if (tileId === undefined) {
        throw Error('the sea stack is empty')
    }
    state.spaces['space.sea.1'].landscape = { tileId, amount }
    // The dealt landscape of the same epoch and kind trades places with this tile's.
    const swapped = Object.keys(state.vault.tileLandscapes).filter(
        (tile) =>
            tile !== tileId && tile.endsWith('.i') && state.vault.tileLandscapes[tile] === kind
    )[0]
    const dealt = state.vault.tileLandscapes[tileId]
    delete state.vault.tileLandscapes[tileId]
    state.tileLandscapes[tileId] = kind
    if (dealt !== kind) {
        state.vault.tileLandscapes[swapped] = dealt
    }
}

function expectConserved(state: FeudumGameState) {
    expect(conservationBreaks(state)).toEqual([])
    expect(FeudumCanonicalStateValidator.Check(state)).toBe(true)
}

function expectBroken(state: FeudumGameState, component: ConservedComponent) {
    expect(conservationBreaks(state).map((broken) => broken.component)).toContain(component)
    expect(FeudumCanonicalStateValidator.Check(state)).toBe(false)
}

describe('the canonical validator', () => {
    it('R-1.1 is the runtime validator', () => {
        expect(FeudumRuntime.canonicalStateValidator).toBe(FeudumCanonicalStateValidator)
    })

    it('R-1.1 accepts the initial table at 2 to 5 players', () => {
        for (const numPlayers of [2, 3, 4, 5]) {
            expectConserved(table(numPlayers))
        }
    })

    it('R-1.1 rejects what the schema rejects, before counting', () => {
        const state = table()
        expect(FeudumCanonicalStateValidator.Check({ ...state, epoch: 6 })).toBe(false)
        expect(FeudumCanonicalStateValidator.Check({ ...state, spaces: {} })).toBe(false)
        expect(FeudumCanonicalStateValidator.Check({ ...state, flow: undefined })).toBe(false)
    })

    it('R-1.1 names the totals it enforces', () => {
        expect(ComponentTotals.goods).toBe(170)
        expect(ComponentTotals.shillings).toBe(78)
        expect(ComponentTotals.markersPerColour).toBe(20)
        expect(ComponentTotals.vessels).toBe(9)
        expect(ComponentTotals.targets).toBe(12)
        expect(Seals).toHaveLength(17)
        expect(LocationDiscs).toHaveLength(44)
        expect(RegionTiles).toHaveLength(24)
    })
})

describe('R-1.1 goods, 170 in all', () => {
    it.each(GoodRows.map((row) => row.good))('R-1.1 rejects a %s made or lost', (good) => {
        const made = table()
        made.supply.haversack[good] += 1
        expectBroken(made, 'goods')
        const lost = table()
        lost.supply.haversack[good] -= 1
        expectBroken(lost, 'goods')
    })

    it('R-5.3 counts a good wherever it lies', () => {
        const moves: ((state: FeudumGameState) => void)[] = [
            (state) => (state.players[0].goods.iron += 1),
            (state) => (state.players[0].pouch = 'saltpeter'),
            (state) => (state.players[0].barrel = 1),
            (state) => (state.players[0].pawns[0].wine = 'fed'),
            (state) => (state.spaces['space.sea.1'].goods.iron += 1),
            (state) => (state.guilds.farmer.barn.iron += 1),
            (state) => (state.guilds.merchant.market['guild.merchant.space.saltpeter-4'] = true),
            (state) => (state.guilds.alchemist.carts['guild.alchemist.cart.food-2'] = true),
            (state) =>
                (state.flow.harvest = {
                    playerId: 'p1',
                    spaceId: 'space.sea.1',
                    drawn: { saltpeter: 0, sulfur: 0, iron: 1, wood: 0, food: 0 },
                    favours: 0
                })
        ]
        for (const move of moves) {
            const state = table()
            move(state)
            expectBroken(state, 'goods')
        }
    })

    it('R-5.3 keeps the total when a good moves from the haversack to a player', () => {
        const state = table()
        state.supply.haversack.iron -= 1
        state.players[0].goods.iron += 1
        expectConserved(state)
    })

    it('R-3.3, R-4.10.2 counts the pouch good, barrel sulfur and wine', () => {
        const state = table()
        state.supply.haversack.saltpeter -= 1
        state.players[0].pouch = 'saltpeter'
        state.supply.haversack.sulfur -= 2
        state.players[0].barrel = 1
        state.players[0].pawns[0].wine = 'drunk'
        expectConserved(state)
    })

    it('R-4.3.4 counts food on an orchard and sulfur on a sulfur mine', () => {
        const orchard = table()
        orchard.supply.haversack.food -= 3
        landscapeOn(orchard, 'orchard', 3)
        expectConserved(orchard)

        const mine = table()
        mine.supply.haversack.sulfur -= 3
        landscapeOn(mine, 'sulfur-mine', 3)
        expectConserved(mine)
    })
})

describe('R-1.1-H1 shillings, 78 in all', () => {
    it('R-1.1-H1 rejects a shilling made or lost', () => {
        const made = table()
        made.supply.shillings += 1
        expectBroken(made, 'shillings')
        const lost = table()
        lost.players[0].shillings += 1
        lost.supply.shillings -= 2
        expectBroken(lost, 'shillings')
    })

    it('R-4.6.2, R-4.3.4 counts purse, coffer, players and silver mines', () => {
        const state = table()
        state.supply.shillings -= 7
        state.players[0].shillings += 1
        state.guilds.farmer.purse = 1
        state.guilds.monk.coffer = 2
        landscapeOn(state, 'silver-mine', 3)
        expectConserved(state)
    })
})

describe('R-1.1 markers, 20 per colour', () => {
    it('R-1.1 rejects a marker made or lost in one colour', () => {
        const made = table()
        made.supply.influence[made.players[0].color] += 1
        expectBroken(made, 'markers')
        const lost = table()
        lost.supply.influence[lost.players[1].color] -= 1
        expectBroken(lost, 'markers')
    })

    it('R-1.1 a marker moved from one colour to another breaks both', () => {
        const state = table()
        state.supply.influence[state.players[0].color] += 1
        state.supply.influence[state.players[1].color] -= 1
        expect(conservationBreaks(state).map((broken) => broken.part)).toEqual([
            state.players[0].color,
            state.players[1].color
        ])
    })

    it('R-4.1, R-4.5.2, R-4.2.4 counts personal supply, spaces, tracks, rows and icons', () => {
        const state = table()
        const seat = state.players[0].playerId
        const colour = colourOf(state, seat)
        state.spaces['space.sea.1'].ruler = { playerId: seat, subject: true }
        state.spaces['space.sea.2'].serf = { playerId: seat }
        state.guilds.tracks.monk.master = { playerId: seat, reeve: false }
        state.guilds.knight.rows.filter((row) => row.playerId === seat)[0].markers += 2
        state.guilds.knight.monsterIcons.behemoth = seat
        state.monsters.behemoth = { playerId: seat, spaceId: 'space.sea.1' }
        state.supply.influence[colour] -= 2 + 1 + 1 + 2 + 1
        expectConserved(state)
    })

    it('R-1.4-H1 holds a dummy row to the same total, by colour', () => {
        const state = table(2)
        const dummy = state.guilds.knight.rows.filter((row) => row.playerId === undefined)[0]
        dummy.markers += 1
        expectBroken(state, 'markers')
        state.supply.influence[dummy.colour] -= 1
        expectConserved(state)
    })
})

describe('R-4.2.2 vessels, 9 in all', () => {
    it('R-4.2.2 rejects a vessel made or lost', () => {
        const made = table()
        made.supply.vessels.ship += 1
        expectBroken(made, 'vessels')
        const lost = table()
        lost.supply.vessels['flying-machine'] -= 1
        expectBroken(lost, 'vessels')
    })

    it('R-4.2.2 counts the supply, players, pawns, spaces and those for sale', () => {
        const moves: ((state: FeudumGameState) => void)[] = [
            (state) => (state.players[0].vessels.ship += 1),
            (state) => (state.players[0].pawns[0].vessel = 'ship'),
            (state) => (state.spaces['space.sea.1'].vessels.ship += 1),
            (state) => state.guilds.alchemist.vesselsForSale.push('ship')
        ]
        for (const move of moves) {
            const state = table()
            move(state)
            expectBroken(state, 'vessels')
            state.supply.vessels.ship -= 1
            expectConserved(state)
        }
    })
})

describe('R-1.1 targets, 12 in all', () => {
    it('R-4.3.4 rejects a target made or lost', () => {
        const made = table()
        made.supply.targets += 1
        expectBroken(made, 'targets')
        const lost = table()
        lost.supply.targets -= 1
        expectBroken(lost, 'targets')
    })

    it('R-4.3.4 counts targets on an archery butt', () => {
        const state = table()
        state.supply.targets -= 3
        landscapeOn(state, 'archery-butt', 3)
        expectConserved(state)
    })
})

describe('R-5-H1 seals, 17 in all', () => {
    it('R-5-H1 rejects a seal lost or doubled', () => {
        const lost = table()
        lost.vault.sealPile.pop()
        lost.supply.sealPileCount -= 1
        expectBroken(lost, 'seals')

        const doubled = table()
        const seal = doubled.vault.sealPile[0]
        doubled.players[0].beads.push(seal)
        expectBroken(doubled, 'seals')
    })

    it('R-5-H1 counts every place a seal or bead can lie', () => {
        const state = table()
        const seat = state.players[0].playerId
        const next = () => {
            const seal = state.vault.sealPile.pop()
            if (seal === undefined) {
                throw Error('the seal pile is empty')
            }
            state.supply.sealPileCount -= 1
            return seal
        }
        state.vault.scrollSeals['guild.noble.scroll.r1c2'] = next()
        state.guilds.noble.scrolls['guild.noble.scroll.r1c2'] = true
        state.vault.heldSeals[seat].push(next())
        state.players[0].sealCount = 1
        state.vault.charterSeals[seat].push(next())
        state.vault.immunitySeals['space.sea.1.serf'] = next()
        state.players[0].beads.push(next())
        state.guilds.farmer.chickens['guild.farmer.chicken.2'] = next()
        state.guilds.monk.rosary.push(next())
        expectConserved(state)
    })

    it('R-5-H1 rejects a public count that disagrees with the vault', () => {
        const pile = table()
        pile.supply.sealPileCount -= 1
        expectBroken(pile, 'seals')

        const held = table()
        held.players[0].sealCount = 1
        expectBroken(held, 'seals')

        const scroll = table()
        scroll.guilds.noble.scrolls['guild.noble.scroll.r1c2'] = true
        expectBroken(scroll, 'seals')
    })
})

describe('R-1.4.3 discs, 44 in all', () => {
    it('R-3.9.1 rejects a disc lost or doubled', () => {
        const lost = table()
        lost.supply.discs.pop()
        expectBroken(lost, 'discs')

        const doubled = table()
        doubled.supply.discs[0] = doubled.supply.discs[1]
        expectBroken(doubled, 'discs')
    })

    it('R-3.9.1 keeps the total when a disc swaps with the one on a space', () => {
        const state = table()
        const onSpace = state.spaces['space.sea.1'].location.discId
        const fromSupply = state.supply.discs[0]
        state.supply.discs[0] = onSpace
        state.spaces['space.sea.1'].location.discId = fromSupply
        expectConserved(state)
    })
})

describe('R-4.3.1 tiles, 24 less those out of the game', () => {
    it('R-4.3.1 rejects a tile lost or doubled', () => {
        const lost = table()
        lost.regionStacks.sea.pop()
        expectBroken(lost, 'tiles')

        const doubled = table()
        doubled.players[0].regionTiles.push(doubled.regionStacks.sea[0])
        expectBroken(doubled, 'tiles')
    })

    it('R-4.3.3, R-4.11.1 a tile out of the game still has its place', () => {
        const state = table()
        const tile = state.regionStacks.sea.shift()
        if (tile === undefined) {
            throw Error('the sea stack is empty')
        }
        state.tilesOutOfGame.push(tile)
        expectConserved(state)
    })

    it('R-1.4-H2 a collected tile shows its landscape and a stacked tile hides it', () => {
        const state = table()
        const tile = state.regionStacks.sea.shift()
        if (tile === undefined) {
            throw Error('the sea stack is empty')
        }
        state.players[0].regionTiles.push(tile)
        expectBroken(state, 'tiles')

        state.tileLandscapes[tile] = state.vault.tileLandscapes[tile]
        delete state.vault.tileLandscapes[tile]
        expectConserved(state)

        state.vault.tileLandscapes[tile] = state.tileLandscapes[tile]
        expectBroken(state, 'tiles')
    })

    it('R-1.4-H2 rejects a deal that is not the epoch mix', () => {
        const state = table()
        state.vault.tileLandscapes['tile.sea.i'] = 'archery-butt'
        state.vault.tileLandscapes['tile.island.i'] = 'archery-butt'
        expectBroken(state, 'tiles')
    })
})
