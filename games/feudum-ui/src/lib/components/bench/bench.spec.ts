// @vitest-environment node
import { assertExists } from '@tabletop/common'
import { render } from 'svelte/server'
import { describe, expect, it } from 'vitest'
import { Seals, type GuildFunctionName, type GuildId } from '@tabletop/feudum'
import {
    benchOffer,
    feastBenchSource,
    guildBenchSource,
    knightRowPlace,
    type BenchOffer,
    type BenchPick,
    type BenchPresser,
    type BenchSeat,
    type BenchStages
} from '$lib/model/benchOffer.js'
import { benchViewOf } from '$lib/model/benchView.js'
import { BenchScenes, FeastSpace, R1C1, type BenchSceneName } from '$lib/testing/benchScenes.js'
import BenchOnTable from '$lib/testing/BenchOnTable.svelte'
import { guildTable, type GuildTable } from '$lib/testing/guildTable.js'
import { BenchAreaWidth } from '$lib/utils/boardGeometry.js'

const noop = () => {}
const pressed: BenchPresser = {
    picks: noop,
    take: noop,
    monster: noop,
    deploy: noop,
    farm: noop,
    split: noop,
    sulfur: noop,
    count: noop
}

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

function seatOf({ session, seat }: GuildTable): BenchSeat {
    return {
        state: session.gameState,
        playerId: seat,
        nameOf: (id) => session.getPlayerName(id),
        input: {}
    }
}

async function offered(
    name: BenchSceneName,
    guild: GuildId,
    fn: GuildFunctionName,
    stages: BenchStages = { picks: [] }
) {
    const scene = BenchScenes[name]
    const turn = await guildTable(scene.arrange)
    const seat = seatOf(turn)
    return { turn, bench: benchOffer(seat, guildBenchSource(seat, guild, fn), stages, pressed) }
}

function markup(turn: GuildTable, bench: BenchOffer): string {
    return render(BenchOnTable, {
        props: {
            bench,
            state: turn.session.gameState,
            playerId: turn.seat,
            paintOf,
            colourPaintOf,
            pointer: turn.session,
            onPress: noop
        }
    }).body
}

function count(html: string, text: string) {
    return html.split(text).length - 1
}

function goods(...kinds: readonly ('iron' | 'wood')[]): BenchPick[] {
    return kinds.map((good) => ({ kind: 'good', good }))
}

