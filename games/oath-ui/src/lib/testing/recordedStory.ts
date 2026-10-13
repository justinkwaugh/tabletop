import { ActionSource, type GameAction, type Patch } from '@tabletop/common'
import { ActionType, type OathProjectedState } from '@tabletop/oath'

export type StoryFields = { type: ActionType; playerId?: string } & Record<string, unknown>

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function pointer(path: string, key: string): string {
    return `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`
}

/** The JSON patch that turns `after` back into `before`, as the engine records an action's undo. */
function undoOps(after: unknown, before: unknown, path = ''): Patch {
    if (isRecord(after) && isRecord(before)) {
        const keys = new Set([...Object.keys(after), ...Object.keys(before)])
        return [...keys].flatMap((key): Patch => {
            const was = before[key]
            const is = after[key]
            if (was === undefined) {
                return is === undefined ? [] : [{ op: 'remove', path: pointer(path, key) }]
            }
            if (is === undefined) {
                return [{ op: 'add', path: pointer(path, key), value: structuredClone(was) }]
            }
            return undoOps(is, was, pointer(path, key))
        })
    }
    return JSON.stringify(after) === JSON.stringify(before)
        ? []
        : [{ op: 'replace', path, value: structuredClone(before) }]
}

/**
 * A recorded game told action by action, for reading past states: each action edits the table
 * and keeps the undo patch that takes it back, as the engine records one. Nothing is validated.
 */
export class RecordedStory {
    actions: GameAction[] = []

    constructor(
        public state: OathProjectedState,
        private readonly idPrefix = 'a'
    ) {}

    act(
        fields: StoryFields,
        edit: (state: OathProjectedState) => void = () => {},
        source = ActionSource.User
    ): this {
        const before = structuredClone(this.state)
        const after = structuredClone(this.state)
        edit(after)
        after.actionCount += 1
        const index = before.actionCount
        this.actions.push({
            id: `${this.idPrefix}${index}`,
            gameId: this.state.gameId,
            source,
            index,
            ...fields,
            undoPatch: undoOps(after, before)
        })
        this.state = after
        return this
    }

    /** R-4.3 — the seat's Rest closes its turn and opens the next seat's. */
    rest(
        playerId: string,
        next: string,
        edit: (state: OathProjectedState) => void = () => {}
    ): this {
        return this.act({ type: ActionType.CompleteRest, playerId }, (state) => {
            const series = state.turnManager.series
            const turn = series.at(-1)
            if (turn) turn.end = state.actionCount + 1
            series.push({ type: 'turn', playerId: next, start: state.actionCount + 1 })
            state.activePlayerIds = [next]
            edit(state)
        })
    }

    /** R-2.11-H1 — the title follows the goal as its own system action. */
    title(fromPlayerId: string | undefined, toPlayerId: string | undefined): this {
        return this.act(
            { type: ActionType.TransferOathkeeper, fromPlayerId, toPlayerId },
            (state) => {
                state.oathkeeperPlayerId = toPlayerId
                state.oathkeeperIsUsurper = false
            },
            ActionSource.System
        )
    }
}
