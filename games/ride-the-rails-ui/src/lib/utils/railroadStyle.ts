import { assertExists } from '@tabletop/common'
import { RAILROADS, type RailroadId } from '@tabletop/ride-the-rails'

export type RailroadStyle = {
    railroadId: RailroadId
    name: string
    monogram: string
    /** The rule colour (R-1.1) as the art plan's token, never a seat colour (U-6). */
    fill: string
    /** The letter's ink on the railroad's colour, chosen by contrast. */
    ink: string
    /** The monogram on a hollow (start) pip, on the station's white: the rule colour, but dark for Yellow. */
    hollowInk: string
}

const MONOGRAMS: Readonly<Record<RailroadId, string>> = {
    'railroad.red': 'R',
    'railroad.blue': 'B',
    'railroad.orange': 'O',
    'railroad.yellow': 'Y',
    'railroad.purple': 'P',
    'railroad.black': 'K'
}

function tokenName(railroadId: RailroadId): string {
    return railroadId.slice('railroad.'.length)
}

export function railroadStyle(railroadId: RailroadId): RailroadStyle {
    const railroad = RAILROADS.find((candidate) => candidate.id === railroadId)
    assertExists(railroad, `No railroad ${railroadId}`)
    const token = tokenName(railroadId)
    return {
        railroadId,
        name: railroad.printedName,
        monogram: MONOGRAMS[railroadId],
        fill: `var(--rtr-railroad-${token})`,
        ink: `var(--rtr-railroad-${token}-ink)`,
        hollowInk:
            railroadId === 'railroad.yellow'
                ? 'var(--rtr-station-ink)'
                : `var(--rtr-railroad-${token})`
    }
}

/** Railroad names as a sentence: "Red", "Red or Blue", "Red, Blue or Black". */
export function railroadNames(railroadIds: readonly RailroadId[], joiner = 'or'): string {
    const names = railroadIds.map((railroadId) => railroadStyle(railroadId).name)
    return names.length <= 1
        ? names.join('')
        : `${names.slice(0, -1).join(', ')} ${joiner} ${names[names.length - 1]}`
}
