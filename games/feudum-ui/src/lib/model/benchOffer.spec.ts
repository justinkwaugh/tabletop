import { flushSync } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import {
    merchantTradeOffers,
    type GuildFunctionName,
    type GuildId,
    type MonsterId,
    type SpaceId
} from '@tabletop/feudum'
import {
    guildTable,
    seatRowIndex,
    ruleFarm,
    setBarn,
    setBeads,
    setCarts,
    setJourneyman,
    setMarket,
    setMaster,
    setPawns,
    setRowMarkers,
    setScrolls,
    setShillings,
    setVesselsForSale,
    StandingSpace,
    type GuildArrange,
    type GuildTable
} from '$lib/testing/guildTable.js'
import { ruleTown } from '$lib/testing/turnTable.js'
import type { FeudumHost } from '$lib/testing/sessionHarness.js'
import {
    benchOffer,
    feastBenchSource,
    guildBenchSource,
    paramsOf,
    type BenchItem,
    type BenchOffer,
    type BenchPick,
    type BenchPresser,
    type BenchSeat,
    type BenchSource,
    type BenchStages
} from './benchOffer.js'

const R1C1 = 'guild.noble.scroll.r1c1'
const R1C2 = 'guild.noble.scroll.r1c2'
const R2C1 = 'guild.noble.scroll.r2c1'

let host: FeudumHost | undefined

afterEach(() => {
    host?.close()
    host = undefined
})

async function table(arrange: GuildArrange): Promise<GuildTable> {
    const turn = await guildTable(arrange)
    host = turn.host
    flushSync()
    return turn
}

function seatOf({ session, seat }: GuildTable): BenchSeat {
    return {
        state: session.gameState,
        playerId: seat,
        nameOf: (id) => session.getPlayerName(id),
        input: {}
    }
}

/** Records what a press would do; the staged inputs are the spec's own. */
function presser(): BenchPresser & { readonly pressed: unknown[] } {
    const pressed: unknown[] = []
    const record = (value: unknown) => {
        pressed.push(value)
    }
    return {
        pressed,
        picks: record,
        take: () => {
            record('take')
        },
        monster: record,
        deploy: record,
        farm: record,
        split: record,
        sulfur: record,
        count: record
    }
}

function offerOf(
    turn: GuildTable,
    guildId: GuildId,
    fn: GuildFunctionName,
    stages: BenchStages = { picks: [] }
): BenchOffer {
    const seat = seatOf(turn)
    return benchOffer(seat, guildBenchSource(seat, guildId, fn), stages, presser())
}

function goods(...kinds: readonly ('iron' | 'wood' | 'food' | 'sulfur')[]): BenchPick[] {
    return kinds.map((good) => ({ kind: 'good', good }))
}

function item(offer: BenchOffer, label: string | RegExp): BenchItem {
    const found = offer.items.find((row) =>
        typeof label === 'string' ? row.label === label : label.test(row.label)
    )
    if (!found) {
        throw new Error(`No item ${String(label)} in ${offer.items.map((row) => row.label).join()}`)
    }
    return found
}

