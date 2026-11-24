import type { PrivateMarkerOption, PrivateTokenOption } from './companyDecisionsModule.svelte.js'
import type { TitlePrivatePower } from './privateActionsModule.svelte.js'

type Naming = { company(privateCompanyId: string): string; marker(kind: string): string }
type Placing = {
    marker(option: PrivateMarkerOption): Promise<void>
    token(option: PrivateTokenOption): Promise<void>
}

function groups<T extends { privateCompanyId: string; playerId: string }>(
    options: readonly T[],
    key: (option: T) => string
): T[][] {
    const grouped = new Map<string, T[]>()
    for (const option of options) {
        const id = `${option.playerId}:${option.privateCompanyId}:${key(option)}`
        grouped.set(id, [...(grouped.get(id) ?? []), option])
    }
    return [...grouped.values()]
}

/** The tapped place's option: the tapped stop's, or the place's only one. */
function tapped<T>(
    here: readonly T[],
    nodeId: string | undefined,
    nodeOf: (option: T) => string | undefined
) {
    return (
        here.find((option) => nodeId !== undefined && nodeOf(option) === nodeId) ??
        (here.length === 1 ? here[0] : undefined)
    )
}

/**
 * The privates' markers and stations as powers chosen on the map: one for each private, over
 * every place it may use.
 */
export function privateLocationPowers(
    markers: readonly PrivateMarkerOption[],
    tokens: readonly PrivateTokenOption[],
    naming: Naming,
    placing: Placing
): TitlePrivatePower[] {
    const markerPowers = groups(markers, (option) => option.kind).map(
        (options): TitlePrivatePower => {
            const [{ privateCompanyId, playerId, kind }] = options
            const name = naming.marker(kind)
            return {
                kind: 'location',
                privateCompanyId,
                playerId,
                label: naming.company(privateCompanyId),
                prompt: `Choose a highlighted place on the map for the ${name.toLowerCase()}`,
                locationIds: [...new Set(options.map((option) => option.locationId))],
                async choose(locationId, nodeId) {
                    const here = options.filter((option) => option.locationId === locationId)
                    const option = tapped(here, nodeId, (entry) => entry.nodeId)
                    if (option) await placing.marker(option)
                }
            }
        }
    )
    const tokenPowers = groups(tokens, (option) => option.companyId).map(
        (options): TitlePrivatePower => {
            const [{ privateCompanyId, playerId }] = options
            const company = naming.company(privateCompanyId)
            return {
                kind: 'location',
                privateCompanyId,
                playerId,
                label: company,
                prompt: `Choose a highlighted city on the map for the ${company} station`,
                stationStepLabel: company,
                locationIds: [...new Set(options.map((option) => option.position.locationId))],
                async choose(locationId, nodeId) {
                    const here = options.filter(
                        (option) => option.position.locationId === locationId
                    )
                    const option = tapped(here, nodeId, (entry) => entry.position.nodeId)
                    if (option) await placing.token(option)
                }
            }
        }
    )
    return [...markerPowers, ...tokenPowers]
}
