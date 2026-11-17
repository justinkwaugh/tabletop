import {
    BONUSES,
    TRANSCONTINENTAL_BONUS,
    boardMap,
    cityById,
    isEastCoastCity,
    isWestCoastCity,
    type BonusId,
    type ConnectionBonus,
    type ConnectionClaim,
    type JunctionPricedBonus,
    type MapId,
    type TranscontinentalClaim
} from '@tabletop/ride-the-rails'
import { connectionBonus } from './linkBonus.js'

// R-4.3.3, R-8: what the bonus chip in the turn line explains when pressed. The rule is one
// sentence per kind of bonus, filled from the logic's bonus table and the map's cities.

export type BonusDescription = {
    bonusId: BonusId
    name: string
    /** The amount, or the line's two prices. */
    terms: string
    rule: string
    /** The cities the rule names by their group (the USA's coasts), one line a group. */
    places: string[]
    status: string
}

/** What the description reads from the displayed state. */
export type BonusClaims = {
    mapId: MapId
    transcontinental?: TranscontinentalClaim
    connectionClaim?: ConnectionClaim
}

type PlayerName = (playerId: string) => string

const LIST = new Intl.ListFormat('en-GB', { type: 'conjunction' })

/** A list of names, "Berlin, Hamburg and Köln". */
export function listed(names: readonly string[]): string {
    return LIST.format(names)
}

function claimed(playerId: string, amount: number, playerName: PlayerName): string {
    return `Claimed by ${playerName(playerId)} for $${amount}.`
}

// R-8.3, R-8.5
export function connectionDescription(
    bonus: ConnectionBonus,
    claim: ConnectionClaim | undefined,
    playerName: PlayerName
): BonusDescription {
    const cities = listed(bonus.cityIds.map((cityId) => cityById(cityId).name))
    return {
        bonusId: bonus.id,
        name: bonus.printedName,
        terms: `$${bonus.amount}`,
        rule:
            `$${bonus.amount} to the first player whose placement connects ${cities} through ` +
            'complete links of any railroads, changing railroad only in cities. Paid once.',
        places: [],
        status: claim
            ? claimed(claim.playerId, bonus.amount, playerName)
            : 'Open: the gold rings on the board mark its cities.'
    }
}

// R-4.3.3
export function transcontinentalDescription(
    bonus: JunctionPricedBonus,
    mapId: MapId,
    claim: TranscontinentalClaim | undefined,
    playerName: PlayerName
): BonusDescription {
    const city = `$${bonus.cityHexAmount}`
    const other = `$${bonus.otherHexAmount}`
    const cities = boardMap(mapId).cities
    const names = (inGroup: (candidate: (typeof cities)[number]) => boolean) =>
        listed(cities.filter(inGroup).map((candidate) => candidate.name))
    return {
        bonusId: bonus.id,
        name: bonus.printedName,
        terms: `${city} / ${other}`,
        rule:
            `${city} to the first player whose placement completes a line of track from a West ` +
            'Coast city to an East Coast city on two or more railroads, changing railroad only ' +
            `in cities; ${other} if the line changes railroad elsewhere. Railroads join only in ` +
            'a hex where both have a locomotive. Paid once.',
        places: [
            `West Coast: ${names(isWestCoastCity)}.`,
            `East Coast: ${names(isEastCoastCity)}.`
        ],
        status: claim
            ? claimed(claim.playerId, claim.amount, playerName)
            : `Open: while you build, a hex that would complete a line shows ${city} or ${other}.`
    }
}

/** The description of the bonus whose chip stands in the map's turn line, if it has one. */
export function turnLineBonusDescription(
    claims: BonusClaims,
    playerName: PlayerName
): BonusDescription | undefined {
    if (BONUSES[claims.mapId].some((bonus) => bonus.id === TRANSCONTINENTAL_BONUS.id)) {
        return transcontinentalDescription(
            TRANSCONTINENTAL_BONUS,
            claims.mapId,
            claims.transcontinental,
            playerName
        )
    }
    const bonus = connectionBonus(claims.mapId)
    return bonus && connectionDescription(bonus, claims.connectionClaim, playerName)
}
