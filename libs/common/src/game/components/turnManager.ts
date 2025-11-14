import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { Turn } from '../model/turn.js'
import { findLast } from '../../util/findLast.js'
import { Hydratable } from '../../util/hydration.js'
import { PlayerState } from '../model/playerState.js'
import { shuffle } from '../../util/shuffle.js'
import type { RandomFunction } from '../../util/prng.js'

export type TurnManager = Static<typeof TurnManager>
export const TurnManager = Type.Object({
    series: Type.Array(Turn),
    turnOrder: Type.Array(Type.String()),
    turnCounts: Type.Record(Type.String(), Type.Number())
})

export const TurnManagerValidator = Compile(TurnManager)

export class HydratedSimpleTurnManager
    extends Hydratable<typeof TurnManager>
    implements TurnManager
{
    declare series: Turn[]
    declare turnOrder: string[]
    declare turnCounts: Record<string, number>

    constructor(data: TurnManager) {
        super(data, TurnManagerValidator)
    }

    static generate(players: PlayerState[], random: RandomFunction) {
        const turnOrder = players.map((player) => player.playerId)
        const turnCounts = <Record<string, number>>{}
        players.forEach((player) => {
            turnCounts[player.playerId] = 0
        })

        shuffle(turnOrder, random)
        return new HydratedSimpleTurnManager({
            series: [],
            turnOrder: turnOrder,
            turnCounts: turnCounts
        })
    }

    currentTurn(): Turn | undefined {
        return findLast(this.series, (turn) => {
            return !turn.end
        })
    }

    startTurn(playerId?: string, actionIndex: number = 0): Turn {
        const turn: Turn = {
            type: 'turn',
            playerId: playerId ?? this.turnOrder[0],
            start: actionIndex
        }
        this.series.push(turn)
        return turn
    }

    restartTurnOrder(actionIndex: number): string {
        const nextPlayer = this.turnOrder[0]
        this.startTurn(nextPlayer, actionIndex)
        return nextPlayer
    }

    startNextTurn(actionIndex: number, predicate?: (playerId: string) => boolean): string {
        const lastPlayerId = this.lastPlayer()
        const nextPlayer = this.nextPlayer(lastPlayerId, predicate)
        this.startTurn(nextPlayer, actionIndex)
        return nextPlayer
    }

    endTurn(actionIndex: number): Turn {
        const turnToEnd = this.currentTurn()
        if (!turnToEnd) {
            throw Error(`Cannot find turn to end`)
        }
        turnToEnd.end = actionIndex + 1 // non inclusive
        this.turnCounts[turnToEnd.playerId] += 1
        return turnToEnd
    }

    lastPlayer(): string | undefined {
        if (this.series.length === 0) {
            return undefined
        }

        const lastTurn = this.series[this.series.length - 1]
        if (lastTurn.end) {
            return lastTurn.playerId
        }

        if (this.series.length < 2) {
            return undefined
        }

        return this.series[this.series.length - 2].playerId
    }

    nextPlayer(currentPlayerId?: string, predicate?: (nextPlayerId: string) => boolean): string {
        if (!currentPlayerId) {
            return this.turnOrder[0]
        }

        const currentPlayerIndex = this.getTurnOrderIndex(currentPlayerId)
        let nextPlayerIndex = currentPlayerIndex
        do {
            nextPlayerIndex = (nextPlayerIndex + 1) % this.turnOrder.length
        } while (
            predicate &&
            !predicate(this.turnOrder[nextPlayerIndex]) &&
            nextPlayerIndex !== currentPlayerIndex
        )

        return this.turnOrder[nextPlayerIndex]
    }

    turnCount(playerId: string): number {
        return this.turnCounts[playerId] ?? 0
    }

    hadTurnSinceAction(playerId: string, actionIndex: number): boolean {
        const lastTurn = findLast(this.series, (turn) => {
            return turn.playerId === playerId && turn.end !== undefined
        })
        return lastTurn !== undefined && (lastTurn.end ?? 0) > actionIndex
    }

    private getTurnOrderIndex(playerId: string): number {
        const turnOrderIndex = this.turnOrder.indexOf(playerId)
        if (turnOrderIndex < 0) {
            throw Error(`Player ${playerId} not found in turn order`)
        }
        return turnOrderIndex
    }
}
