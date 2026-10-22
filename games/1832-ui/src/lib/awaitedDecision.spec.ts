import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { playExample } from '@tabletop/18xx/scenarios'
import { EighteenThirtyTwoScenarios } from '@tabletop/1832/scenarios'
import { awaitedDecision1832 } from './awaitedDecision.js'

const names = {
    companyName: (companyId: string) => `Company ${companyId}`,
    companyInitials: (companyId: string) => companyId,
    playerName: (playerId: string) => playerId,
    money: (amount: number) => `$${amount}`
}

function scenarioState(slug: string) {
    const file = new URL(`../scenarios/${slug}.json`, import.meta.url)
    return JSON.parse(readFileSync(file, 'utf8')).state
}

describe('awaitedDecision1832', () => {
    it('describes nothing during an ordinary stock turn', () => {
        const play = playExample(EighteenThirtyTwoScenarios, 'trading', 3)
        expect(awaitedDecision1832(play.state, names)).toBeUndefined()
    })

    it('describes the sale its president may protect, and the price either way', () => {
        expect(awaitedDecision1832(scenarioState('price-protection'), names)).toEqual({
            title: 'Price protection',
            companyId: 'CG',
            text: 'alex sold 2 CG shares for $200. blair may buy them to keep the price at $100, or let it drop to $82'
        })
    })
})
