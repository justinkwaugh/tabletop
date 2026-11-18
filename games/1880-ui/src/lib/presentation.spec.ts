import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    BcrId,
    ForeignInvestors1880,
    MajorIds1880,
    StationRules1880,
    type State1880
} from '@tabletop/1880'
import { Presentation1880 } from './presentation.js'

const state: State1880 = JSON.parse(
    readFileSync(new URL('../scenarios/first-share-round.json', import.meta.url), 'utf8')
).state

const unstartedIds = state.companies
    .filter((company) => !company.started && company.kind !== 'private')
    .map((company) => company.id)

function companiesOnOffer() {
    const unstarted = Presentation1880.unstartedCompanies
    assertExists(unstarted, '1880 lists its unstarted companies')
    return unstartedIds.filter((companyId) => unstarted.onOffer(state, companyId))
}

it('offers the unstarted majors but not unchosen investors or the BCR (§VI, §VII)', () => {
    expect(ForeignInvestors1880.some(({ id }) => unstartedIds.includes(id))).toBe(true)
    expect(companiesOnOffer()).toEqual(
        unstartedIds.filter((id) => MajorIds1880.includes(id) && id !== BcrId)
    )
})

it('prices every station token on an unstarted company’s card (§X)', () => {
    const offered = companiesOnOffer()
    const tokens = state.stations.filter(
        (station) => station.status === 'available' && offered.includes(station.companyId)
    )
    expect(tokens).not.toEqual([])
    for (const token of tokens) {
        expect(StationRules1880.placementCost(state, token.id)).toBeGreaterThanOrEqual(0)
    }
})
