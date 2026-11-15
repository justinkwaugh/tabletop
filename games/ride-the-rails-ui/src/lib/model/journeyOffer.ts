import { assertExists } from '@tabletop/common'
import {
    RAILROAD_IDS,
    USA_HEXES,
    hasLinkFrom,
    journeyCities,
    journeyPayments,
    paymentTotal,
    nextCities,
    realise,
    usaCity,
    type CityId,
    type HexId,
    type JourneyPayment,
    type Link,
    type LinksPerRailroad,
    type RailroadId,
    type RideTheRailsGameState
} from '@tabletop/ride-the-rails'
import { EMPTY_BOARD_OFFER, type BoardOffer, type OfferedHex } from './boardOffer.js'
import {
    closeRailroadChoice,
    draftLinks,
    journeyStart,
    railroadChoiceCity,
    type DraftLink,
    type JourneyStage
} from './journeyStage.js'

export type JourneyCity = {
    cityId: CityId
    hexId: HexId
    railroadIds: RailroadId[]
}

export type JourneyDraft = {
    startCityId: CityId
    draftLinks: DraftLink[]
    links: Link[]
}

export type LinkChip = {
    railroadId: RailroadId
    gain: number
}

export type JourneyPopup = {
    cityId: CityId
    hexId: HexId
    chips: LinkChip[]
}

export type JourneyPreview = {
    cityIds: CityId[]
    linksPerRailroad: LinksPerRailroad
    fare: number
    payments: JourneyPayment[]
    riderGain: number
}

export type JourneyOffer = {
    draft: JourneyDraft | undefined
    lit: JourneyCity[]
    popup: JourneyPopup | undefined
    preview: JourneyPreview | undefined
}

export const EMPTY_JOURNEY_OFFER: JourneyOffer = {
    draft: undefined,
    lit: [],
    popup: undefined,
    preview: undefined
}

// R-3.3.1: a journey starts in a city holding a passenger with a link out, in map order.
export function startCities(state: RideTheRailsGameState): JourneyCity[] {
    return USA_HEXES.flatMap((hex): JourneyCity[] => {
        if (hex.terrain !== 'city' || !state.passengers.includes(hex.cityId)) {
            return []
        }
        const railroadIds = RAILROAD_IDS.filter((railroadId) =>
            hasLinkFrom(state.track, hex.id, railroadId)
        )
        return railroadIds.length > 0 ? [{ cityId: hex.cityId, hexId: hex.id, railroadIds }] : []
    })
}

// R-3.3.2, R-3.3.3: the cities one more link reaches from the route's last city, each
// with the railroads for which the whole route still visits no hex twice. The route is named by its
// cities and railroads, so a link may take other hexes than the draft's current realisation.
function extensionCities(
    state: RideTheRailsGameState,
    startCityId: CityId,
    links: readonly DraftLink[]
): JourneyCity[] {
    const lastCityId = links.at(-1)?.cityId ?? startCityId
    return nextCities(state, lastCityId, []).flatMap(({ cityId, railroadIds }): JourneyCity[] => {
        const extending = railroadIds.filter(
            (railroadId) =>
                realiseDraft(state, startCityId, [...links, { cityId, railroadId }]) !== undefined
        )
        return extending.length > 0
            ? [{ cityId, hexId: usaCity(cityId).hexId, railroadIds: extending }]
            : []
    })
}

// R-X.1: the hexes of the route the player named, for the RideJourney the player sends.
function realiseDraft(
    state: RideTheRailsGameState,
    startCityId: CityId,
    links: readonly DraftLink[]
): Link[] | undefined {
    return realise(
        state,
        [startCityId, ...links.map((link) => link.cityId)],
        links.map((link) => link.railroadId)
    )
}

