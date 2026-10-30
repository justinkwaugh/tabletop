import { describe, expect, it } from 'vitest'
import { Banner, CampaignTargetKind, Region, type HydratedOathGameState } from '@tabletop/oath'
import {
    DANA,
    GREAT_SPIRE,
    HALL_OF_DEBATE,
    PLAINS_SLOT,
    RHYS,
    edificeTable,
    fillDispossessed,
    openTurn,
    testBanners
} from '@tabletop/oath/testing'
import { actionCardLine } from './actionCards.js'
import { canToggleTarget } from './campaignDraft.js'
import { listedActionPowers } from './phaseDrafts.js'
import { recoverRows } from './recoverRows.js'

const PEOPLES_FAVOR = { kind: CampaignTargetKind.Banner, banner: Banner.PeoplesFavor } as const

/** Rhys on turn at the Plains, with Dana (who holds the People's Favor) and the Hall there. */
function rhysTable(ruined = false): HydratedOathGameState {
    const state = edificeTable(
        { [RHYS]: { warbandsOnBoard: { [RHYS]: 4 }, favor: 6 } },
        { banners: testBanners({ [Banner.PeoplesFavor]: DANA }) },
        { ruined }
    )
    openTurn(state, RHYS)
    return state
}

describe('Hall of Debate — the People’s Favor is never a Campaign target, and Recover still offers it', () => {
    it('is not offered as a target while Hall of Debate is up, with no line saying why', () => {
        const defender = { kind: 'player', playerId: DANA } as const
        // R-5.5.1 — the site the defender rules is targeted first.
        const plains = [{ kind: CampaignTargetKind.Site, siteId: PLAINS_SLOT } as const]
        expect(canToggleTarget(rhysTable(), RHYS, defender, plains, PEOPLES_FAVOR)).toBe(false)
        expect(canToggleTarget(rhysTable(true), RHYS, defender, plains, PEOPLES_FAVOR)).toBe(true)
    })

    it('Recover still lists it (R-5.4.1-H1)', () => {
        const rows = recoverRows(rhysTable(), RHYS, [])
        expect(rows.banners.map((row) => row.banner)).toContain(Banner.PeoplesFavor)
    })
})

describe('Fallen Spire in Use a power', () => {
    /** Dana at the Plains, which holds Fallen Spire; the Cradle pile and the Dispossessed as given. */
    function fallenTable(pile: number, dispossessed: number) {
        const state = edificeTable({}, {}, { plains: GREAT_SPIRE, ruined: true })
        fillDispossessed(
            state,
            ['denizen.discord.naysayers', 'denizen.hearth.ballot-box'].slice(0, dispossessed)
        )
        state.discardPileCounts[Region.Cradle] = pile
        return state
    }
    const listed = (state: HydratedOathGameState) =>
        listedActionPowers(state, DANA).filter((use) => use.cardId === GREAT_SPIRE)

    it('is listed while the pile and the Dispossessed both hold cards, its counts capped by both', () => {
        const [use] = listed(fallenTable(4, 2))
        expect(use?.choices[0]?.options.map((option) => ('n' in option ? option.n : 0))).toEqual([
            1, 2
        ])
    })

    it('is hidden when either is empty: no count can be picked', () => {
        expect(listed(fallenTable(0, 2))).toEqual([])
        expect(listed(fallenTable(4, 0))).toEqual([])
    })
})

describe('Great Spire’s line in the Cards rows', () => {
    it('says what it gives, and that the Dispossessed is empty when it is', () => {
        expect(actionCardLine(GREAT_SPIRE, { dispossessedCount: 2 })).toBe(
            'swap with the Dispossessed'
        )
        expect(actionCardLine(GREAT_SPIRE, { dispossessedCount: 0 })).toBe(
            'the Dispossessed is empty'
        )
        expect(actionCardLine(GREAT_SPIRE)).toBe('swap with the Dispossessed')
    })
})

describe('the Hall of Debate fixture', () => {
    it('stands intact at the Plains', () => {
        expect(rhysTable().isRuined(HALL_OF_DEBATE)).toBe(false)
    })
})
