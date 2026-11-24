import { beforeAll, describe, expect, it } from 'vitest'
import { FeudumColors } from '../definition/colors.js'
import { docTableRows, readDoc } from '../testing/docs.js'
import { GuildIds, Goods, MonsterIds, PawnFaces } from './components.js'
import {
    AlchemistCartSpaces,
    AlchemistVesselSpace,
    ChickenSpaces,
    FarmerBarn,
    FarmerPurse,
    FarmerTradeGoods,
    GuildById,
    GuildRanks,
    GuildRing,
    GuildRows,
    GuildSetupSpaces,
    GuildTrackSpaces,
    Inventions,
    KnightMonsterIcons,
    KnightRowSections,
    KnightSections,
    KrudBarrels,
    MarketSpaces,
    MonkCoffer,
    MonkRosary,
    ScrollSpaces,
    StatusStarValues,
    VesselInventions
} from './guilds.js'
import { ProvisionalGuilds } from './provisional.guilds.js'
import { EpochTrack } from './tracks.js'

let components = ''

beforeAll(async () => {
    components = await readDoc('components.md')
})

function rows(heading: string): Record<string, string>[] {
    return docTableRows(components, heading)
}

/** "2 saltpeter + 1 sulfur" as the good counts it names. */
function recipe(goods: string): Record<string, number> {
    return Object.fromEntries(
        goods.split(' + ').map((part) => {
            const [count = '', good = ''] = part.split(' ')
            return [good, Number(count)]
        })
    )
}

describe('R-1.2.3, R-1.2.4 the six guilds', () => {
    it('has every row of components.md: related location and ring neighbours', () => {
        expect(
            GuildRows.map((guild) => [
                guild.id,
                guild.name,
                guild.relatedLocation,
                `guild.${guild.pullsFrom}`,
                `guild.${guild.pushesTo}`
            ])
        ).toEqual(
            rows('## Guilds (6)').map((row) => [
                row['Id'],
                row['Name'],
                row['Related location'],
                row['Ring: left (pulls from)'],
                row['Ring: right (pushes to)']
            ])
        )
    })

    it('R-1.2.3 rings Farmer, Merchant, Alchemist, Knight, Noble, Monk, back to Farmer', () => {
        expect(GuildRing).toEqual(['farmer', 'merchant', 'alchemist', 'knight', 'noble', 'monk'])
        expect(GuildRing).toEqual(GuildIds)
        GuildRing.forEach((guild, index) => {
            const after = GuildRing[(index + 1) % GuildRing.length]
            expect(GuildById[guild].pushesTo, guild).toBe(after)
            expect(after && GuildById[after].pullsFrom, guild).toBe(guild)
        })
    })

    it('R-1.2.4 relates each location type to two guilds, the Alchemist to the outpost', () => {
        expect(GuildRows.map((guild) => [guild.guild, guild.relatedLocation])).toEqual([
            ['farmer', 'farm'],
            ['merchant', 'town'],
            ['alchemist', 'outpost'],
            ['knight', 'farm'],
            ['noble', 'town'],
            ['monk', 'outpost']
        ])
    })

    it('R-4.5.1 the status-star key: own pawn 1, own feudum 3, related location 1', () => {
        expect(StatusStarValues).toEqual({ pawn: 1, feudum: 3, relatedLocation: 1 })
    })

    it('R-1.1 each guild is the guild of its pawn face', () => {
        expect(PawnFaces.map((face) => face.guild)).toEqual(GuildRows.map((guild) => guild.id))
        rows('## Guilds (6)').forEach((row, index) => {
            expect(row['Pawn and feudum icon']).toContain(PawnFaces[index]?.icon)
        })
    })

    it('R-1.3 has a goods area row for each guild', () => {
        expect(rows('### Guild goods areas and setup').map((row) => row['Guild'])).toEqual(
            GuildRows.map((guild) => guild.id)
        )
    })
})