// A draft holds on a state while its start may begin a journey, its links still make a route and
// its open railroad choice is still a city with two or more railroads; otherwise it reads as empty.
export function heldJourneyStage(state: RideTheRailsGameState, stage: JourneyStage): JourneyStage {
    const startCityId = journeyStart(stage)
    if (!startCityId || !startCities(state).some((city) => city.cityId === startCityId)) {
        return {}
    }
    const links = draftLinks(stage)
    if (links.length > 0 && !realiseDraft(state, startCityId, links)) {
        return {}
    }
    const choiceCityId = railroadChoiceCity(stage)
    if (
        choiceCityId &&
        !railroadChoiceAt(extensionCities(state, startCityId, links), choiceCityId)
    ) {
        return closeRailroadChoice(stage)
    }
    return stage
}

// The stage must be held (heldJourneyStage) on the state.
export function journeyOffer(
    state: RideTheRailsGameState,
    stage: JourneyStage,
    riderId: string
): JourneyOffer {
    const startCityId = journeyStart(stage)
    if (!startCityId) {
        return { ...EMPTY_JOURNEY_OFFER, lit: startCities(state) }
    }
    const links = draftLinks(stage)
    const realised = links.length > 0 ? realiseDraft(state, startCityId, links) : []
    assertExists(realised, 'A held journey draft makes a route')
    const lit = extensionCities(state, startCityId, links)
    const choiceCityId = railroadChoiceCity(stage)
    const choice = choiceCityId ? railroadChoiceAt(lit, choiceCityId) : undefined
    return {
        draft: { startCityId, draftLinks: links, links: realised },
        lit,
        popup: choice && {
            cityId: choice.cityId,
            hexId: choice.hexId,
            chips: choice.railroadIds.map((railroadId) => ({
                railroadId,
                gain: gainWith(
                    state,
                    startCityId,
                    [...links, { cityId: choice.cityId, railroadId }],
                    riderId
                )
            }))
        },
        preview: realised.length > 0 ? journeyPreview(state, realised, riderId) : undefined
    }
}

// R-3.3.4, R-3.3.5: what RideJourney pays for these links, from the same payment helper.
export function journeyPreview(
    state: RideTheRailsGameState,
    links: readonly Link[],
    riderId: string
): JourneyPreview {
    const { linksPerRailroad, payments } = journeyPayments(state.players, riderId, links)
    const rider = payments.find((payment) => payment.playerId === riderId)
    assertExists(rider, `No player ${riderId}`)
    return {
        cityIds: journeyCities(links),
        linksPerRailroad,
        fare: rider.fare,
        payments,
        riderGain: paymentTotal(rider)
    }
}

// The journey's lit cities as the board offer the map layers draw: a pip per railroad, a scrim
// hole for every lit city and for the picked start, which a press clears.
export function journeyBoardOffer(offer: JourneyOffer): BoardOffer {
    if (offer.lit.length === 0 && !offer.draft) {
        return EMPTY_BOARD_OFFER
    }
    const lit = offer.lit.map((city): OfferedHex => ({
        hexId: city.hexId,
        placements: city.railroadIds.map((railroadId) => ({
            railroadId,
            isStart: false,
            bonuses: []
        })),
        marks: [],
        startOnly: false
    }))
    const startHexId = offer.draft ? [usaCity(offer.draft.startCityId).hexId] : []
    return {
        lit,
        scrim: { holes: [...startHexId, ...lit.map((hex) => hex.hexId)] },
        popup: undefined
    }
}

function railroadChoiceAt(lit: readonly JourneyCity[], cityId: CityId): JourneyCity | undefined {
    const city = lit.find((candidate) => candidate.cityId === cityId)
    return city && city.railroadIds.length > 1 ? city : undefined
}

function gainWith(
    state: RideTheRailsGameState,
    startCityId: CityId,
    links: readonly DraftLink[],
    riderId: string
): number {
    const realised = realiseDraft(state, startCityId, links)
    assertExists(realised, 'A lit railroad makes a route')
    return journeyPreview(state, realised, riderId).riderGain
}
