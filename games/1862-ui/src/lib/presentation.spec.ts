import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { Presentation1862 } from './presentation.js'

const scenario = new URL('../scenarios/phase-d-trains.json', import.meta.url)

it('lets a director draw routes, and runs a company in receivership for the most (§7.3, §7.8)', () => {
    const { state } = JSON.parse(readFileSync(scenario, 'utf8'))
    expect(Presentation1862.manualRoutes?.(state, 'WVR')).toBe(true)
    const company = state.companies.find((candidate: { id: string }) => candidate.id === 'WVR')
    delete company.president
    expect(Presentation1862.manualRoutes?.(state, 'WVR')).toBe(false)
})
