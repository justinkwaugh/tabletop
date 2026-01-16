import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { Hydratable } from '../../util/hydration.js'
import { Round } from '../model/round.js'
import { findLast } from '../../util/findLast.js'

export type RoundManager = Type.Static<typeof RoundManager>
export const RoundManager = Type.Object({
    series: Type.Array(Round)
})

export const RoundManagerValidator = Compile(RoundManager)

export class HydratedRoundManager extends Hydratable<typeof RoundManager> implements RoundManager {
    declare series: Round[]

    constructor(data: RoundManager) {
        super(data, RoundManagerValidator)
    }

    static generate(): HydratedRoundManager {
        return new HydratedRoundManager({
            series: []
        })
    }

    get currentRound(): Round | undefined {
        return findLast(this.series, (round) => {
            return !round.end
        })
    }

    startRound(actionIndex: number = 0): Round {
        const round: Round = {
            type: 'round',
            start: actionIndex,
            number: this.series.length + 1
        }
        this.series.push(round)
        return round
    }

    endRound(actionIndex: number): Round {
        if (this.series.length === 0) {
            throw Error(`Cannot end a round when there are no rounds`)
        }
        const roundToEnd = this.series[this.series.length - 1]
        if (roundToEnd.end !== undefined) {
            throw Error(`Round has already ended`)
        }

        roundToEnd.end = actionIndex + 1
        return roundToEnd
    }
}
