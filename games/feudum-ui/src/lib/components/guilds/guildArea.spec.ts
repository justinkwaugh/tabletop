// @vitest-environment node
import { createRawSnippet } from 'svelte'
import { render } from 'svelte/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    AlchemistCartSpaces,
    beadValue,
    ChickenSpaces,
    dummyRowColour,
    FarmerBarn,
    type GuildId,
    GuildIds,
    GuildTrackSpaces,
    HydratedFeudumGameState,
    Inventions,
    KnightMonsterIcons,
    knightRows,
    MarketSpaces,
    recordFrom,
    rosaryBeadSum,
    ScrollSpaces,
    Seals,
    seatKnightRow
} from '@tabletop/feudum'
import { guildPanelAsset } from '$lib/art/assetMap.js'
import { everyAssetSupplied } from '$lib/testing/fakeArt.js'
import { atPlayingCards } from '$lib/testing/turnTable.js'
import { GuildAreaWidth } from '$lib/utils/boardGeometry.js'
import GuildArea from './GuildArea.svelte'
import GuildAreas from './GuildAreas.svelte'

const folder = vi.hoisted(() => {
    const files: Record<string, string> = {}
    return { files }
})
vi.mock('$lib/art/suppliedFiles.js', () => ({
    get suppliedFiles() {
        return folder.files
    }
}))

beforeEach(() => {
    folder.files = {}
})

const paintOf = (playerId: string) => ({
    fill: `seat-${playerId}`,
    ink: 'var(--feudum-text)',
    edge: 'var(--feudum-map-ink)',
    owner: "Ana's"
})
const colourPaintOf = (colour: string) => ({
    fill: `colour-${colour}`,
    ink: 'var(--feudum-text)',
    edge: 'var(--feudum-map-ink)',
    owner: colour
})

async function table(numPlayers = 3) {
    const { host } = await atPlayingCards(['explore'], {}, numPlayers)
    return new HydratedFeudumGameState(structuredClone(host.state))
}

function area(guild: GuildId, state: HydratedFeudumGameState, width?: number) {
    return render(GuildArea, {
        props: { guild, state, paintOf, colourPaintOf, ...(width ? { width } : {}) }
    }).body
}

function count(html: string, text: string) {
    return html.split(text).length - 1
}

const sealOf = (index: number) => Seals[index].id

