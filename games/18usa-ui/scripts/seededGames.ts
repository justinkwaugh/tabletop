import { trainsOwnedBy } from '@tabletop/18xx'
import { PullmanTrainId } from '../../18usa/src/trains.js'
import { botMove, Random } from '../../18usa/test/bot.js'
import { kit, type Table } from '../../18usa/test/kit.js'

/** The first of the seeded games of the logic package's test bot to reach the position. */
export function playUntil(
    players: number,
    seed: number,
    done: (game: Table) => boolean,
    seeds = 40
) {
    for (let tried = seed; tried < seed + seeds; tried++) {
        const game = kit.table(players, tried)
        const random = new Random(tried)
        try {
            for (let count = 0; count < 8000 && !done(game); count++) {
                if (game.state.machineState === 'GameOver') break
                const next = botMove(game, random)
                game.act(next.type, next.fields, next.playerId)
            }
        } catch (error) {
            console.warn(`Seed ${tried} failed after ${game.actions.length} actions`, error)
            continue
        }
        if (done(game)) return game
    }
    throw new Error('The position never came')
}

export const runningWithPullman = (game: Table) => {
    const companyId = game.state.routeStep?.companyId
    return (
        game.state.machineState === 'RunningTrains' &&
        !!companyId &&
        trainsOwnedBy(game.state, { kind: 'company', companyId }).some(
            (train) => train.definitionId === PullmanTrainId
        )
    )
}