describe('R-1.3, R-4.5.3 the guild track spaces', () => {
    it('has every row of components.md: 18 spaces, each with its dawn vp', () => {
        const printed = rows('### Guild track spaces (18)')
        expect(GuildTrackSpaces).toHaveLength(18)
        expect(
            GuildTrackSpaces.map((space) => [
                space.id,
                `guild.${space.guild}`,
                space.rank,
                space.dawnVp
            ])
        ).toEqual(
            printed.map((row) => [row['Id'], row['Guild'], row['Rank'], Number(row['Dawn vp'])])
        )
    })

    it('runs apprentice 1 vp, journeyman 3 vp, master 5 vp left to right in every guild', () => {
        expect(GuildRanks).toEqual(['apprentice', 'journeyman', 'master'])
        for (const guild of GuildIds) {
            expect(
                GuildTrackSpaces.filter((space) => space.guild === guild).map((space) => [
                    space.rank,
                    space.dawnVp
                ])
            ).toEqual([
                ['apprentice', 1],
                ['journeyman', 3],
                ['master', 5]
            ])
        }
    })

    it('R-4.5.3 the apprentice space is used only with 4 or 5 players', () => {
        for (const space of GuildTrackSpaces) {
            expect(space.minPlayers, space.id).toBe(space.rank === 'apprentice' ? 4 : 2)
        }
    })

    it('R-4.6.4, R-4.6.5 the journeyman may pull, the master may push, the apprentice neither', () => {
        for (const space of GuildTrackSpaces) {
            const expected = { apprentice: null, journeyman: 'pull', master: 'push' }[space.rank]
            expect(space.guildFunction, space.id).toBe(expected)
        }
    })
})

describe('R-1.3 the Farmer goods area', () => {
    it('has every row of components.md', () => {
        expect([FarmerBarn.id, FarmerPurse.id, ...ChickenSpaces.map((space) => space.id)]).toEqual(
            rows('### Farmer goods area (6)').map((row) => row['Id'])
        )
    })

    it('the barn holds at most 10 goods and setup fills it', () => {
        expect(FarmerBarn).toEqual({ id: 'guild.farmer.barn', capacity: 10, setupGoods: 10 })
    })

    it('R-4.6.3 the trade medallion: 1 food or 1 shilling per 2 goods sent', () => {
        expect(FarmerTradeGoods).toBe(2)
    })

    it('each chicken space holds one bead', () => {
        for (const space of ChickenSpaces) {
            expect(space.capacity, space.id).toBe(1)
        }
    })
})

describe('R-1.3, R-4.6.3 the Merchant market', () => {
    it('has every row of components.md: 5 bins by 4 spaces, each with its price', () => {
        expect(MarketSpaces).toHaveLength(20)
        expect(
            MarketSpaces.map((space) => [
                space.id,
                space.good,
                space.space,
                `${space.price}s`,
                space.filledAtSetup ? 'yes' : 'no (empty)'
            ])
        ).toEqual(
            rows('### Merchant market spaces (20)').map((row) => [
                row['Id'],
                row['Bin'],
                Number(row['Space']),
                row['Price'],
                row['Filled at setup']
            ])
        )
    })

    it('prices each bin from most to least expensive', () => {
        const prices = Goods.map((good) => [
            good,
            MarketSpaces.filter((space) => space.good === good).map((space) => space.price)
        ])
        expect(prices).toEqual([
            ['saltpeter', [4, 3, 2, 2]],
            ['sulfur', [3, 3, 2, 1]],
            ['iron', [3, 2, 1, 1]],
            ['wood', [2, 2, 1, 1]],
            ['food', [2, 1, 1, 1]]
        ])
    })

    it('R-1.3 the two prices the digest states: saltpeter-4 2s, sulfur-4 1s', () => {
        const price = (id: string) => MarketSpaces.find((space) => space.id === id)?.price
        expect(price('guild.merchant.space.saltpeter-4')).toBe(2)
        expect(price('guild.merchant.space.sulfur-4')).toBe(1)
    })

    it('R-4.6.3 fills left to right, so the rightmost good of a bin is its cheapest', () => {
        for (const good of Goods) {
            const bin = MarketSpaces.filter((space) => space.good === good)
            expect(bin.map((space) => space.space)).toEqual([1, 2, 3, 4])
            bin.slice(1).forEach((space, index) => {
                expect(space.price, space.id).toBeLessThanOrEqual(bin[index]?.price ?? 0)
            })
        }
    })

    it('R-1.3 setup leaves empty only the last space of the saltpeter and sulfur bins', () => {
        expect(
            Goods.map((good) => [
                good,
                MarketSpaces.filter((space) => space.good === good && space.filledAtSetup).length
            ])
        ).toEqual([
            ['saltpeter', 3],
            ['sulfur', 3],
            ['iron', 4],
            ['wood', 4],
            ['food', 4]
        ])
        expect(
            MarketSpaces.filter((space) => !space.filledAtSetup).map((space) => space.id)
        ).toEqual(['guild.merchant.space.saltpeter-4', 'guild.merchant.space.sulfur-4'])
    })
})

