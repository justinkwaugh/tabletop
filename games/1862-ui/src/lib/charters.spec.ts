import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { charterRows } from './charters.js'

it('lays the dealt charters out by when they arrive, with those out of play (§2.4.1)', () => {
    const { state } = JSON.parse(
        readFileSync(new URL('../scenarios/first-operating-turn.json', import.meta.url), 'utf8')
    )
    const rows = charterRows(state)
    expect(rows.map((row) => [row.label, row.note, row.charters.length])).toEqual([
        ['Now', '8 dealt', 8],
        ['Phase B', 'first B train', 4],
        ['Phase C', 'first C train', 4],
        ['Out of play', undefined, 4]
    ])
    const started = state.companies
        .filter((company: { started: boolean }) => company.started)
        .map((company: { id: string }) => company.id)
    expect(
        rows
            .flatMap((row) => row.charters)
            .filter((charter) => charter.started)
            .map((charter) => charter.companyId)
            .sort()
    ).toEqual([...started].sort())
    expect(rows[3].charters.every((charter) => !charter.started && charter.home)).toBe(true)
})
