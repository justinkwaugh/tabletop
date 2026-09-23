import { expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import { isBuyShares, privateOwner, sharesOwned, type SetStockInstruction } from '@tabletop/18xx'
import { exampleGame } from '@tabletop/18xx/scenarios'
import { TheOldPrinceStockRules } from './stockRules.js'
import { TheOldPrinceScenarios } from './scenarios/index.js'

it('buys as the player and never on behalf of the Union Bank', () => {
    const { game, engine, state } = exampleGame(TheOldPrinceScenarios, 'trading')
    const alex = { kind: 'player', playerId: 'alex' } as const
    expect(privateOwner(state, 'UB')).toEqual(alex)
    expect(TheOldPrinceStockRules.buyers(state, 'alex')).toContainEqual({
        kind: 'company',
        companyId: 'UB'
    })
    const declaration: SetStockInstruction = {
        id: 'alex-autobuy',
        gameId: game.id,
        source: ActionSource.User,
        type: 'SetStockInstruction',
        playerId: 'alex',
        outOfTurn: true,
        instruction: {
            kind: 'buy',
            companyId: 'ML',
            preferredPoolId: 'market',
            until: { kind: 'shares', count: sharesOwned(state, 'ML', alex) + 1 },
            thenPass: false
        }
    }
    const result = engine.executeCanonicalAction({ game, state, action: declaration })
    const purchase = result.processedActions[1]
    expect(isBuyShares(purchase) && purchase.source).toBe(ActionSource.System)
    expect(isBuyShares(purchase) && purchase.buyer).toEqual(alex)
    expect(sharesOwned(result.updatedState, 'ML', alex)).toBe(sharesOwned(state, 'ML', alex) + 1)
    expect(sharesOwned(result.updatedState, 'ML', { kind: 'company', companyId: 'UB' })).toBe(
        sharesOwned(state, 'ML', { kind: 'company', companyId: 'UB' })
    )
    expect(result.updatedState.stockRound.companyPurchases).not.toContain('UB')
})
