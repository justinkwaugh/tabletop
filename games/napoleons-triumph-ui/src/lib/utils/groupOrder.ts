/** The order the map stacks a player's groups in a position: corps by commander, detached units last. */
export function byCommander(a: string | undefined, b: string | undefined): number {
    if ((a === undefined) !== (b === undefined)) {
        return a === undefined ? 1 : -1
    }
    return (a ?? '').localeCompare(b ?? '')
}
