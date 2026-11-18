import { describe, expect, it } from 'vitest'
import {
    GREATER_GERMANY_BONUS,
    INTERCOLONIAL_BONUS,
    TRANSCONTINENTAL_BONUS,
    type MapId
} from '@tabletop/ride-the-rails'
import {
    connectionDescription,
    transcontinentalDescription,
    turnLineBonusDescription
} from './bonusDescription.js'
import { connectionChip } from './linkBonus.js'

const NAMES: Record<string, string> = { p1: 'Ada', p2: 'Bea' }
const playerName = (playerId: string) => NAMES[playerId] ?? playerId

describe('the bonus chip’s description (R-4.3.3, R-8)', () => {
    it('states Greater Germany’s rule, its five cities and that it is open', () => {
        expect(turnLineBonusDescription({ mapId: 'map.de' }, playerName)).toEqual({
            bonusId: 'bonus.de.greater-germany',
            name: 'Greater Germany',
            terms: '$12',
            rule:
                '$12 to the first player whose placement connects Berlin, Hamburg, Köln, Dresden ' +
                'and München through complete links of any railroads, changing railroad only in ' +
                'cities. Paid once.',
            places: [],
            status: 'Open: the gold rings on the board mark its cities.'
        })
    })

    it('names Greater Germany’s claimant and the amount paid once claimed', () => {
        const description = turnLineBonusDescription(
            { mapId: 'map.de', connectionClaim: { playerId: 'p2' } },
            playerName
        )
        expect(description?.status).toBe('Claimed by Bea for $12.')
        expect(description?.rule).toContain('$12 to the first player')
    })

    it('states the Intercolonial’s rule with its $8 and three cities', () => {
        const description = turnLineBonusDescription({ mapId: 'map.ca' }, playerName)
        expect(description?.name).toBe('Intercolonial')
        expect(description?.terms).toBe('$8')
        expect(description?.rule).toBe(
            '$8 to the first player whose placement connects Sault Ste. Marie, Windsor and ' +
                'Québec City through complete links of any railroads, changing railroad only in ' +
                'cities. Paid once.'
        )
        expect(description?.status).toBe('Open: the gold rings on the board mark its cities.')
    })

    it('states the Transcontinental’s rule, both prices and the coasts’ cities while open', () => {
        expect(turnLineBonusDescription({ mapId: 'map.usa' }, playerName)).toEqual({
            bonusId: 'bonus.usa.transcontinental',
            name: 'Transcontinental',
            terms: '$12 / $8',
            rule:
                '$12 to the first player whose placement completes a line of track from a West ' +
                'Coast city to an East Coast city on two or more railroads, changing railroad ' +
                'only in cities; $8 if the line changes railroad elsewhere. Railroads join only ' +
                'in a hex where both have a locomotive. Paid once.',
            places: [
                'West Coast: Seattle, Portland (Oregon), San Francisco and Los Angeles.',
                'East Coast: New York, Philadelphia, Baltimore, Washington, Charleston and ' +
                    'Jacksonville.'
            ],
            status: 'Open: while you build, a hex that would complete a line shows $12 or $8.'
        })
    })

    it('names the Transcontinental’s claimant and the price paid once claimed', () => {
        const description = turnLineBonusDescription(
            { mapId: 'map.usa', transcontinental: { playerId: 'p1', amount: 8 } },
            playerName
        )
        expect(description?.status).toBe('Claimed by Ada for $8.')
        expect(description?.terms).toBe('$12 / $8')
    })

    it('reads the amounts and cities from the bonus table', () => {
        const richer = connectionDescription(
            { ...GREATER_GERMANY_BONUS, amount: 20, cityIds: ['city.de.berlin', 'city.de.koln'] },
            undefined,
            playerName
        )
        expect(richer.terms).toBe('$20')
        expect(richer.rule).toMatch(
            /^\$20 to the first player whose placement connects Berlin and Köln /
        )

        const intercolonial = connectionDescription(
            { ...INTERCOLONIAL_BONUS, amount: 9 },
            undefined,
            playerName
        )
        expect(intercolonial.rule).toMatch(/^\$9 to the first player /)

        const line = transcontinentalDescription(
            { ...TRANSCONTINENTAL_BONUS, cityHexAmount: 15, otherHexAmount: 6 },
            'map.usa',
            undefined,
            playerName
        )
        expect(line.terms).toBe('$15 / $6')
        expect(line.rule).toMatch(/^\$15 to the first player /)
        expect(line.rule).toContain('; $6 if the line changes railroad elsewhere.')
        expect(line.status).toBe(
            'Open: while you build, a hex that would complete a line shows $15 or $6.'
        )
    })

    it.each<MapId>(['map.au', 'map.fr'])(
        'has no chip and no description on %s, which prints neither bonus',
        (mapId) => {
            expect(connectionChip(mapId, undefined)).toBeUndefined()
            expect(turnLineBonusDescription({ mapId }, playerName)).toBeUndefined()
        }
    )
})
