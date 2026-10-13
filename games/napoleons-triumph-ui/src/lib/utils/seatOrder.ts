import type { BattleMap, Side } from '@tabletop/napoleons-triumph'
import { LOCALE_GEOMETRY } from '$lib/map/boardGeometry.js'
import { toView, viewFor, viewRotation } from './boardView.js'

/** Commanders as their set-up locales lie from left to right with the board seen from their own army's lines; those that set up off the map follow, in the order given. */
export function leftToRightFromOwnLines(
    map: BattleMap,
    side: Side,
    commanderIds: readonly string[]
): string[] {
    const rotation = viewRotation(viewFor(side))
    const onTheBoard = commanderIds.flatMap((commanderId) => {
        const locale = map.setupLocale(commanderId)
        return locale
            ? [{ commanderId, across: toView(LOCALE_GEOMETRY[locale.id].anchor, rotation).x }]
            : []
    })
    return [
        ...onTheBoard.toSorted((a, b) => a.across - b.across).map((entry) => entry.commanderId),
        ...commanderIds.filter((commanderId) => map.setupLocale(commanderId) === undefined)
    ]
}