describe('R-1.3, R-4.6.5 the Alchemist', () => {
    it('has every row of components.md: 15 cart and pile spaces and the vessel space', () => {
        const printed = rows('### Alchemist spaces (16)')
        expect(AlchemistCartSpaces).toHaveLength(15)
        expect([...AlchemistCartSpaces, AlchemistVesselSpace].map((space) => space.id)).toEqual(
            printed.map((row) => row['Id'])
        )
        expect(
            AlchemistCartSpaces.map((space) => [
                space.space,
                space.filledAtSetup ? 'yes' : 'no (empty)'
            ])
        ).toEqual(
            printed
                .filter((row) => row['Id'] !== AlchemistVesselSpace.id)
                .map((row) => [Number(row['Space']), row['Filled at setup']])
        )
    })

    it('holds 3 of each good; setup puts wood 3, iron 3, food 1, sulfur 1, saltpeter 3', () => {
        const carts = ['wood', 'iron', 'food', 'sulfur', 'saltpeter'] as const
        expect(
            carts.map((good) => {
                const cart = AlchemistCartSpaces.filter((space) => space.good === good)
                return [good, cart.length, cart.filter((space) => space.filledAtSetup).length]
            })
        ).toEqual([
            ['wood', 3, 3],
            ['iron', 3, 3],
            ['food', 3, 1],
            ['sulfur', 3, 1],
            ['saltpeter', 3, 3]
        ])
    })

    it('R-1.3 the vessel space takes 2 random vessels at setup', () => {
        expect(AlchemistVesselSpace.setupVessels).toBe(2)
    })

    it('has every invention of components.md, each with its recipe', () => {
        expect(Inventions.map((invention) => [invention.id, invention.recipe])).toEqual(
            rows('### Alchemist inventions (6)').map((row) => [
                row['Id'],
                recipe(row['Goods required'] ?? '')
            ])
        )
    })

    it('R-4.6.5 ship, submersible and flying machine recipes', () => {
        expect(VesselInventions.map(({ vessel, recipe }) => [vessel, recipe])).toEqual([
            ['ship', { food: 1, wood: 2 }],
            ['submersible', { food: 1, iron: 2 }],
            ['flying-machine', { food: 1, iron: 1, wood: 1 }]
        ])
    })

    it('R-4.6.5, R-4.6-H4 krud prices 1st, 2nd, 3rd', () => {
        expect(KrudBarrels.map(({ barrel, recipe }) => [barrel, recipe])).toEqual([
            [1, { saltpeter: 2, sulfur: 1 }],
            [2, { saltpeter: 1, sulfur: 1 }],
            [3, { wood: 1 }]
        ])
    })
})

