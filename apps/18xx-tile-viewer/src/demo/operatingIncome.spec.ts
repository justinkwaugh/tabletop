import { expect, it } from 'vitest'
import { isFinishOperatingTurn } from '@tabletop/18xx'
import { operatingHistory } from '../../../../libs/18xx-ui/src/lib/table/operatingHistory.js'
import { TheOldPrinceEndingRules } from '@tabletop/the-old-prince'
import { migrateOperatingIncome } from './migrateOperatingIncome.js'
import { finishedGame } from './finishedGame.js'

it('builds full-game income from recorded actions without states or replay patches', async () => {
    const { game, state, engine, actions } = await finishedGame('local-user', 'Income history')
    const records = actions.map(({ undoPatch, forwardPatch, ...action }) => action)
    const before = structuredClone(records)
    const rounds = operatingHistory(records)
    expect(rounds.length).toBeGreaterThan(10)
    expect(rounds.at(-1)?.playerNetWorth).toEqual(
        Object.fromEntries(
            game.players.map((player, index) => [player.id, [6764, 7328, 7126][index]])
        )
    )
    for (const action of records.filter(isFinishOperatingTurn)) {
        if (!action.metadata?.complete) continue
        const snapshot = action.metadata
        const round = rounds.find(
            (entry) => entry.id === `${snapshot.number}.${snapshot.roundNumber}`
        )
        expect(round?.playerNetWorth).toEqual(snapshot.playerNetWorth)
        expect(round?.complete).toBe(true)
    }
    for (const round of rounds) {
        for (const [companyId, run] of Object.entries(round.companyRuns)) {
            expect(run.companyId).toBe(companyId)
            expect(run.metadata?.revenue).toBe(round.companyIncome[companyId])
        }
    }
    expect(rounds.some((round) => round.withheldCompanyIds.length > 0)).toBe(true)
    expect(records).toEqual(before)
    const legacy = structuredClone(actions)
    for (const action of legacy) {
        if (action.type === 'FinishOperatingTurn') Reflect.deleteProperty(action, 'metadata')
        const metadata: unknown = Reflect.get(action, 'metadata')
        if (metadata && typeof metadata === 'object') {
            if (action.type === 'StartOperatingRound') Reflect.deleteProperty(metadata, 'snapshot')
            if (action.type === 'DistributeEarnings') {
                Reflect.deleteProperty(metadata, 'companyName')
                Reflect.deleteProperty(metadata, 'round')
            }
        }
    }
    const originalState = structuredClone(state)
    expect(migrateOperatingIncome(state, legacy, engine, TheOldPrinceEndingRules)).toBe(true)
    expect(operatingHistory(legacy.map(({ undoPatch, forwardPatch, ...action }) => action))).toEqual(rounds)
    expect(migrateOperatingIncome(state, legacy, engine, TheOldPrinceEndingRules)).toBe(false)
    expect(state).toEqual(originalState)
}, 60000)