describe('GuildArea draws from state (R-1.3)', () => {
    it('R-1.3 prints each market price from the data, and a good only where state has one', async () => {
        const state = await table()
        for (const { id } of MarketSpaces) {
            state.guilds.merchant.market[id] = false
        }
        const [filled, ...rest] = MarketSpaces
        state.guilds.merchant.market[filled.id] = true
        const html = area('merchant', state)
        for (const { id, price } of MarketSpaces) {
            expect(html).toContain(`data-price="${id}">${price}s<`)
        }
        expect(html).toContain(`data-world="good:${filled.id}"`)
        for (const { id } of rest) {
            expect(html).not.toContain(`data-world="good:${id}"`)
        }
    })

    it('R-1.3 stands a good on a cart only where state has one', async () => {
        const state = await table()
        for (const { id } of AlchemistCartSpaces) {
            state.guilds.alchemist.carts[id] = false
        }
        const [filled, other] = AlchemistCartSpaces
        state.guilds.alchemist.carts[filled.id] = true
        const html = area('alchemist', state)
        expect(html).toContain(`data-world="good:${filled.id}"`)
        expect(html).not.toContain(`data-world="good:${other.id}"`)
    })

    it('R-4.5.3 groups the vessels for sale by type, with a count', async () => {
        const state = await table()
        state.guilds.alchemist.vesselsForSale = ['ship', 'ship', 'submersible']
        const html = area('alchemist', state)
        expect(html).toContain('data-world="vessel-for-sale:ship"')
        expect(html).toContain('data-world="vessel-for-sale:submersible"')
        expect(html).not.toContain('data-world="vessel-for-sale:flying-machine"')
        expect(html.slice(html.indexOf('vessel-for-sale:ship'))).toContain('>2<')
    })

    it('R-4.6.5 draws every invention, whatever state', async () => {
        const html = area('alchemist', await table())
        for (const { id } of Inventions) {
            expect(html).toContain(`data-invention="${id}"`)
        }
    })

    it("R-1.3 fills a Knight row from its first space, in the seat's paint", async () => {
        const state = await table()
        const seat = state.players[0]
        const own = seatKnightRow(state, seat.playerId)
        expect(own).toBeDefined()
        if (!own) {
            return
        }
        const { rowId, row } = own
        row.markers = 2
        const html = area('knight', state)
        expect(html).toContain(
            `data-knight-row="${seat.color}" data-row-id="${rowId}" data-markers="2"`
        )
        expect(html).toContain(`data-world="knight:${rowId}:1"`)
        expect(html).toContain(`data-world="knight:${rowId}:2"`)
        expect(html).not.toContain(`data-world="knight:${rowId}:3"`)
        const section = html.slice(html.indexOf(`data-knight-row="${seat.color}"`))
        expect(section).toContain(`seat-${seat.playerId}`)
    })

    it('R-1.4-H1 paints a dummy row by its colour, and draws only the rows in use', async () => {
        const state = await table(3)
        const dummy = knightRows(state).find(({ row }) => 'dummy' in row.owner)?.rowId
        expect(dummy).toBeDefined()
        const html = area('knight', state)
        if (dummy) {
            expect(html).toContain(`colour-${dummyRowColour(state, dummy)}`)
        }
        expect(count(html, 'data-knight-row=')).toBe(knightRows(state).length)
    })

    it("R-4.2.4 sets the controller's marker on a monster icon", async () => {
        const state = await table()
        const [{ monster }, other] = KnightMonsterIcons
        const { playerId } = state.players[1]
        state.monsters[monster] = { playerId }
        state.monsters[other.monster] = {}
        const html = area('knight', state)
        expect(html).toContain(`data-world="monster-icon:${monster}"`)
        expect(html).not.toContain(`data-world="monster-icon:${other.monster}"`)
        expect(html).toContain(`data-monster-icon="${other.monster}"`)
        expect(html.slice(html.indexOf(`monster-icon:${monster}`))).toContain(`seat-${playerId}`)
    })

    it('R-5-H1 stands a concealed seal on a scroll, its value told to no one', async () => {
        const state = await table()
        for (const { id } of ScrollSpaces) {
            state.guilds.noble.scrolls[id] = false
        }
        const [filled, other] = ScrollSpaces
        state.guilds.noble.scrolls[filled.id] = true
        const html = area('noble', state)
        expect(html).toContain(`data-world="seal:${filled.id}"`)
        expect(html).not.toContain(`data-world="seal:${other.id}"`)
        expect(html).not.toMatch(/\+[2-5]/)
    })

    it('R-4.6.5 strings the rosary from state, its beads and total public', async () => {
        const state = await table()
        state.guilds.monk.rosary = [sealOf(0), sealOf(Seals.length - 1)]
        const html = area('monk', state)
        expect(html).toContain(`data-world="bead:${sealOf(0)}"`)
        expect(html).toContain(`data-world="bead:${sealOf(Seals.length - 1)}"`)
        expect(html).toContain(`+${beadValue(sealOf(0))}`)
        expect(html).toContain(`data-rosary-total="${rosaryBeadSum(state)}"`)
    })

    it('R-4.6.2 shows the coffer from state', async () => {
        const state = await table()
        state.guilds.monk.coffer = 23
        expect(area('monk', state)).toContain('data-coffer="23">23s<')
    })

    it('R-1.4-H3 draws every chicken, with a bead only where state has one', async () => {
        const state = await table()
        state.guilds.farmer.chickens = recordFrom(
            ChickenSpaces.map(({ id }) => id),
            () => null
        )
        state.guilds.farmer.chickens['guild.farmer.chicken.1'] = sealOf(3)
        const html = area('farmer', state)
        expect(count(html, 'data-chicken=')).toBe(ChickenSpaces.length)
        expect(html).toContain(`data-world="bead:${sealOf(3)}"`)
        expect(count(html, 'data-world="bead:')).toBe(1)
    })

    it('R-4.6.2 shows the purse, R-1.3 the barn with its limit from the data', async () => {
        const state = await table()
        state.guilds.farmer.purse = 31
        state.guilds.farmer.barn = { ...state.guilds.farmer.barn, food: 2, wood: 0 }
        const html = area('farmer', state)
        expect(html).toContain('data-purse="31">31s<')
        expect(html).toContain(`of ${FarmerBarn.capacity}`)
        expect(html).toContain(`data-world="good:${FarmerBarn.id}:food:1"`)
        expect(html).not.toContain(`data-world="good:${FarmerBarn.id}:wood:0"`)
    })

    it("R-4.5.2 stands a rank's marker, R-4.7 its reeve, in the holder's paint", async () => {
        const state = await table()
        const { playerId } = state.players[2]
        state.guilds.tracks.noble.master = { playerId, reeve: true }
        state.guilds.tracks.noble.journeyman = { playerId, reeve: false }
        state.guilds.tracks.noble.apprentice = undefined
        const html = area('noble', state)
        const spaces = GuildTrackSpaces.filter(({ guild }) => guild === 'noble')
        const rank = (name: string) => spaces.find((space) => space.rank === name)?.id
        expect(html).toContain(`data-world="rank:${rank('master')}"`)
        expect(html).toContain(`data-world="reeve:${rank('master')}"`)
        expect(html).toContain(`data-world="rank:${rank('journeyman')}"`)
        expect(html).not.toContain(`data-world="reeve:${rank('journeyman')}"`)
        expect(html).not.toContain(`data-world="rank:${rank('apprentice')}"`)
        expect(html).toContain(`seat-${playerId}`)
    })

    it('R-4.5.3 dims the apprentice space below its player count, and only then', async () => {
        const three = area('monk', await table(3))
        const five = area('monk', await table(5))
        expect(three).toMatch(/data-rank="apprentice" data-unused/)
        expect(five).not.toContain('data-unused')
    })
})

