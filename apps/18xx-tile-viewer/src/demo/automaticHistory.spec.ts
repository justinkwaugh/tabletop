import { expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { Definition as Shikoku } from '@tabletop/shikoku-1889'
import { isCompleteStockRound, placeStockMarker } from '@tabletop/18xx'
import { historyDescription } from '../../../../libs/18xx-ui/src/lib/table/historyDescription.js'
import { historyGroups } from '../../../../libs/18xx-ui/src/lib/table/historyGroups.js'
import { historyRounds } from '../../../../libs/18xx-ui/src/lib/table/historyRounds.js'
import { example } from './stockTestUtils.js'

it.each([true, false])('shows meaningful sold-out market movements only: %s', (canMove) => {
    const run = example(Shikoku)
    for (const certificate of run.state.certificates) {
        if (
            certificate.kind !== 'share' ||
            certificate.retired ||
            certificate.owner.kind !== 'bank'
        )
            continue
        certificate.owner = { kind: 'player', playerId: 'casey' }
        delete certificate.poolId
    }
    placeStockMarker(run.state.stockMarket, 'AR', '0:2')
    placeStockMarker(run.state.stockMarket, 'IR', canMove ? '1:2' : '0:2')
    let state = run.state
    const actions: GameAction[] = []
    for (let i = 0; i < 3; i++) {
        const result = run.engine.executeCanonicalAction({
            game: run.game,
            state,
            action: {
                id: `pass:${i}`,
                gameId: state.gameId,
                type: 'FinishStockTurn',
                source: ActionSource.User,
                playerId: state.activePlayerIds[0]
            }
        })
        state = result.updatedState
        actions.push(...result.processedActions)
    }
    const completed = actions.find(isCompleteStockRound)!
    const rounds = historyRounds(actions, state)
    const visible = rounds.flatMap((round) => round.entries)
    expect(visible.some((entry) => entry.id === completed.id)).toBe(canMove)
    if (canMove) {
        expect(
            rounds.find((round) => round.entries.some((entry) => entry.id === completed.id))?.label
        ).toBe(`SR ${run.state.stockRound.number}`)
        const stock = rounds.find((round) => round.label === `SR ${run.state.stockRound.number}`)!
        expect(
            historyGroups(stock.entries, false).find(
                (group) =>
                    group.kind !== 'auction' &&
                    group.actions.some((action) => action.id === completed.id)
            )?.kind
        ).toBe('event')
        const movement = completed.metadata!.marketMoves.find((move) => move.companyId === 'IR')!
        const price = (id: string) =>
            state.stockMarket.spaces.find((space) => space.id === id)!.price
        const description = historyDescription(completed, state)
        expect(description.detail).toContain(
            `IR market ${price(movement.fromMarketSpaceId)} → ${price(movement.toMarketSpaceId)}`
        )
        expect(description.detail).not.toContain('AR')
        expect(description.routine).not.toBe(true)
    }
})
