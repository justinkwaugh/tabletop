import { expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { Definition as Shikoku } from '@tabletop/shikoku-1889'
import { isFinishStockTurn, type SetStockInstruction } from '@tabletop/18xx'
import { historyDescription } from '../../../../libs/18xx-ui/src/lib/table/historyDescription.js'
import { historyGroups } from '../../../../libs/18xx-ui/src/lib/table/historyGroups.js'
import { historyRounds } from '../../../../libs/18xx-ui/src/lib/table/historyRounds.js'
import { example } from './stockTestUtils.js'

it('keeps standing instructions out of the history and shows the automatic pass like any pass', () => {
    const run = example(Shikoku)
    const declaration: SetStockInstruction = {
        id: 'declare',
        gameId: run.state.gameId,
        type: 'SetStockInstruction',
        source: ActionSource.User,
        playerId: 'blair',
        outOfTurn: true,
        instruction: { kind: 'pass' }
    }
    const declared = run.engine.executeCanonicalAction({
        game: run.game,
        state: run.state,
        action: declaration
    })
    const finished = run.engine.executeCanonicalAction({
        game: run.game,
        state: declared.updatedState,
        action: {
            id: 'alex-finishes',
            gameId: run.state.gameId,
            type: 'FinishStockTurn',
            source: ActionSource.User,
            playerId: 'alex'
        }
    })
    const state = finished.updatedState
    const actions: GameAction[] = [...declared.processedActions, ...finished.processedActions]
    expect(actions.map((action) => action.type)).toEqual([
        'SetStockInstruction',
        'FinishStockTurn',
        'FinishStockTurn'
    ])
    const rounds = historyRounds(actions, state)
    const entries = rounds.flatMap((round) => round.entries)
    expect(entries.map((entry) => entry.id)).toEqual([actions[2].id, 'alex-finishes'])
    const automaticPass = actions[2]
    expect(isFinishStockTurn(automaticPass) && automaticPass.source).toBe(ActionSource.System)
    const groups = rounds.flatMap((round) => historyGroups(round.entries, false))
    expect(groups.map((group) => group.kind)).toEqual(['passes'])
    for (const action of actions.slice(1)) {
        const text = JSON.stringify(historyDescription(action, state))
        expect(text).not.toMatch(/automatic|instruction/i)
    }
})

it('lists an automatic purchase exactly like a purchase made by hand', () => {
    const run = example(Shikoku)
    const declaration: SetStockInstruction = {
        id: 'declare',
        gameId: run.state.gameId,
        type: 'SetStockInstruction',
        source: ActionSource.User,
        playerId: 'alex',
        outOfTurn: true,
        instruction: {
            kind: 'buy',
            companyId: 'IR',
            preferredPoolId: 'initial-offering',
            until: { kind: 'shares', count: 10 },
            thenPass: true
        }
    }
    const result = run.engine.executeCanonicalAction({
        game: run.game,
        state: run.state,
        action: declaration
    })
    const actions = result.processedActions
    expect(actions.map((action) => action.type)).toEqual([
        'SetStockInstruction',
        'BuyShares',
        'FinishStockTurn'
    ])
    const rounds = historyRounds(actions, result.updatedState)
    const entries = rounds.flatMap((round) => round.entries)
    expect(
        entries.map((entry) => (entry.kind === 'action' ? entry.action.type : entry.kind))
    ).toEqual(['FinishStockTurn', 'BuyShares'])
    const purchase = historyDescription(actions[1], result.updatedState)
    expect(purchase.text).toMatch(/^Bought 1 IR/)
    expect(JSON.stringify(purchase)).not.toMatch(/automatic|instruction/i)
})
