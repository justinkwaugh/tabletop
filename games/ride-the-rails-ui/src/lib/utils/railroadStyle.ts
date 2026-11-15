import { assertExists } from '@tabletop/common'
import { RAILROADS, type RailroadId } from '@tabletop/ride-the-rails'

/** Art plan, Ghost cube: a pale square of the railroad's colour and its dashed edge. */
export type GhostPaint = { fill: string; line: string }

export type RailroadStyle = {
    railroadId: RailroadId
    name: string
    /** The rule colour (R-1.1) as the art plan's token, never a seat colour (U-6). */
    fill: string
    /** Text on the railroad's colour, chosen by contrast. */
    ink: string
    ghost: GhostPaint
    /** A dashed start cue on a grey city hex: the rule colour, darker for Yellow. */
    cue: string
}

function tokenName(railroadId: RailroadId): string {
    return railroadId.slice('railroad.'.length)
}

export function railroadStyle(railroadId: RailroadId): RailroadStyle {
    const railroad = RAILROADS.find((candidate) => candidate.id === railroadId)
    assertExists(railroad, `No railroad ${railroadId}`)
    const token = tokenName(railroadId)
    const fill = `var(--rtr-railroad-${token})`
    return {
        railroadId,
        name: railroad.printedName,
        fill,
        ink: `var(--rtr-railroad-${token}-ink)`,
        ghost: {
            fill: `var(--rtr-ghost-${token})`,
            // Yellow's own colour would barely show on its pale square.
            line: railroadId === 'railroad.yellow' ? 'var(--rtr-ghost-yellow-line)' : fill
        },
        cue: railroadId === 'railroad.yellow' ? 'var(--rtr-cue-yellow)' : fill
    }
}

/** Railroad names as a sentence: "Red", "Red or Blue", "Red, Blue or Black". */
export function railroadNames(railroadIds: readonly RailroadId[], joiner = 'or'): string {
    const names = railroadIds.map((railroadId) => railroadStyle(railroadId).name)
    return names.length <= 1
        ? names.join('')
        : `${names.slice(0, -1).join(', ')} ${joiner} ${names[names.length - 1]}`
}
