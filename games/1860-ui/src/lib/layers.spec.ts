import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { companyLayers } from './layers.js'

const scenarioState = (name: string): object =>
    JSON.parse(readFileSync(new URL(`../scenarios/${name}.json`, import.meta.url), 'utf8')).state

describe('the company layers panel', () => {
    it('opens only the first layer at the first stock round, the second next', () => {
        const layers = companyLayers(scenarioState('first-stock-round'))
        expect(layers.map((entry) => entry.standing)).toEqual(['open', 'next', 'later', 'later'])
        expect(layers.map((entry) => entry.companies.map((company) => company.companyId))).toEqual([
            ['CN', 'IOW'],
            ['IWNJ', 'FYN'],
            ['NGStL', 'BHIR'],
            ['SC', 'VYSC']
        ])
        expect(layers[0]?.parRange).toEqual({ minimum: 74, maximum: 100 })
    })

    it('opens the second layer once a first-layer company has operated', () => {
        const layers = companyLayers(scenarioState('halts'))
        expect(layers.map((entry) => entry.standing)).toEqual(['open', 'open', 'next', 'later'])
        expect(layers[0]?.companies.every((company) => company.started)).toBe(true)
    })
})
