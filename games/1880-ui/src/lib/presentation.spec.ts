import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { StationRules1880, TitleRules1880, type State1880 } from '@tabletop/1880'
import { companiesOnOffer } from '@tabletop/18xx-ui'
import { Presentation1880 } from './presentation.js'

const privateAuction: State1880 = JSON.parse(
    readFileSync(new URL('../scenarios/private-auction.json', import.meta.url), 'utf8')
).state

function offeredCompanyIds() {
    const unstarted = Presentation1880.unstartedCompanies
    assertExists(unstarted, '1880 lists its unstarted companies')
    return companiesOnOffer(privateAuction, TitleRules1880.stockRules.charters, (companyId) =>
        unstarted.onOffer(privateAuction, companyId)
    ).map((company) => company.id)
}

it('offers the majors but not the foreign investors or the BCR (§VI, §VII)', () => {
    expect(offeredCompanyIds()).toEqual([
        'JHA',
        'JHU',
        'JGG',
        'JLR',
        'BZU',
        'LHR',
        'SCR',
        'CKR',
        'NXR',
        'HKR',
        'NJR',
        'QSR',
        'WNR'
    ])
})

it('prices every station token on an unstarted company’s card (§X)', () => {
    const offered = offeredCompanyIds()
    const tokens = privateAuction.stations.filter(
        (station) => station.status === 'available' && offered.includes(station.companyId)
    )
    expect(tokens).not.toEqual([])
    for (const token of tokens) {
        expect(StationRules1880.placementCost(privateAuction, token.id)).toBeGreaterThanOrEqual(0)
    }
})
