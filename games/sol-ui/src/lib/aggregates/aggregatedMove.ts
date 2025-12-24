import { ActionSource, GameAction } from '@tabletop/common'
import { isFly, isHurl, isLaunch, type Fly, type Hurl, type Launch } from '@tabletop/sol'
import { nanoid } from 'nanoid'

export type AggregatedMove = GameAction & {
    playerId: string
    numLaunched: number
    numFlown: number
    numHurled: number
    momentumGained: number
    paidPlayerIds: string[]
}

export function aggregateMoveActions(actions: (Fly | Launch | Hurl)[]): AggregatedMove {
    if (actions.length === 0) {
        throw Error('No actions to aggregate')
    }

    console.log('Aggregating move actions', actions)
    const aggregated: AggregatedMove = {
        id: nanoid(),
        gameId: actions[0].gameId,
        source: ActionSource.User,
        type: 'AggregatedMove',
        playerId: actions[0].playerId,
        numLaunched: 0,
        numFlown: 0,
        numHurled: 0,
        momentumGained: 0,
        createdAt: actions[0].createdAt,
        paidPlayerIds: []
    }

    const paidSet = new Set<string>()
    for (const action of actions) {
        if (isLaunch(action)) {
            aggregated.numLaunched += action.numSundivers
        } else if (isFly(action)) {
            aggregated.numFlown += action.sundiverIds.length
            aggregated.momentumGained += action.metadata?.momentumGained ?? 0
            for (const playerId of action.metadata?.paidPlayerIds ?? []) {
                paidSet.add(playerId)
            }
        } else if (isHurl(action)) {
            aggregated.numHurled += action.sundiverIds.length
            aggregated.momentumGained += action.metadata?.momentumGained ?? 0
            for (const playerId of action.metadata?.paidPlayerIds ?? []) {
                paidSet.add(playerId)
            }
        }
    }

    aggregated.paidPlayerIds = Array.from(paidSet)
    return aggregated
}

export function isAggregatedMove(action?: GameAction): action is AggregatedMove {
    return action?.type === 'AggregatedMove'
}