describe('the bench draws its offer (contract: the bench)', () => {
    it('S41 R-4.6.4 from-guild left, to-guild right, each at the fixed width', async () => {
        const { turn, bench } = await offered('merchantPull', 'merchant', 'pull')
        const html = markup(turn, bench)
        expect(html.indexOf('data-bench-area="farmer"')).toBeGreaterThan(-1)
        expect(html.indexOf('data-bench-area="farmer"')).toBeLessThan(
            html.indexOf('data-bench-area="merchant"')
        )
        expect(count(html, `width="${BenchAreaWidth}"`)).toBeGreaterThanOrEqual(2)
    })

    it('S41 R-4.6.4 a trade shows its one guild', async () => {
        const { turn, bench } = await offered('merchantTrade', 'merchant', 'trade')
        const html = markup(turn, bench)
        expect(count(html, 'data-bench-area=')).toBe(1)
    })

    it('S41 R-4.6.4 ghosts land in the bins’ next spaces; the result line and the toggle', async () => {
        const { turn, bench } = await offered('merchantPull', 'merchant', 'pull', {
            picks: goods('iron', 'iron', 'wood')
        })
        const html = markup(turn, bench)
        const places = bench.ghosts.map(({ at }) => at)
        expect(new Set(places).size).toBe(3)
        for (const at of places) {
            expect(html).toContain(`data-ghost-at="${at}"`)
        }
        const merchant = html.slice(html.indexOf('data-bench-area="merchant"'))
        expect(count(merchant, 'data-ghost=')).toBe(3)
        expect(html).toContain("3 vp · 2 writs, keep 1 · can't be undone")
        expect(html).toContain('data-bench-moved')
        expect(html).toMatch(/data-row="Columns \(2\)"[^>]*data-picked/)
        expect(html).not.toMatch(/data-row="Rows \(1\)"[^>]*data-picked/)
    })

    it('R-4.6-H5 what the rules refuse of the picks so far stands on the result line', async () => {
        const { turn, bench } = await offered('merchantPull', 'merchant', 'pull')
        expect(bench.refused).toBeTruthy()
        expect(markup(turn, bench)).toContain('data-bench-refused')
    })

    it('S42 R-4.6.4 a pull below its threshold says so, with no warning', async () => {
        const { turn, bench } = await offered('belowThreshold', 'merchant', 'pull', {
            picks: goods('iron')
        })
        const html = markup(turn, bench)
        expect(html).toMatch(/data-bench-result[^>]*>0 vp · no writ</)
        expect(html).not.toContain('undone')
    })

    it('R-4.6.2 a trade’s payment split stands beside its result, each price on its bin', async () => {
        const { turn, bench } = await offered('merchantTrade', 'merchant', 'trade', {
            picks: goods('iron')
        })
        const html = markup(turn, bench)
        expect(html).toContain('data-bench-payment')
        expect(html).toContain('data-bench-note="cost"')
    })

    it('S41 R-4.6.5 a set count is a press on the result line', async () => {
        const { turn, bench } = await offered('farmerPush', 'farmer', 'push', {
            picks: goods('iron', 'iron', 'wood')
        })
        expect(bench.count?.every(({ press }) => press !== undefined)).toBe(true)
        const toggle = markup(turn, bench)
        expect(toggle).toContain('data-bench-count-toggle')
    })

    it('S43 R-4.6.5, R-4.6.6 inventions are buttons with recipes; the barrel fills each Knight row', async () => {
        const stages = {
            picks: [
                { kind: 'invention', invention: 'ship' },
                { kind: 'invention', invention: 'krud-barrel' }
            ]
        } satisfies BenchStages
        const { turn, bench } = await offered('alchemistPush', 'alchemist', 'push', stages)
        const html = markup(turn, bench)
        expect(count(html, 'data-bench-button="invention:')).toBe(4)
        expect(html).toContain('data-ghost-at="vessel-space"')
        const rows = turn.session.gameState.guilds.knight.rows
        const placed = benchViewOf(bench, turn.session.gameState, turn.seat).areas.flatMap(
            ({ ghosts }) => ghosts
        )
        for (const { colour } of rows) {
            const place = knightRowPlace(colour)
            expect(placed.some(({ at, point }) => at === place && point !== undefined)).toBe(true)
        }
    })

    it('S44 R-4.6.3 the seat’s row is a button with its price and markers', async () => {
        const { turn, bench } = await offered('knightTrade', 'knight', 'trade')
        const html = markup(turn, bench)
        expect(html).toContain('data-bench-button="row:seat"')
        expect(html).toContain('3s: take 4 markers')
    })

    it('S45 R-4.6.5, R-5-H1 a picked row’s seal lands on its scroll unseen; no seal is named', async () => {
        const stages = {
            picks: [
                { kind: 'row', row: 0 },
                { kind: 'scroll', spaceId: R1C1 }
            ]
        } satisfies BenchStages
        const { turn, bench } = await offered('knightPush', 'knight', 'push', stages)
        const html = markup(turn, bench)
        expect(html).toContain(`data-ghost-at="${R1C1}"`)
        const view = benchViewOf(bench, turn.session.gameState, turn.seat)
        const landed = view.areas.find(({ guild }) => guild === 'noble')?.ghosts
        expect(landed?.map(({ piece }) => piece)).toEqual([{ kind: 'seal' }])
        const said = JSON.stringify([bench.items, bench.ghosts, bench.result])
        expect(Seals.some(({ id }) => said.includes(`"${id}"`))).toBe(false)
    })

    it('S46 R-4.6.3 the two beads are lit, with no press: the draw is the primary', async () => {
        const { turn, bench } = await offered('monkTrade', 'monk', 'trade')
        const html = markup(turn, bench)
        expect(count(html, 'data-bench-role="lit"')).toBe(2)
        const view = benchViewOf(bench, turn.session.gameState, turn.seat)
        expect(view.areas.flatMap(({ placed }) => placed).every(({ presses }) => !presses)).toBe(
            true
        )
    })

    it('S47 R-3.16.3 a Feast’s result names its points and no reeve', async () => {
        const turn = await guildTable(BenchScenes.feast.arrange)
        const seat = seatOf(turn)
        const source = feastBenchSource(seat, {
            spaceId: FeastSpace,
            opponentId: turn.other,
            guildId: 'merchant'
        })
        assertExists(source, 'The opponent has rank here')
        const bench = benchOffer(seat, source, { picks: goods('wood') }, pressed)
        const html = markup(turn, bench)
        expect(html).toContain('+3 vp feast')
        expect(html).not.toContain('data-bench-reeve')
    })

    it('S44 R-4.6.3 a map pick closes it to its header, over nothing of the map', async () => {
        const { turn, bench } = await offered('farmerTrade', 'farmer', 'trade')
        expect(bench.collapsed).toBe('Pick a farm.')
        const html = markup(turn, bench)
        expect(html).toContain('data-bench-header')
        expect(html).not.toContain('data-bench-area')
    })
})