describe('R-4.6.1 what the bench lights', () => {
    it('R-4.6.4 lights each barn good by kind, the barn left and the market right', async () => {
        const turn = await table((state, { seat, other }) => {
            setJourneyman(state, seat, 'merchant', other)
            setBarn(state, { iron: 2, wood: 1 })
        })
        const offer = offerOf(turn, 'merchant', 'pull')
        expect(offer.title).toBe('Merchant pull')
        expect(offer.areas).toEqual(['farmer', 'merchant'])
        expect(offer.line).toBe('Move up to 3')
        expect(offer.items.map(({ label, role }) => [label, role])).toEqual([
            ['Iron', 'lit'],
            ['Wood', 'lit']
        ])
    })

    it('R-4.6.1 a good past what its bin holds dims with the logic’s reason and has no press', async () => {
        const turn = await table((state, { seat, other }) => {
            setJourneyman(state, seat, 'merchant', other)
            setBarn(state, { iron: 3, wood: 1 })
            setMarket(state, { iron: 3 })
        })
        const offer = offerOf(turn, 'merchant', 'pull', { picks: goods('iron') })
        const iron = item(offer, 'Iron')
        expect(iron.role).toBe('dimmed')
        expect(iron.refusal).toBe('The iron bin has room for 1.')
        expect(iron.press).toBeUndefined()
        expect(item(offer, 'Wood').role).toBe('lit')
    })

    it('R-4.6.1 a press hands the press’s picks to the draft', async () => {
        const turn = await table((state, { seat, other }) => {
            setJourneyman(state, seat, 'merchant', other)
            setBarn(state, { iron: 2 })
        })
        const seat = seatOf(turn)
        const press = presser()
        const offer = benchOffer(
            seat,
            guildBenchSource(seat, 'merchant', 'pull'),
            { picks: goods('iron') },
            press
        )
        const iron = item(offer, 'Iron')
        expect(iron.role).toBe('picked')
        iron.press?.()
        expect(press.pressed).toEqual([goods('iron', 'iron')])
    })

    it('R-4.6.1 the inputs read from the stages: picks by kind, in press order', () => {
        const stages: BenchStages = {
            picks: [
                { kind: 'row', row: 2 },
                { kind: 'scroll', spaceId: R1C1 },
                { kind: 'row', row: 0 }
            ],
            count: 'columns'
        }
        expect(paramsOf(stages)).toEqual({
            knightRows: [2, 0],
            scrollSpaces: [R1C1],
            count: 'columns'
        })
    })
})

describe('R-4.6.1 ghosts: each pick at its destination', () => {
    it('R-4.6.4 S41 a good lands in its bin’s next space', async () => {
        const turn = await table((state, { seat, other }) => {
            setJourneyman(state, seat, 'merchant', other)
            setBarn(state, { iron: 2, wood: 1 })
            setMarket(state, { iron: 1 })
        })
        expect(offerOf(turn, 'merchant', 'pull', { picks: goods('iron', 'wood') }).ghosts).toEqual([
            { item: 'good:iron', at: 'guild.merchant.space.iron-2' },
            { item: 'good:wood', at: 'guild.merchant.space.wood-1' }
        ])
    })

    it('R-4.6.5 a Farmer push’s goods land the same way', async () => {
        const turn = await table((state, { seat }) => {
            setMaster(state, seat, 'farmer')
            setBarn(state, { food: 1 })
        })
        expect(offerOf(turn, 'farmer', 'push', { picks: goods('food') }).ghosts).toEqual([
            { item: 'good:food', at: 'guild.merchant.space.food-1' }
        ])
    })

    it('R-4.6.5 a Merchant push’s goods go from the market to their carts', async () => {
        const turn = await table((state, { seat }) => {
            setMaster(state, seat, 'merchant')
            setMarket(state, { wood: 1 })
        })
        const [ghost] = offerOf(turn, 'merchant', 'push', { picks: goods('wood') }).ghosts
        expect(ghost?.at).toMatch(/^guild\.alchemist\./)
    })

    it('R-4.6.5, R-4.6.6 S43 a krud barrel fills every Knight row; a ship goes to the vessel space', async () => {
        const turn = await table((state, { seat }) => {
            setMaster(state, seat, 'alchemist')
            setCarts(state, { wood: 3, iron: 3, food: 3, sulfur: 3, saltpeter: 3 })
        })
        const offer = offerOf(turn, 'alchemist', 'push', {
            picks: [
                { kind: 'invention', invention: 'ship' },
                { kind: 'invention', invention: 'krud-barrel' }
            ]
        })
        const rows = turn.session.gameState.guilds.knight.rows
        expect(offer.ghosts.filter(({ item: ghost }) => ghost === 'invention:ship')).toEqual([
            { item: 'invention:ship', at: 'vessel-space' }
        ])
        expect(offer.ghosts.filter(({ item: ghost }) => ghost === 'invention:krud-barrel')).toEqual(
            rows.map(({ colour }) => ({
                item: 'invention:krud-barrel',
                at: `knight-row:${colour}`,
                count: 1
            }))
        )
    })

    it('R-5-H1 S45 a marker’s ghost names its scroll space; no seal is named', async () => {
        const turn = await table((state, { seat, other }) => {
            setJourneyman(state, seat, 'noble', other)
            setRowMarkers(state, [1, 1])
        })
        const offer = offerOf(turn, 'noble', 'pull', {
            picks: [
                { kind: 'row', row: 0 },
                { kind: 'scroll', spaceId: R1C1 }
            ]
        })
        expect(offer.ghosts).toEqual([{ item: 'row:0', at: R1C1 }])
    })
})

