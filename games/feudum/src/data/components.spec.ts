import { beforeAll, describe, expect, it } from 'vitest'
import { docTableRows, readDoc } from '../testing/docs.js'
import { FeudumColors } from '../definition/colors.js'
import {
    ComponentRows,
    ComponentTotals,
    GoodRows,
    GuildIds,
    Monsters,
    PawnFaces,
    PlayerDiscRoles,
    ShillingCoins,
    StartingSupply,
    VesselRows,
    WineBarrelCapacity
} from './components.js'

let components = ''

beforeAll(async () => {
    components = await readDoc('components.md')
})

describe('R-1.1 the rows of components.md', () => {
    it('Other components: every row with its count, and no other', () => {
        expect(ComponentRows.map((row) => [row.id, row.count])).toEqual(
            docTableRows(components, '## Other components').map((row) => [
                row['Id'],
                Number(row['Count'])
            ])
        )
    })

    it('Pawn faces: 6 characters, each naming its guild and icon', () => {
        const faces = docTableRows(components, '### Pawn faces (6)')
        expect(PawnFaces.map((face) => [face.id, face.character, face.icon, face.guild])).toEqual(
            faces.map((row) => [row['Id'], row['Character'], row['Icon'], row['Guild']])
        )
        expect(PawnFaces.map((face) => face.character)).toEqual(GuildIds)
    })

    it('ids are unique', () => {
        const ids = [...ComponentRows, ...PawnFaces].map((row) => row.id)
        expect(new Set(ids).size).toBe(ids.length)
    })
})

describe('R-1.1 the totals', () => {
    it('5 colours', () => {
        expect(FeudumColors).toEqual(['red', 'blue', 'yellow', 'green', 'purple'])
        expect(ComponentTotals.colours).toBe(5)
    })

    it('goods 170: 30 of each of four, 50 food', () => {
        expect(GoodRows.map((row) => [row.good, row.count])).toEqual([
            ['saltpeter', 30],
            ['sulfur', 30],
            ['iron', 30],
            ['wood', 30],
            ['food', 50]
        ])
        expect(ComponentTotals.goods).toBe(170)
    })

    it('R-1.1-H1 shillings 78, in 50 coins: 43 silver of value 1, 7 gold of value 5', () => {
        expect(ShillingCoins.map((coin) => [coin.metal, coin.value, coin.count])).toEqual([
            ['silver', 1, 43],
            ['gold', 5, 7]
        ])
        expect(ComponentTotals.shillings).toBe(78)
        expect(ComponentTotals.shillingCoins).toBe(50)
    })

    it('markers 20 per colour, 100 in all', () => {
        expect(ComponentTotals.markersPerColour).toBe(20)
        expect(ComponentTotals.markers).toBe(100)
    })

    it('vessels 3 + 3 + 3', () => {
        expect(VesselRows.map((row) => [row.vessel, row.count])).toEqual([
            ['ship', 3],
            ['submersible', 3],
            ['flying-machine', 3]
        ])
        expect(ComponentTotals.vessels).toBe(9)
    })

    it('R-4.2.4 monsters 2: each with its routes, attack +1 and defence +1', () => {
        expect(Monsters).toEqual([
            {
                id: 'monster.behemoth',
                monster: 'behemoth',
                media: ['road', 'flying-machine'],
                attack: 1,
                defence: 1
            },
            {
                id: 'monster.sea-serpent',
                monster: 'sea-serpent',
                media: ['ship', 'submersible'],
                attack: 1,
                defence: 1
            }
        ])
        expect(ComponentTotals.monsters).toBe(2)
    })

    it('targets 12', () => {
        expect(ComponentTotals.targets).toBe(12)
    })

    it('pawns 3 and player discs 4 per colour', () => {
        expect(ComponentTotals.pawnsPerColour).toBe(3)
        expect(ComponentTotals.pawns).toBe(15)
        expect(ComponentTotals.playerDiscsPerColour).toBe(4)
        expect(ComponentTotals.playerDiscs).toBe(20)
    })

    it('R-4.7 a player disc scores, or is one of 3 shared by at most 2 reeves, the voyage and service', () => {
        expect(PlayerDiscRoles).toEqual({ scoring: 1, shared: 3, reevesAtMost: 2 })
        expect(PlayerDiscRoles.scoring + PlayerDiscRoles.shared).toBe(
            ComponentTotals.playerDiscsPerColour
        )
    })

    it('6 pawn faces', () => {
        expect(ComponentTotals.pawnFaces).toBe(6)
    })

    it('R-4.10.2 a wine barrel holds 3 sulfur', () => {
        expect(WineBarrelCapacity).toBe(3)
    })
})

describe('R-1.4.1 the starting supply', () => {
    it('3 pawns, 4 discs, 11 cards, 7 markers, 7 food, 7 shillings, a pouch', () => {
        expect(StartingSupply).toEqual({
            pawns: 3,
            playerDiscs: 4,
            actionCards: 11,
            markers: 7,
            food: 7,
            shillings: 7,
            pouches: 1
        })
    })

    it('every pawn and disc of the colour starts in it, and 13 markers stay in the general supply', () => {
        expect(StartingSupply.pawns).toBe(ComponentTotals.pawnsPerColour)
        expect(StartingSupply.playerDiscs).toBe(ComponentTotals.playerDiscsPerColour)
        expect(ComponentTotals.markersPerColour - StartingSupply.markers).toBe(13)
    })
})
