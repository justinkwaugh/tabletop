import { describe, expect, it } from 'vitest'
import { HydratedPlayFacedownAdviser } from '../actions/playFacedownAdviser.js'
import { HydratedSearchResolve, SearchPlay } from '../actions/searchResolve.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import {
    DANA,
    FOREST_TEMPLE,
    PLAINS_SLOT,
    RHYS,
    STONES_SLOT,
    WOLVES,
    edificeTable
} from '../testing/edifices.js'
import { reasonCannotPlaceCard } from '../util/cardPlay.js'
import { forestTempleKeepsSite } from '../util/persistent.js'
import './index.js'

const RANGERS = 'denizen.beast.rangers'
const ELDERS = 'denizen.nomad.elders'
const BANDIT_CROWN = 'relic.bandit-crown'
const RIVER_SLOT = 'c2'
const BARRED = 'Ruined Temple: enemies of its ruler cannot play beast cards faceup'

/** Dana, the Chancellor, rules the Plains with Ruined Temple (or Forest Temple when `ruined` is false). */
function templeTable(
    ruined = true,
    over: Record<string, Record<string, unknown>> = {}
): HydratedOathGameState {
    return edificeTable(over, {}, { plains: FOREST_TEMPLE, ruined })
}

function faceupAdviser(s: HydratedOathGameState, playerId: string, cardId: string) {
    return reasonCannotPlaceCard(s, playerId, cardId, SearchPlay.Adviser, { faceUp: true })
}

function toSite(s: HydratedOathGameState, playerId: string, cardId: string) {
    return reasonCannotPlaceCard(s, playerId, cardId, SearchPlay.Site)
}

describe('Ruined Temple — "Enemies of Ruined Temple\'s ruler cannot play [beast] cards faceup"', () => {
    it('an enemy of its ruler cannot play a beast card to their site or as a faceup adviser', () => {
        const s = templeTable()
        s.getPlayerState(RHYS).siteId = RIVER_SLOT
        expect(toSite(s, RHYS, RANGERS)).toBe(BARRED)
        expect(faceupAdviser(s, RHYS, RANGERS)).toBe(BARRED)
    })

    it('leaves a facedown adviser, a card of another suit, and the ruler themselves free (5.1.4.II)', () => {
        const s = templeTable()
        s.getPlayerState(RHYS).siteId = RIVER_SLOT
        expect(
            reasonCannotPlaceCard(s, RHYS, RANGERS, SearchPlay.Adviser, { faceUp: false })
        ).toBeUndefined()
        expect(faceupAdviser(s, RHYS, ELDERS)).toBeUndefined()
        expect(toSite(s, RHYS, ELDERS)).toBeUndefined()
        expect(faceupAdviser(s, DANA, RANGERS)).toBeUndefined()
    })

    it('binds no Citizen of a Chancellor who rules it (10.7)', () => {
        const s = templeTable(true, { [RHYS]: { status: PlayerStatus.Citizen } })
        expect(faceupAdviser(s, RHYS, RANGERS)).toBeUndefined()
    })

    it('a drawn beast card the enemy cannot play faceup may go facedown or be discarded (Gossip’s Q&A alike)', () => {
        const s = templeTable()
        s.getPlayerState(RHYS).setHand([RANGERS])
        const choice = { keptCardId: RANGERS, discardOrder: [] }
        expect(
            HydratedSearchResolve.reasonCannotResolve(s, RHYS, {
                ...choice,
                play: SearchPlay.Adviser,
                faceUp: true
            })
        ).toBe(BARRED)
        expect(
            HydratedSearchResolve.reasonCannotResolve(s, RHYS, {
                ...choice,
                play: SearchPlay.Adviser,
                faceUp: false
            })
        ).toBeUndefined()
        expect(
            HydratedSearchResolve.reasonCannotResolve(s, RHYS, {
                ...choice,
                play: SearchPlay.Discard
            })
        ).toBeUndefined()
    })

    it('R-6.1 — an enemy’s facedown beast adviser cannot be flipped faceup', () => {
        const s = templeTable(true, {
            [RHYS]: { advisers: [{ faceUp: false }], adviserIds: [RANGERS] }
        })
        expect(
            HydratedPlayFacedownAdviser.reasonCannotPlay(s, RHYS, {
                cardId: RANGERS,
                play: SearchPlay.Adviser
            })
        ).toBe(BARRED)
    })

    it('at a site the bandits rule, every player is its enemy (Tome Guardians’ and Gossip’s Q&A)', () => {
        const s = templeTable()
        s.warbandsBySite = {}
        expect(faceupAdviser(s, DANA, RANGERS)).toBe(BARRED)
        expect(faceupAdviser(s, RHYS, RANGERS)).toBe(BARRED)
    })

    it('with the Bandit Crown, its holder rules the bandit Temple, so only their enemies are bound', () => {
        const s = templeTable(true, { [RHYS]: { relicIds: [BANDIT_CROWN] } })
        s.warbandsBySite = {}
        expect(faceupAdviser(s, RHYS, RANGERS)).toBeUndefined()
        expect(faceupAdviser(s, DANA, RANGERS)).toBe(BARRED)
    })

    it('Forest Temple, the intact side, bars nothing', () => {
        const s = templeTable(false)
        expect(faceupAdviser(s, RHYS, RANGERS)).toBeUndefined()
    })
})

describe('Forest Temple — "In the Chronicle, do not discard sites with any [beast] cards"', () => {
    it('keeps a site with a beast denizen, and its own site, where the Temple is itself a beast card', () => {
        const s = templeTable(false)
        expect(forestTempleKeepsSite(s, PLAINS_SLOT)).toBe(true)
        s.denizensBySite[PLAINS_SLOT] = [FOREST_TEMPLE]
        expect(forestTempleKeepsSite(s, PLAINS_SLOT)).toBe(true)
    })

    it('keeps no site without a beast card: a ruin shows no suit', () => {
        const s = templeTable(false)
        expect(forestTempleKeepsSite(s, STONES_SLOT)).toBe(false)
        s.denizensBySite[STONES_SLOT] = [...s.denizensAt(STONES_SLOT), WOLVES]
        expect(forestTempleKeepsSite(s, STONES_SLOT)).toBe(true)
    })

    it('holds whoever rules the Temple or the site (its Q&A), the bandits included', () => {
        const s = templeTable(false)
        s.warbandsBySite = { [STONES_SLOT]: { [IMPERIAL_WARBANDS]: 1 } }
        s.denizensBySite[STONES_SLOT] = [...s.denizensAt(STONES_SLOT), WOLVES]
        expect(forestTempleKeepsSite(s, PLAINS_SLOT)).toBe(true)
        expect(forestTempleKeepsSite(s, STONES_SLOT)).toBe(true)
    })

    it('Ruined Temple, the ruined side, keeps nothing', () => {
        const s = templeTable(true)
        expect(forestTempleKeepsSite(s, PLAINS_SLOT)).toBe(false)
    })
})