describe('R-4.6.1, R-4.7 the result line comes from the preview', () => {
    it('R-4.6.4 S41 a pull at its threshold: points, writs, the lines completed', async () => {
        const turn = await table((state, { seat, other }) => {
            setJourneyman(state, seat, 'merchant', other)
            setBarn(state, { iron: 2, wood: 1 })
            setMarket(state, { saltpeter: 3, sulfur: 3, iron: 1, wood: 3, food: 3 })
        })
        const { result } = offerOf(turn, 'merchant', 'pull', {
            picks: goods('iron', 'iron', 'wood')
        })
        expect(result?.line).toBe("3 vp · 2 writs, keep 1 · can't be undone")
        expect(result?.moved).toBe('3 goods · 1 row, 2 columns')
    })

    it('R-4.6.4 S42 a pull that completes nothing', async () => {
        const turn = await table((state, { seat, other }) => {
            setJourneyman(state, seat, 'merchant', other)
            setBarn(state, { iron: 1 })
        })
        const { result } = offerOf(turn, 'merchant', 'pull', { picks: goods('iron') })
        expect(result?.line).toBe('0 vp · no writ')
        expect(result?.moved).toBe('1 good')
    })

    it('R-4.6.2 the payment’s split names each seat, the viewer as you', async () => {
        const turn = await table((state, { seat, other, third }) => {
            setJourneyman(state, third, 'merchant', other)
            setMarket(state, { wood: 4, iron: 4 })
            setShillings(state, seat, 20)
        })
        const name = (id: string) => turn.session.getPlayerName(id)
        const { result } = offerOf(turn, 'merchant', 'trade', { picks: goods('wood', 'wood') })
        expect(result?.payment).toContain(`to ${name(turn.other)}`)
        expect(result?.payment).toContain(`to ${name(turn.third)}`)
    })

    it('R-4.6.2 with no journeyman the supply takes that share, and the viewer reads as you', async () => {
        const turn = await table((state, { seat }) => {
            setMaster(state, seat, 'merchant')
            setMarket(state, { wood: 1 })
            setShillings(state, seat, 20)
        })
        const { result } = offerOf(turn, 'merchant', 'trade', { picks: goods('wood') })
        expect(result?.payment).toMatch(/^\ds to you/)
        expect(result?.payment).toMatch(/\ds to the (supply|purse|coffer)/)
    })

    it('R-4.6.5 a Farmer push shows the purse’s split', async () => {
        const turn = await table((state, { seat, other }) => {
            setJourneyman(state, other, 'farmer', seat)
            setBarn(state, { iron: 1 })
            state.supply.shillings -= 3
            state.guilds.farmer.purse = 3
        })
        const { result } = offerOf(turn, 'farmer', 'push', { picks: goods('iron') })
        expect(result?.split).toBe(`2s to you, 1s to ${turn.session.getPlayerName(turn.other)}`)
    })

    it('R-4.6.5, R-4.7 a scoring push says its reeve points', async () => {
        const turn = await table((state, { seat, other }) => {
            setJourneyman(state, other, 'farmer', seat)
            setBarn(state, { saltpeter: 1, sulfur: 1, iron: 1 })
            setMarket(state, { saltpeter: 3, sulfur: 3, iron: 3, wood: 4, food: 4 })
            const { master } = state.guilds.tracks.farmer
            if (master) {
                master.reeve = true
            }
        })
        const { result } = offerOf(turn, 'farmer', 'push', {
            picks: [
                { kind: 'good', good: 'saltpeter' },
                { kind: 'good', good: 'sulfur' },
                { kind: 'good', good: 'iron' }
            ]
        })
        expect(result?.line).toBe('6 vp')
        expect(result?.reeve).toBe('+1 vp reeve')
    })

    it('R-4.6-H2 a draw of two beads gives both ends', async () => {
        const turn = await table((state, { seat, other }) => {
            setJourneyman(state, seat, 'farmer', other)
            setBeads(state, { rosary: [5, 2], chickens: [] })
        })
        const { result, items } = offerOf(turn, 'farmer', 'pull')
        expect(items).toEqual([])
        expect(result?.line).toMatch(/^0 to 3 vp · 2 writs, keep 1 · can't be undone$/)
    })

    it('R-4.6.3 a trade names its price and no points', async () => {
        const turn = await table((state, { seat }) => {
            setVesselsForSale(state, ['ship'])
            setShillings(state, seat, 9)
        })
        const offer = offerOf(turn, 'alchemist', 'trade', {
            picks: [{ kind: 'vessel', vessel: 'ship' }]
        })
        expect(offer.result?.line).toBe('3s')
    })
})

describe('R-4.6.1 the count toggle', () => {
    async function pushBoth() {
        return await table((state, { seat }) => {
            setMaster(state, seat, 'farmer')
            setBarn(state, { iron: 2, wood: 1 })
            setMarket(state, { saltpeter: 3, sulfur: 3, iron: 1, wood: 3, food: 3 })
        })
    }

    it('R-4.6.5 Farmer push: both completed, the higher preselected, and each sets the count', async () => {
        const turn = await pushBoth()
        const seat = seatOf(turn)
        const press = presser()
        const { count } = benchOffer(
            seat,
            guildBenchSource(seat, 'farmer', 'push'),
            { picks: goods('iron', 'iron', 'wood'), count: 'columns' },
            press
        )
        expect(count?.map(({ label, picked }) => [label, picked])).toEqual([
            ['Rows (1)', false],
            ['Columns (2)', true]
        ])
        count?.[0].press?.()
        expect(press.pressed).toEqual(['rows'])
    })

    it('R-4.6.5 the points follow the count staged', async () => {
        const turn = await pushBoth()
        const rows = offerOf(turn, 'farmer', 'push', {
            picks: goods('iron', 'iron', 'wood'),
            count: 'rows'
        })
        const columns = offerOf(turn, 'farmer', 'push', {
            picks: goods('iron', 'iron', 'wood'),
            count: 'columns'
        })
        expect(rows.result?.line).toBe('4 vp')
        expect(columns.result?.line).toBe('5 vp')
    })

    it('R-4.6.4 S41 Merchant pull has nothing to set: the higher shows, with no press', async () => {
        const turn = await table((state, { seat, other }) => {
            setJourneyman(state, seat, 'merchant', other)
            setBarn(state, { iron: 2, wood: 1 })
            setMarket(state, { saltpeter: 3, sulfur: 3, iron: 1, wood: 3, food: 3 })
        })
        const { count } = offerOf(turn, 'merchant', 'pull', {
            picks: goods('iron', 'iron', 'wood')
        })
        expect(count?.map(({ label, picked }) => [label, picked])).toEqual([
            ['Rows (1)', false],
            ['Columns (2)', true]
        ])
        expect(count?.every(({ press }) => press === undefined)).toBe(true)
    })

    it('R-4.6.1 one count completed: no toggle', async () => {
        const turn = await table((state, { seat }) => {
            setMaster(state, seat, 'farmer')
            setBarn(state, { iron: 1 })
            setMarket(state, { iron: 3 })
        })
        expect(offerOf(turn, 'farmer', 'push', { picks: goods('iron') }).count).toBeUndefined()
    })
})

describe('R-4.6-H5 fewer than stated', () => {
    it('R-4.6.3 a range: the primary is enabled from the first item and names the count', async () => {
        const turn = await table((state, { seat }) => {
            setMarket(state, { iron: 4 })
            setShillings(state, seat, 20)
        })
        const none = offerOf(turn, 'merchant', 'trade')
        expect(none.line).toBe('Buy up to 3')
        expect(none.primary?.enabled).toBe(false)
        expect(offerOf(turn, 'merchant', 'trade', { picks: goods('iron') }).primary).toEqual({
            label: 'Buy 1 good',
            enabled: true
        })
    })

    it('R-4.6-H5 a move takes as many as fit: short of them the logic’s line stands', async () => {
        const turn = await table((state, { seat, other }) => {
            setJourneyman(state, seat, 'merchant', other)
            setBarn(state, { iron: 2 })
        })
        const one = offerOf(turn, 'merchant', 'pull', { picks: goods('iron') })
        expect(one.line).toBe('Move up to 3')
        expect(one.primary).toEqual({ label: 'Move 1 good', enabled: false })
        expect(one.refused).toBe('2 goods fit: move them all.')
        expect(offerOf(turn, 'merchant', 'pull', { picks: goods('iron', 'iron') }).primary).toEqual(
            { label: 'Move 2 goods', enabled: true }
        )
    })
})

describe('R-4.6 per guild and function', () => {
    it('R-4.6.3 Merchant trade: each press shows the next price in rose; past the purse it dims', async () => {
        let price = 0
        const turn = await table((state, { seat }) => {
            setMarket(state, { iron: 4 })
            price = merchantTradeOffers(state, seat).find(({ good }) => good === 'iron')?.price ?? 0
            setShillings(state, seat, price)
        })
        const first = item(offerOf(turn, 'merchant', 'trade'), 'Iron')
        expect(first.note).toEqual({ kind: 'cost', label: `${price}s` })
        expect(first.role).toBe('lit')

        const after = item(offerOf(turn, 'merchant', 'trade', { picks: goods('iron') }), 'Iron')
        expect(after.role).toBe('dimmed')
        expect(after.refusal).toMatch(/^Those goods cost /)
    })

    it('R-4.6.3, R-4.10.2 Merchant trade: a sulfur bought asks how many go in the barrel', async () => {
        const turn = await table((state, { seat }) => {
            setMarket(state, { sulfur: 4 })
            setShillings(state, seat, 30)
        })
        const offer = offerOf(turn, 'merchant', 'trade', { picks: goods('sulfur') })
        expect(offer.rows.map(({ label }) => label)).toEqual(['Keep it', 'Into the barrel: 1'])
        const sent = offerOf(turn, 'merchant', 'trade', { picks: goods('sulfur'), sulfur: 1 })
        expect(sent.params.sulfurToBarrel).toBe(1)
        expect(sent.rows.find(({ picked }) => picked)?.label).toBe('Into the barrel: 1')
    })

    it('R-4.6.3 Alchemist trade: each vessel for sale, once, at its price', async () => {
        const turn = await table((state, { seat }) => {
            setVesselsForSale(state, ['ship', 'ship', 'flying-machine'])
            setShillings(state, seat, 9)
        })
        const offer = offerOf(turn, 'alchemist', 'trade')
        expect(offer.items.map(({ label, note }) => [label, note?.label])).toEqual([
            ['Ship', '3s'],
            ['Flying machine', '3s']
        ])
    })

    it('R-4.6.5 Alchemist push: recipes as notes, the barrel’s at this push’s price', async () => {
        const turn = await table((state, { seat }) => {
            setMaster(state, seat, 'alchemist')
            setCarts(state, { wood: 3, iron: 3, food: 3, sulfur: 3, saltpeter: 3 })
        })
        const offer = offerOf(turn, 'alchemist', 'push')
        expect(offer.line).toBe('Invent up to 3')
        const first = item(offer, 'Krud barrel').note?.label
        const second = item(
            offerOf(turn, 'alchemist', 'push', {
                picks: [{ kind: 'invention', invention: 'krud-barrel' }]
            }),
            'Krud barrel'
        ).note?.label
        expect(first).toBeTruthy()
        expect(second).not.toBe(first)
    })

    it('R-4.6.3 S44 Knight trade: the row says its price and markers; a press takes it', async () => {
        const turn = await table((state, { seat }) => {
            const markers = [0, 0, 0, 0]
            markers[seatRowIndex(state, seat)] = 2
            setRowMarkers(state, markers)
            setShillings(state, seat, 9)
        })
        const seat = seatOf(turn)
        const press = presser()
        const offer = benchOffer(
            seat,
            guildBenchSource(seat, 'knight', 'trade'),
            { picks: [] },
            press
        )
        expect(offer.items.map(({ label }) => label)).toEqual(['3s: take 2 markers'])
        offer.items[0].press?.()
        expect(press.pressed).toEqual(['take'])
        expect(offer.popup).toBeUndefined()
        expect(offer.fixed).toBe(true)
    })

    it('R-4.6.4 Knight pull: one invention, a second replaces it', async () => {
        const turn = await table((state, { seat, other }) => {
            setJourneyman(state, seat, 'knight', other)
            setCarts(state, { wood: 3, iron: 3, food: 3, sulfur: 3, saltpeter: 3 })
        })
        const seat = seatOf(turn)
        const press = presser()
        const offer = benchOffer(
            seat,
            guildBenchSource(seat, 'knight', 'pull'),
            { picks: [{ kind: 'invention', invention: 'ship' }] },
            press
        )
        item(offer, 'Krud barrel').press?.()
        expect(press.pressed).toEqual([[{ kind: 'invention', invention: 'krud-barrel' }]])
    })

    it('R-4.6.5 S45 Knight push: rows of different colours, then as many empty scrolls', async () => {
        const turn = await table((state, { seat }) => {
            setMaster(state, seat, 'knight')
            setRowMarkers(state, [1, 1, 1])
        })
        const none = offerOf(turn, 'knight', 'push')
        expect(none.line).toBe('Move up to 3')
        const scroll = item(none, /r1c1$/)
        expect(scroll.role).toBe('dimmed')

        const one = offerOf(turn, 'knight', 'push', { picks: [{ kind: 'row', row: 0 }] })
        expect(item(one, /r1c1$/).role).toBe('lit')
        expect(one.primary?.enabled).toBe(false)
        const used = one.items.find(({ id }) => id === 'row:0')
        expect(used?.role).toBe('picked')
        expect(used?.press).toBeUndefined()
    })

    it('R-4.6-H1 Noble trade: filled scrolls only, each with its price; a pick presses off', async () => {
        const turn = await table((state, { seat }) => {
            setScrolls(state, [R1C1, R1C2, R2C1])
            setShillings(state, seat, 9)
        })
        const seat = seatOf(turn)
        const press = presser()
        const offer = benchOffer(
            seat,
            guildBenchSource(seat, 'noble', 'trade'),
            { picks: [{ kind: 'scroll', spaceId: R1C1 }] },
            press
        )
        expect(offer.items.map(({ note }) => note?.label)).toEqual(['3s', '3s', '3s'])
        expect(offer.line).toBe('Buy up to 2')
        expect(offer.primary).toEqual({ label: 'Buy 1 seal', enabled: true })
        item(offer, /r1c1$/).press?.()
        expect(press.pressed).toEqual([[]])
    })

    it('R-4.6.5 Noble push: two seals, a flip of unseen values', async () => {
        const turn = await table((state, { seat }) => {
            setMaster(state, seat, 'noble')
            setScrolls(state, [R1C1, R1C2])
        })
        const scrolls: BenchPick[] = [
            { kind: 'scroll', spaceId: R1C1 },
            { kind: 'scroll', spaceId: R1C2 }
        ]
        const offer = offerOf(turn, 'noble', 'push', { picks: scrolls })
        expect(offer.primary).toEqual({ label: "Flip 2 seals · can't be undone", enabled: true })
        expect(offer.result?.line).toMatch(/can't be undone$/)
    })

    it('R-4.6.4 Monk pull: one seal, "Flip it"', async () => {
        const turn = await table((state, { seat, other }) => {
            setJourneyman(state, seat, 'monk', other)
            setScrolls(state, [R1C1, R1C2])
        })
        const offer = offerOf(turn, 'monk', 'pull', {
            picks: [{ kind: 'scroll', spaceId: R1C2 }]
        })
        expect(offer.primary).toEqual({ label: "Flip it · can't be undone", enabled: true })
    })

    it('R-4.6.3, R-4.6-H2 S46 Monk trade: the two candidates lit at the price, no press', async () => {
        const turn = await table((state, { seat }) => {
            setBeads(state, { rosary: [5, 2], chickens: [] })
            setShillings(state, seat, 9)
        })
        const offer = offerOf(turn, 'monk', 'trade')
        expect(
            offer.items.map(({ label, role, note, press }) => [label, role, note?.label, press])
        ).toEqual([
            ['Bead 5', 'lit', '3s', undefined],
            ['Bead 2', 'lit', '3s', undefined]
        ])
        expect(offer.primary).toEqual({ label: "Draw a bead · can't be undone", enabled: true })
    })

    it('R-4.6.5 Monk push: nothing to pick, "Draw a bead", the coffer’s split', async () => {
        const turn = await table((state, { seat }) => {
            setMaster(state, seat, 'monk')
            setBeads(state, { rosary: [5, 2], chickens: [] })
            state.supply.shillings -= 2
            state.guilds.monk.coffer = 2
        })
        const offer = offerOf(turn, 'monk', 'push')
        expect(offer.items).toEqual([])
        expect(offer.primary?.label).toBe("Draw a bead · can't be undone")
        expect(offer.result?.split).toBe('1s to you, 1s stay in the coffer')
    })
})

describe('R-4.6.3 a trade that goes to the map', () => {
    it('R-4.6.3 Farmer trade: the ruled farms with goods, the bench collapsed', async () => {
        let farm: SpaceId = StandingSpace
        const turn = await table((state, { seat }) => {
            farm = ruleFarm(state, seat, { food: 4 })
        })
        const offer = offerOf(turn, 'farmer', 'trade')
        expect(offer.collapsed).toBe('Farmer trade: pick a farm')
        expect(offer.map?.map(({ target }) => target)).toEqual([`space:${farm}`])
        expect(offer.items).toEqual([])
    })

    it('R-4.6.3 the popup splits the goods sent into food and shillings', async () => {
        let farm: SpaceId = StandingSpace
        const turn = await table((state, { seat }) => {
            farm = ruleFarm(state, seat, { food: 4 })
        })
        const offer = offerOf(turn, 'farmer', 'trade', { picks: [], farm })
        expect(offer.popup?.choices[0]?.label).toMatch(/^4 sent: 0 food \/ \ds$/)
        expect(offer.popup?.choices.at(-1)?.label).toMatch(/^4 sent: \d food \/ 0s$/)
    })

    it('R-4.6.3 S44 with enough markers the row’s press asks; a tame collapses to the map', async () => {
        const turn = await table((state, { seat }) => {
            const markers = [0, 0, 0, 0]
            markers[seatRowIndex(state, seat)] = 4
            setRowMarkers(state, markers)
            setShillings(state, seat, 9)
            ruleTown(state, seat)
        })
        const asked = offerOf(turn, 'knight', 'trade', { picks: [], take: true })
        const labels = asked.popup?.choices.map(({ label }) => label)
        expect(labels).toContain('Tame the behemoth')
        expect(labels?.at(-1)).toBe('No')

        const monster: MonsterId = 'behemoth'
        const tamed = offerOf(turn, 'knight', 'trade', { picks: [], take: true, monster })
        expect(tamed.collapsed).toBe('Knight trade: tame the behemoth')
        expect(tamed.map?.length).toBeGreaterThan(0)
        expect(tamed.items).toEqual([])
    })
})

describe('R-3.16.3 S47 a Feast’s bench', () => {
    function feastOffer(
        turn: GuildTable,
        guildId: GuildId,
        stages: BenchStages = { picks: [] }
    ): BenchOffer {
        const seat = seatOf(turn)
        const source: BenchSource | undefined = feastBenchSource(seat, {
            spaceId: StandingSpace,
            opponentId: turn.other,
            guildId
        })
        if (!source) {
            throw new Error('The opponent holds a rank')
        }
        return benchOffer(seat, source, stages, presser())
    }

    it('R-3.16.3, R-3.16-H2 the result line names the feast’s vp and no reeve', async () => {
        const turn = await table((state, { seat, other }) => {
            setMaster(state, other, 'merchant')
            setPawns(state, seat, ['knight'])
            setMarket(state, { wood: 1 })
            state.supply.haversack.sulfur -= 1
            state.getPlayerState(seat).barrel = 1
        })
        const offer = feastOffer(turn, 'merchant', { picks: goods('wood') })
        expect(offer.title).toBe('Merchant push')
        expect(offer.result?.line).toContain('+3 vp feast')
        expect(offer.result?.reeve).toBeUndefined()
        expect(JSON.stringify(offer.result)).not.toContain('reeve')
    })

    it('R-3.16.3 no rank, no bench', async () => {
        const turn = await table(() => {})
        const seat = seatOf(turn)
        expect(
            feastBenchSource(seat, {
                spaceId: StandingSpace,
                opponentId: turn.other,
                guildId: 'merchant'
            })
        ).toBeUndefined()
    })
})