describe('R-1.3, R-4.6.6 the Knight', () => {
    const knightTables = () => rows('### Knight row sections (15)')

    it('has every row of components.md: 5 rows by 3 sections', () => {
        const printed = knightTables().filter((row) => row['Id']?.startsWith('guild.knight.row.'))
        expect(KnightRowSections).toHaveLength(15)
        expect(
            KnightRowSections.map((section) => [
                section.id,
                section.colour,
                section.section,
                section.spaces
            ])
        ).toEqual(
            printed.map((row) => [
                row['Id'],
                row['Row colour'],
                Number(row['Section']),
                Number(row['Spaces'])
            ])
        )
        expect(new Set(KnightRowSections.map((section) => section.colour))).toEqual(
            new Set(FeudumColors)
        )
    })

    it('a row is 6 spaces in barrel sections of 1, 2 and 3, by column', () => {
        expect(
            KnightSections.map(({ section, spaces, firstColumn, lastColumn }) => [
                section,
                spaces,
                firstColumn,
                lastColumn
            ])
        ).toEqual([
            [1, 1, 1, 1],
            [2, 2, 2, 3],
            [3, 3, 4, 6]
        ])
    })

    it('R-1.3 setup puts 2 markers in a row: section 1 and the first space of section 2', () => {
        expect(KnightSections.map((section) => section.setupMarkers)).toEqual([1, 1, 0])
    })

    it('R-4.6.3 has the behemoth and sea serpent icons, each of 3 markers', () => {
        expect(
            KnightMonsterIcons.map(({ id, monster, markers }) => [id, monster, markers])
        ).toEqual([
            ['guild.knight.monster.behemoth', 'behemoth', 3],
            ['guild.knight.monster.sea-serpent', 'sea-serpent', 3]
        ])
        expect(KnightMonsterIcons.map((icon) => icon.monster)).toEqual(MonsterIds)
        expect(
            knightTables()
                .map((row) => row['Id'])
                .filter((id) => id?.startsWith('guild.knight.monster.'))
        ).toEqual(KnightMonsterIcons.map((icon) => icon.id))
    })
})

describe('R-1.3 the Noble scrolls', () => {
    it('has every row of components.md: the row and column lengths and the setup seal', () => {
        expect(
            ScrollSpaces.map((space) => [
                space.id,
                space.row,
                space.column,
                `row length ${space.rowLength}, column length ${space.columnLength}`,
                space.setupSeal ? 'seal (red side up)' : 'empty'
            ])
        ).toEqual(
            rows('### Noble scroll spaces (6)').map((row) => [
                row['Id'],
                Number(row['Row']),
                Number(row['Column']),
                row['Lengths'],
                row['Setup occupancy']
            ])
        )
    })

    it('has 6 spaces in rows of 3, 2, 1 and columns of 3, 2, 1', () => {
        const count = (line: 'row' | 'column', at: number) =>
            ScrollSpaces.filter((space) => space[line] === at).length
        expect(ScrollSpaces).toHaveLength(6)
        expect([1, 2, 3].map((at) => count('row', at))).toEqual([3, 2, 1])
        expect([1, 2, 3].map((at) => count('column', at))).toEqual([3, 2, 1])
    })

    it('setup seals the row-1 ends, the row-2 second space and the row-3 space', () => {
        expect(ScrollSpaces.filter((space) => space.setupSeal).map((space) => space.id)).toEqual([
            'guild.noble.scroll.r1c1',
            'guild.noble.scroll.r1c3',
            'guild.noble.scroll.r2c2',
            'guild.noble.scroll.r3c1'
        ])
    })
})

describe('R-1.3 the Monk', () => {
    it('has every row of components.md: the rosary and the coffer', () => {
        expect([MonkRosary.id, MonkCoffer.id]).toEqual(
            rows('### Monk guild parts (2)').map((row) => row['Id'])
        )
    })

    it('setup puts 4 beads on the rosary', () => {
        expect(MonkRosary.setupBeads).toBe(4)
    })
})

