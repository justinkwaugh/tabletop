import { HydratedTurnManager, type Turn, type TurnManager } from '@tabletop/common'

type Table = { readonly state: { turnManager: TurnManager } }
type Played = Table & { act(type: string, fields?: object, playerId?: string): unknown }

/** Notes each turn a table opens, read after every move: the State of a new game forgets older turns. */
export function turnRecord(played: Played) {
    const turns: Turn[] = []
    const finishedBefore = finishedTurns(played)
    const note = () => {
        const open = new HydratedTurnManager(played.state.turnManager).currentTurn()
        if (open && !turns.some((turn) => turn.start === open.start)) turns.push(open)
    }
    note()
    return {
        turns,
        get players(): string[] {
            return turns.map((turn) => turn.playerId)
        },
        get finished(): number {
            return finishedTurns(played) - finishedBefore
        },
        act(type: string, fields: object, playerId: string) {
            played.act(type, fields, playerId)
            note()
        }
    }
}

export function finishedTurns(table: Table): number {
    return Object.values(table.state.turnManager.turnCounts).reduce((sum, count) => sum + count, 0)
}
