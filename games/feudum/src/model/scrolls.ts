import { ScrollSpaces, type ScrollSpaceId } from '../data/guilds.js'
import type { HydratedFeudumGameState } from './gameState.js'

type Scrolls = Readonly<Record<ScrollSpaceId, boolean>>

/** R-4.6.1, R-4.6.5 Lines of the scrolls; the actor counts rows or columns, never both. */
export interface ScrollLines {
    readonly rows: number
    readonly columns: number
}

function completedBy(key: 'row' | 'column', before: Scrolls, after: Scrolls): number {
    const lines = [...new Set(ScrollSpaces.map((space) => space[key]))].map((line) =>
        ScrollSpaces.filter((space) => space[key] === line)
    )
    return lines.filter(
        (line) => !line.every((space) => before[space.id]) && line.every((space) => after[space.id])
    ).length
}

function withSeals(scrolls: Scrolls, spaces: readonly ScrollSpaceId[]): Scrolls {
    const next = { ...scrolls }
    for (const spaceId of spaces) {
        next[spaceId] = true
    }
    return next
}

/** R-1.3 The scroll spaces holding no seal, in printed order. */
export function emptyScrollSpaces(state: HydratedFeudumGameState): ScrollSpaceId[] {
    const { scrolls } = state.guilds.noble
    return ScrollSpaces.filter((space) => !scrolls[space.id]).map((space) => space.id)
}

/** R-1.3 The scroll spaces holding a concealed seal, in printed order. */
export function filledScrollSpaces(state: HydratedFeudumGameState): ScrollSpaceId[] {
    const { scrolls } = state.guilds.noble
    return ScrollSpaces.filter((space) => scrolls[space.id]).map((space) => space.id)
}

/** R-4.6.1 Reads public occupancy alone, so a preview can call it. */
export function scrollLinesCompleted(
    state: HydratedFeudumGameState,
    spaces: readonly ScrollSpaceId[]
): ScrollLines {
    const { scrolls } = state.guilds.noble
    const after = withSeals(scrolls, spaces)
    return {
        rows: completedBy('row', scrolls, after),
        columns: completedBy('column', scrolls, after)
    }
}

/** Every way to pick `size` of these. */
function picks(spaces: readonly ScrollSpaceId[], size: number): ScrollSpaceId[][] {
    if (size === 0) {
        return [[]]
    }
    return spaces.flatMap((spaceId, index) =>
        picks(spaces.slice(index + 1), size - 1).map((rest) => [spaceId, ...rest])
    )
}

/** R-4.6.1, R-4.6.5 The best `amount` seals can reach, counting rows or columns, whichever is higher. */
export function bestScrollCompletions(state: HydratedFeudumGameState, amount: number): number {
    return Math.max(
        0,
        ...picks(emptyScrollSpaces(state), amount).map((spaces) => {
            const { rows, columns } = scrollLinesCompleted(state, spaces)
            return Math.max(rows, columns)
        })
    )
}