describe('R-1.3, R-4.12.5 the setup spaces each guild refills at III', () => {
    it('R-4.12.5 only the third dawn refills the guilds', () => {
        expect(EpochTrack.filter((ray) => ray.guildRefill).map((ray) => ray.ray)).toEqual(['III'])
    })

    it('Farmer: 10 goods in the barn and the setup bead', () => {
        expect(GuildSetupSpaces.farmer.barnGoods).toBe(10)
        expect(GuildSetupSpaces.farmer.chickenSpaces).toHaveLength(1)
    })

    it('Merchant: 18 market spaces', () => {
        expect(GuildSetupSpaces.merchant.marketSpaces).toEqual(
            MarketSpaces.filter((space) => space.filledAtSetup).map((space) => space.id)
        )
        expect(GuildSetupSpaces.merchant.marketSpaces).toHaveLength(18)
    })

    it('Alchemist: 11 cart and pile spaces and 2 vessels', () => {
        expect(GuildSetupSpaces.alchemist.cartSpaces).toEqual(
            AlchemistCartSpaces.filter((space) => space.filledAtSetup).map((space) => space.id)
        )
        expect(GuildSetupSpaces.alchemist.cartSpaces).toHaveLength(11)
        expect(GuildSetupSpaces.alchemist.vessels).toBe(2)
    })

    it('Knight: 2 markers in every row', () => {
        expect(GuildSetupSpaces.knight.markersPerRow).toBe(2)
    })

    it('Noble: the 4 seal spaces', () => {
        expect(GuildSetupSpaces.noble.scrollSpaces).toEqual([
            'guild.noble.scroll.r1c1',
            'guild.noble.scroll.r1c3',
            'guild.noble.scroll.r2c2',
            'guild.noble.scroll.r3c1'
        ])
    })

    it('Monk: 4 beads', () => {
        expect(GuildSetupSpaces.monk.beads).toBe(4)
    })

    it('R-1.4.5 the guilds take 9 seals: 4 on the scrolls, 4 beads on the rosary, 1 on a chicken', () => {
        const { noble, monk, farmer } = GuildSetupSpaces
        expect(noble.scrollSpaces.length + monk.beads + farmer.chickenSpaces.length).toBe(9)
    })
})

describe('the values still provisional read the registry', () => {
    it("R-1.4-H3 the rosary's capacity, unlimited", () => {
        expect(MonkRosary.capacity).toBe(ProvisionalGuilds.rosaryCapacity.placeholder)
    })

    it('R-1.4-H3 the chicken spaces, 4, the setup bead on the first', () => {
        const { spaces, setupBeadSpace } = ProvisionalGuilds.chickenSpaces.placeholder
        expect(ChickenSpaces).toHaveLength(spaces)
        expect(ChickenSpaces.filter((space) => space.setupBead).map((space) => space.id)).toEqual([
            setupBeadSpace
        ])
        expect(GuildSetupSpaces.farmer.chickenSpaces).toEqual([setupBeadSpace])
    })

    it("R-4.6-H3 each guild's charity is the purse or the coffer", () => {
        for (const guild of GuildRows) {
            expect(guild.charity, guild.id).toBe(ProvisionalGuilds.charity.placeholder[guild.guild])
        }
        expect(new Set(GuildRows.map((guild) => guild.charity))).toEqual(
            new Set([FarmerPurse.id, MonkCoffer.id])
        )
    })
})

describe('R-1.2.3, R-1.3 the guild component ids', () => {
    it('are unique across every guild table', () => {
        const ids = [
            ...GuildRows,
            ...GuildTrackSpaces,
            FarmerBarn,
            FarmerPurse,
            ...ChickenSpaces,
            ...MarketSpaces,
            ...AlchemistCartSpaces,
            AlchemistVesselSpace,
            ...Inventions,
            ...KnightRowSections,
            ...KnightMonsterIcons,
            ...ScrollSpaces,
            MonkRosary,
            MonkCoffer
        ].map((row) => row.id)
        expect(ids).toHaveLength(6 + 18 + 2 + ChickenSpaces.length + 20 + 16 + 6 + 15 + 2 + 6 + 2)
        expect(new Set(ids).size).toBe(ids.length)
    })
})
