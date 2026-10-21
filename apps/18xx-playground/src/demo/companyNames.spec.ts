import { describe, expect, it } from 'vitest'
import { playExample, type ScenarioDefinition } from '@tabletop/18xx/scenarios'
import { Scenarios1846 } from '@tabletop/1846/scenarios'
import { TheOldPrinceScenarios } from '@tabletop/the-old-prince/scenarios'
import { Shikoku1889Scenarios } from '@tabletop/shikoku-1889/scenarios'
import { EighteenThirtyScenarios } from '@tabletop/1830/scenarios'
import { EighteenSeventeenScenarios } from '@tabletop/1817/scenarios'
import { EighteenThirtyTwoScenarios } from '@tabletop/1832/scenarios'
import { shortCompanyName } from '../../../../libs/18xx-ui/src/lib/table/companyPresentation.js'
import type { CompanyNameVariants } from '../../../../libs/18xx-ui/src/lib/table/companyPresentation.js'
import { CompanyNames1846 } from '../../../../games/1846-ui/src/lib/companyPresentation.js'
import { TheOldPrinceCompanyNames } from '../../../../games/the-old-prince-ui/src/lib/companyPresentation.js'
import { Shikoku1889CompanyNames } from '../../../../games/shikoku-1889-ui/src/lib/companyPresentation.js'
import { EighteenThirtyCompanyNames } from '../../../../games/1830-ui/src/lib/companyPresentation.js'
import { EighteenSeventeenCompanyNames } from '../../../../games/1817-ui/src/lib/companyPresentation.js'
import { EighteenThirtyTwoCompanyNames } from '../../../../games/1832-ui/src/lib/companyPresentation.js'

const Titles: readonly [string, ScenarioDefinition, Readonly<Record<string, CompanyNameVariants>>][] =
    [
        ['TOP', TheOldPrinceScenarios, TheOldPrinceCompanyNames],
        ['1889', Shikoku1889Scenarios, Shikoku1889CompanyNames],
        ['1830', EighteenThirtyScenarios, EighteenThirtyCompanyNames],
        ['1817', EighteenSeventeenScenarios, EighteenSeventeenCompanyNames],
        ['1846', Scenarios1846, CompanyNames1846],
        ['1832', EighteenThirtyTwoScenarios, EighteenThirtyTwoCompanyNames]
    ]

describe('company names', () => {
    it.each(Titles)('name every company in %s', (_, scenarios, names) => {
        const { state } = playExample(scenarios, 'opening')
        expect(state.companies.map((company) => company.id).filter((id) => !names[id])).toEqual(
            []
        )
    })

    it('drop a redundant ending unless one word would remain', () => {
        expect(shortCompanyName('New York Central Railroad')).toBe('New York Central')
        expect(shortCompanyName('Florida East Coast Railway')).toBe('Florida East Coast')
        expect(shortCompanyName('Central Rail Road & Canal Company')).toBe(
            'Central Rail Road & Canal'
        )
        expect(shortCompanyName('Erie Railroad')).toBe('Erie Railroad')
        expect(shortCompanyName('Steamboat Company')).toBe('Steamboat Company')
        expect(shortCompanyName('Belt Railway of Chicago')).toBe('Belt Railway of Chicago')
    })
})
