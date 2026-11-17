import { describe, expect, it } from 'vitest'
import {
    PhaseName,
    USA_CITIES,
    cityById,
    type CityId,
    type HexId,
    type Track
} from '@tabletop/ride-the-rails'
import { buildState } from '@tabletop/ride-the-rails/testing'
import { startCues } from './startCues.js'

function hexOf(cityId: CityId): HexId {
    return cityById(cityId).hexId
}

const CHICAGO = hexOf('city.usa.chicago')
const OMAHA = hexOf('city.usa.omaha')
const KANSAS_CITY = hexOf('city.usa.kansas-city')
const DES_MOINES = hexOf('city.usa.des-moines')
const DENVER = hexOf('city.usa.denver')
const SEATTLE = hexOf('city.usa.seattle')

const WEST_COAST = USA_CITIES.filter((city) => city.groups.includes('west-coast')).map(
    (city) => city.hexId
)

// Orange has built west from Chicago: Omaha, Kansas City and Des Moines hold one cube each.
const MIDWEST: Track = {
    [CHICAGO]: ['railroad.orange'],
    [OMAHA]: ['railroad.orange'],
    [KANSAS_CITY]: ['railroad.blue'],
    [DES_MOINES]: ['railroad.orange']
}

function cuedHexes(round: number, track: Track, phase = PhaseName.Build) {
    const cues = startCues(buildState({ round, phase, track }))
    return {
        yellow: cues.filter((cue) => cue.railroadId === 'railroad.yellow').map((cue) => cue.hexId),
        purple: cues.filter((cue) => cue.railroadId === 'railroad.purple').map((cue) => cue.hexId)
    }
}

const sorted = (hexIds: readonly HexId[]) => hexIds.toSorted()

describe('start cues for a new railroad (R-4.2.3, R-4.2.4)', () => {
    it('marks nothing before Yellow is available', () => {
        expect(startCues(buildState({ round: 2, phase: PhaseName.Build, track: MIDWEST }))).toEqual(
            []
        )
    })

    it('marks Yellow’s start cities from round 3, in any phase, whoever acts', () => {
        const expected = sorted([CHICAGO, OMAHA, KANSAS_CITY, DES_MOINES])
        expect(sorted(cuedHexes(3, MIDWEST).yellow)).toEqual(expected)
        expect(sorted(cuedHexes(3, MIDWEST, PhaseName.TakeShare).yellow)).toEqual(expected)
        expect(cuedHexes(3, MIDWEST).purple).toEqual([])
    })

    it('follows the track: a placement changes Yellow’s cities', () => {
        // A second cube in Omaha leaves no room for Yellow's western start there.
        const fuller = { ...MIDWEST, [OMAHA]: ['railroad.orange', 'railroad.blue'] }
        expect(cuedHexes(3, fuller).yellow).not.toContain(OMAHA)
        // A cube further west, in Denver, takes the third westernmost place from Des Moines.
        const west = { ...MIDWEST, [DENVER]: ['railroad.orange'] }
        expect(sorted(cuedHexes(3, west).yellow)).toEqual(
            sorted([CHICAGO, DENVER, OMAHA, KANSAS_CITY])
        )
    })

    it('stops marking Yellow once it has a cube on the map', () => {
        const started = { ...MIDWEST, [CHICAGO]: ['railroad.orange', 'railroad.yellow'] }
        expect(cuedHexes(4, started).yellow).toEqual([])
    })

    it('marks Purple’s West Coast cities from round 4, and follows the track', () => {
        expect(cuedHexes(4, MIDWEST).purple).toEqual(WEST_COAST)
        const fullSeattle = { ...MIDWEST, [SEATTLE]: ['railroad.black', 'railroad.orange'] }
        expect(cuedHexes(4, fullSeattle).purple).toEqual(
            WEST_COAST.filter((hexId) => hexId !== SEATTLE)
        )
        const started = { ...MIDWEST, [SEATTLE]: ['railroad.purple'] }
        expect(cuedHexes(4, started).purple).toEqual([])
    })

    it('never marks Black', () => {
        const cues = startCues(buildState({ round: 6, phase: PhaseName.Build, track: MIDWEST }))
        expect(cues.some((cue) => cue.railroadId === 'railroad.black')).toBe(false)
    })
})
