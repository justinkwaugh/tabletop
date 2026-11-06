import { beforeAll, describe, expect, it } from 'vitest'
import { docTableRows, readDoc } from '../testing/docs.js'
import { GuildIds } from './components.js'
import {
    DoubleSidedDiscs,
    FeudumDiscs,
    LocationDiscs,
    LocationDiscTotals,
    LocationKinds,
    StartingDiscs
} from './discs.js'

let components = ''

beforeAll(async () => {
    components = await readDoc('components.md')
})

function count<T>(rows: readonly T[], matches: (row: T) => boolean): number {
    return rows.filter(matches).length
}

describe('R-1.4.3 the rows of components.md', () => {
    it('setup discs: id, kind and circle mark', () => {
        expect(StartingDiscs.map((disc) => [disc.id, disc.kind, disc.circleMark])).toEqual(
            docTableRows(components, '### Setup discs (22)').map((row) => [
                row['Id'],
                row['Type'],
                row['Circle marker (TT manifest)'] === 'yes'
            ])
        )
    })

    it('double-sided discs: id and both faces', () => {
        expect(DoubleSidedDiscs.map((disc) => [disc.id, disc.faces.a, disc.faces.b])).toEqual(
            docTableRows(components, '### Double-sided discs (10)').map((row) => [
                row['Id'],
                ...row['Face A'].split('/')
            ])
        )
    })

    it('R-1.2.4 feudums: id, guild icon and both faces', () => {
        const rows = docTableRows(components, '### Feudums (12)')
        expect(FeudumDiscs.map((disc) => disc.id)).toEqual(rows.map((row) => row['Id']))
        FeudumDiscs.forEach((disc, index) => {
            const row = rows[index]
            expect(row['Face A']).toBe(disc.faces.a)
            expect(row['Face B']).toBe(`${disc.faces.b} (same icon)`)
            expect(row['Icon']).toContain(`${disc.icon} `)
            expect(row['Icon']).toContain(`(guild ${disc.guild})`)
        })
    })
})

describe('R-1.4.3 the counts', () => {
    it('44 discs, each id once', () => {
        expect(LocationDiscs).toHaveLength(44)
        expect(LocationDiscTotals.discs).toBe(44)
        expect(new Set(LocationDiscs.map((disc) => disc.id)).size).toBe(44)
    })

    it('22 placed at setup and 22 double-sided in the general supply, 12 of them feudums', () => {
        expect(LocationDiscTotals.starting).toBe(22)
        expect(LocationDiscTotals.doubleSided).toBe(10)
        expect(LocationDiscTotals.feudums).toBe(12)
        expect(LocationDiscTotals.generalSupply).toBe(22)
    })

    it('6 circle marks, for the 6 starting spaces: 2 farms, 2 towns, 2 outposts', () => {
        expect(LocationDiscTotals.circleMarks).toBe(6)
        const marked = StartingDiscs.filter((disc) => disc.circleMark)
        expect(count(marked, (disc) => disc.kind === 'farm')).toBe(2)
        expect(count(marked, (disc) => disc.kind === 'town')).toBe(2)
        expect(count(marked, (disc) => disc.kind === 'outpost')).toBe(2)
    })

    it('16 unmarked: 5 farms, 3 towns, 8 outposts', () => {
        const plain = StartingDiscs.filter((disc) => !disc.circleMark)
        expect(plain).toHaveLength(16)
        expect(count(plain, (disc) => disc.kind === 'farm')).toBe(5)
        expect(count(plain, (disc) => disc.kind === 'town')).toBe(3)
        expect(count(plain, (disc) => disc.kind === 'outpost')).toBe(8)
    })

    it('R-3.9.1 double-sided: 8 farm/town, 1 outpost/farm, 1 outpost/town, never a feudum', () => {
        const pairs = DoubleSidedDiscs.map((disc) => `${disc.faces.a}/${disc.faces.b}`)
        expect(count(pairs, (pair) => pair === 'farm/town')).toBe(8)
        expect(count(pairs, (pair) => pair === 'outpost/farm')).toBe(1)
        expect(count(pairs, (pair) => pair === 'outpost/town')).toBe(1)
    })

    it('R-1.2.4 2 feudums per guild, numbered 1 and 2, the guild icon on both faces', () => {
        for (const guild of GuildIds) {
            expect(
                FeudumDiscs.filter((disc) => disc.guild === guild).map((disc) => disc.id)
            ).toEqual([`disc.feudum.${guild}-1`, `disc.feudum.${guild}-2`])
        }
        for (const disc of FeudumDiscs) {
            expect(disc.faces).toEqual({ a: 'feudum', b: 'feudum' })
        }
    })

    it('R-3.9.1 the kinds run in improvement order: outpost, farm, town, feudum', () => {
        expect(LocationKinds).toEqual(['outpost', 'farm', 'town', 'feudum'])
    })
})
