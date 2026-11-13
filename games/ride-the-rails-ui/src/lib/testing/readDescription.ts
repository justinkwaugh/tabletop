import { railroadName, type Description } from '$lib/utils/describeAction.js'

// Reads a description as plain text the way `Description.svelte` draws it: the reader's own seat
// is "you" (`PlayerName`), any other seat its name, and a railroad its printed name. A spectator
// has no seat, so every seat reads as its name.
export function readDescription(
    description: Description,
    readerId: string | undefined,
    names: Readonly<Record<string, string>>
): string {
    const text = description
        .map((segment) => {
            if (typeof segment === 'string') {
                return segment
            }
            if ('playerId' in segment) {
                return segment.playerId === readerId ? 'you' : (names[segment.playerId] ?? '?')
            }
            return railroadName(segment.railroadId)
        })
        .join('')
    return text.charAt(0).toUpperCase() + text.slice(1)
}
