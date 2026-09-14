import { expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import { Definition as Top, TheOldPrinceTrainRules } from '@tabletop/the-old-prince'
import { Definition as Shikoku, Shikoku1889TrainRules } from '@tabletop/shikoku-1889'
import { TrainPurchase } from '@tabletop/18xx'
import { example } from './stockTestUtils.js'

it.each([{ definition: Top, rules: TheOldPrinceTrainRules }, { definition: Shikoku, rules: Shikoku1889TrainRules }])('ends train buying when cash exhaustion leaves no further choices: $definition.info.id', ({ definition, rules }) => {
    const { game, engine, state } = example(definition, 'trains')
    const details = new TrainPurchase(state, rules).offers().find((offer) => offer.evaluation.details)?.evaluation.details
    if (!details) throw Error('Expected a train purchase')
    const cash = state.cash.find((entry) => entry.owner.kind === 'company' && entry.owner.companyId === details.companyId)
    if (!cash) throw Error('Expected company cash')
    cash.amount = details.price
    const before = structuredClone(state)
    const result = engine.executeCanonicalAction({ game, state, action: {
        id: 'last-affordable-train', gameId: state.gameId, source: ActionSource.User,
        type: 'BuyTrain', playerId: state.activePlayerIds[0], companyId: details.companyId,
        trainId: details.trainId, definitionId: details.definitionId, expectedPrice: details.price
    } })
    expect(result.processedActions.some((action) => action.type === 'FinishOperatingTurn' && action.source === ActionSource.System)).toBe(true)
    let reversed = result.updatedState
    for (const action of result.processedActions.toReversed()) reversed = engine.undoProcessedAction({ state: reversed, action })
    expect(reversed).toEqual(before)
})
