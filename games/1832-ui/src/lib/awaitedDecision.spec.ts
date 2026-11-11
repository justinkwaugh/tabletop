import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { playExample } from '@tabletop/18xx/scenarios'
import {
    EighteenThirtyTwoPriceProtection,
    EighteenThirtyTwoRedemption,
    type HydratedEighteenThirtyTwoState
} from '@tabletop/1832'
import { EighteenThirtyTwoScenarios } from '@tabletop/1832/scenarios'
import { ShareActions } from '@tabletop/18xx-ui'
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
        const state = scenarioState('price-protection')
        const shareActions = new ShareActions<HydratedEighteenThirtyTwoState>(
            {
                gameState: state,
                validActionTypes: [],
                canChooseAction: false,
                createPlayerAction: () => {
                    throw new Error('Not acting')
                },
                applyAction: async () => undefined,
                companyName: names.companyName
            },
            EighteenThirtyTwoPriceProtection,
            EighteenThirtyTwoRedemption
        )
        expect(shareActions.awaitedDecision(state, names)).toEqual({
            title: 'Price protection',
            companyId: 'CG',
            text: 'alex sold 2 CG shares for $200. blair may buy them to keep the price at $100, or let it drop to $82'
        })
    })
})
