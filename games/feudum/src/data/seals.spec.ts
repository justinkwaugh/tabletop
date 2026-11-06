import { beforeAll, describe, expect, it } from 'vitest'
import { docTableRows, readDoc } from '../testing/docs.js'
import { SealBeadCounts, SealFace, Seals, SealTotal } from './seals.js'

let rows: Record<string, string>[] = []
let totals: Record<string, string>[] = []

beforeAll(async () => {
    const components = await readDoc('components.md')
    rows = docTableRows(components, "## King's seals / rosary beads (17)")
    totals = docTableRows(components, '## Totals')
})

describe('R-1.1 the seals of components.md', () => {
    it('17 discs with permanent ids seal.1 to seal.17', () => {
        expect(SealTotal).toBe(17)
        expect(Seals).toHaveLength(17)
        expect(Seals.map((seal) => seal.id)).toEqual(rows.map((row) => row['Id']))
        expect(Seals.map((seal) => seal.id)).toEqual(
            Array.from({ length: 17 }, (_, index) => `seal.${index + 1}`)
        )
        expect(
            totals.find((row) => row['Kind'] === "King's seals / rosary beads")?.['Rows above']
        ).toBe('17')
    })

    it('every seal side is the same, so a seal shows nothing of its bead (R-5-H1)', () => {
        expect(rows.map((row) => row['Seal side'])).toEqual(rows.map(() => SealFace))
    })

    it('each bead value is the row of components.md', () => {
        expect(Seals.map((seal) => `+${seal.beadValue}`)).toEqual(
            rows.map((row) => row['Bead side value'])
        )
    })

    it('+2 x9, +3 x5, +4 x2, +5 x1, assigned in numbered order', () => {
        expect(SealBeadCounts).toEqual([
            { beadValue: 2, count: 9 },
            { beadValue: 3, count: 5 },
            { beadValue: 4, count: 2 },
            { beadValue: 5, count: 1 }
        ])
        const values = Seals.map((seal) => seal.beadValue)
        expect(values).toEqual(values.toSorted((a, b) => a - b))
        expect(Math.min(...values)).toBe(2)
        expect(Math.max(...values)).toBe(5)
    })
})
