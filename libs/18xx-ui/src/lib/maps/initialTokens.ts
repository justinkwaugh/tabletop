import type { MapViewDefinition, StationAppearance } from './stationPresentation.js'

/** Labels longer than this, such as a joint token's two names, don't fit on a disc. */
const LongestInitials = 5

/** A logo becomes initials; art with no initials that fit, such as a neutral marker, stays. */
export function initialToken(appearance: StationAppearance): StationAppearance {
    if (!appearance.imageUrl || !appearance.label || appearance.label.length > LongestInitials)
        return appearance
    const { imageUrl: _, ...plain } = appearance
    return plain
}

function allInitials(
    stations: Readonly<Record<string, StationAppearance>>
): Readonly<Record<string, StationAppearance>> {
    return Object.fromEntries(
        Object.entries(stations).map(([id, look]) => [id, initialToken(look)])
    )
}

/**
 * The map view with every company token drawn as a disc of the company's color bearing its
 * initials, for players who prefer plain tokens to logos. Token tiles and printed map art keep
 * their look.
 */
export function withInitialTokens(view: MapViewDefinition): MapViewDefinition {
    const { stateStations } = view
    return {
        ...view,
        stations: allInitials(view.stations),
        ...(view.publishedStations && { publishedStations: allInitials(view.publishedStations) }),
        ...(view.sharedStations && { sharedStations: allInitials(view.sharedStations) }),
        ...(view.neutralStation && { neutralStation: initialToken(view.neutralStation) }),
        ...(view.closedCompanyStation && {
            closedCompanyStation: initialToken(view.closedCompanyStation)
        }),
        ...(stateStations && { stateStations: (state) => allInitials(stateStations(state)) })
    }
}