describe('GuildArea is one component at any scale', () => {
    it('R-1.3 draws the same content at board and bench scale, the width alone changing', async () => {
        const state = await table()
        for (const guild of GuildIds) {
            const board = area(guild, state)
            const bench = area(guild, state, GuildAreaWidth * 2)
            const content = (html: string) => html.slice(html.indexOf('data-guild='))
            expect(content(bench)).toBe(content(board))
            expect(bench).toContain(`width="${GuildAreaWidth * 2}"`)
        }
    })

    it("R-1.3 keeps a piece's world place and motion wrapper on separate nodes", async () => {
        const state = await table()
        state.guilds.monk.rosary = [sealOf(0)]
        const html = area('monk', state)
        expect(html).toMatch(
            new RegExp(`<g[^>]*data-world="bead:${sealOf(0)}"[^>]*><g[^>]*data-motion="bead:`)
        )
    })

    it('R-1.3 lets its user draw over it, in local units', async () => {
        const over = createRawSnippet(() => ({ render: () => '<circle data-over="1"></circle>' }))
        const html = render(GuildArea, {
            props: { guild: 'farmer', state: await table(), paintOf, colourPaintOf, over }
        }).body
        expect(html.indexOf('data-over')).toBeGreaterThan(html.indexOf('data-guild='))
    })

    it('R-1.2.3 stands all six areas on the board', async () => {
        const html = render(GuildAreas, {
            props: { state: await table(), paintOf, colourPaintOf }
        }).body
        for (const guild of GuildIds) {
            expect(html).toContain(`data-guild="${guild}"`)
        }
    })
})

describe('GuildArea on the printed panel (R-1.3)', () => {
    beforeEach(() => {
        folder.files = everyAssetSupplied()
    })

    it('R-1.3 lays each guild over its own printed panel, at board and bench scale', async () => {
        const state = await table()
        for (const guild of GuildIds) {
            for (const width of [undefined, 440]) {
                const html = area(guild, state, width)
                expect(html).toContain(`href="/art/${guildPanelAsset(guild)}.webp"`)
                expect(html).toContain(`aria-label="`)
            }
        }
    })

    it('R-1.3 leaves the prices, inventions, hens and beasts to the print', async () => {
        const state = await table()
        const html = GuildIds.map((guild) => area(guild, state)).join('')
        for (const drawn of [
            'data-price=',
            'data-invention=',
            'data-chicken=',
            'data-monster-icon='
        ]) {
            expect(html, drawn).not.toContain(drawn)
        }
    })

    it('R-1.3 still stands every piece state holds on the print', async () => {
        const state = await table()
        for (const { id } of MarketSpaces) {
            state.guilds.merchant.market[id] = false
        }
        const [filled] = MarketSpaces
        state.guilds.merchant.market[filled.id] = true
        const [{ monster }] = KnightMonsterIcons
        state.monsters[monster] = { playerId: state.players[1].playerId }
        state.guilds.farmer.chickens = recordFrom(
            ChickenSpaces.map(({ id }) => id),
            () => null
        )
        state.guilds.farmer.chickens['guild.farmer.chicken.1'] = sealOf(3)
        expect(area('merchant', state)).toContain(`data-world="good:${filled.id}"`)
        expect(area('knight', state)).toContain(`data-world="monster-icon:${monster}"`)
        expect(area('farmer', state)).toContain(`data-world="bead:${sealOf(3)}"`)
    })

    it('R-4.6.2 says the purse, coffer, barn and rosary the print cannot', async () => {
        const state = await table()
        state.guilds.farmer.purse = 31
        state.guilds.monk.coffer = 23
        state.guilds.monk.rosary = [sealOf(0)]
        const farmer = area('farmer', state)
        const monk = area('monk', state)
        expect(farmer).toContain('data-purse="31">31s<')
        expect(farmer).toContain(`of ${FarmerBarn.capacity}`)
        expect(monk).toContain('data-coffer="23">23s<')
        expect(monk).toContain(`data-rosary-total="${rosaryBeadSum(state)}"`)
    })

    it('R-5-H1 keeps a concealed seal on a printed scroll told to no one', async () => {
        const state = await table()
        const [filled] = ScrollSpaces
        state.guilds.noble.scrolls[filled.id] = true
        const html = area('noble', state)
        expect(html).toContain(`data-world="seal:${filled.id}"`)
        expect(html).not.toMatch(/\+[2-5]/)
    })

    it('R-4.5.3 veils the printed apprentice space below its player count, and only then', async () => {
        const three = area('monk', await table(3))
        const five = area('monk', await table(5))
        expect(three).toMatch(/data-rank="apprentice" data-unused/)
        expect(three).toContain('data-veil')
        expect(five).not.toContain('data-unused')
        expect(five).not.toContain('data-veil')
    })
})
