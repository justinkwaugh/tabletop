import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { startOrder } from './startOrder.js'

const scenario = (name: string) =>
    JSON.parse(readFileSync(new URL(`../scenarios/${name}.json`, import.meta.url), 'utf8')).state

it('lists the corporations in their dealt order, the RSA’s started, the second next (§2.2, §8.1)', () => {
    const state = scenario('first-stock-round')
    const entries = startOrder(state)
    expect(entries.map((entry) => entry.companyId)).toEqual(state.corporationOrder)
    expect(entries.map((entry) => entry.standing.kind)).toEqual([
        'started',
        'next',
        ...entries.slice(2).map(() => 'waiting')
    ])
})

it('marks the started corporations and the one a player may start next (§9.4)', () => {
    const state = scenario('garibaldi-start')
    const entries = startOrder(state)
    for (const entry of entries)
        expect(entry.standing.kind === 'started').toBe(
            state.companies.some(
                (company: { id: string; started?: boolean }) =>
                    company.id === entry.companyId && company.started
            )
        )
    expect(entries.filter((entry) => entry.standing.kind === 'next')).toHaveLength(1)
    expect(entries.find((entry) => entry.standing.kind === 'next')?.companyId).toBe('AFG')
})

it('shows a set-aside Garibaldi with room as starting from the next stock round (§9.4.1)', () => {
    const state = scenario('garibaldi-start')
    state.garibaldiAside = true
    state.corporationOrder = [...state.corporationOrder.filter((id: string) => id !== 'AFG'), 'AFG']
    const garibaldi = startOrder(state).at(-1)
    expect(garibaldi?.companyId).toBe('AFG')
    expect(garibaldi?.standing).toEqual({
        kind: 'returning',
        stockRound: state.stockRound.number + 1
    })
})

it('gives a started corporation the home its station stands in', () => {
    const state = scenario('garibaldi-start')
    const started = startOrder(state).filter((entry) => entry.standing.kind === 'started')
    expect(started.length).toBeGreaterThan(0)
    for (const entry of started) {
        const home = state.stations.find(
            (station: { id: string }) => station.id === `${entry.companyId}:home`
        )
        if (home?.status === 'placed')
            expect(entry.homeLocationIds).toEqual([home.position.locationId])
    }
})
