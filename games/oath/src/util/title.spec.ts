import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { Banner, OathType } from '../model/oathEnums.js'
import { testBanners } from '../testing/fixture.js'
import { MachineState } from '../definition/states.js'
import {
    applyForcedTitleChanges,
    reasonCannotResolveOathkeeperChoice,
    resolveOathkeeperChoice,
    evaluateTitle,
    flipToUsurperIfExileHolds,
    grantTitle,
    vacateTitle
} from './title.js'
import type { OathGameState } from '../model/gameState.js'
import type { OathPlayerState } from '../model/playerState.js'
import { CHANCELLOR, CITIZEN, EXILE, OTHER_EXILE, statusTable } from '../testing/tables.js'

function table(
    overrides: Partial<OathGameState> = {},
    playerOverrides: Record<string, Partial<OathPlayerState>> = {}
) {
    return statusTable({ oathType: OathType.ThePeople, ...overrides }, playerOverrides)
}

describe('R-2.11 — the title follows the goal', () => {
    it('moves to the sole qualifier when the holder no longer qualifies', () => {
        const state = table({
            oathkeeperPlayerId: EXILE,
            banners: testBanners({ [Banner.PeoplesFavor]: OTHER_EXILE })
        })
        expect(evaluateTitle(state)).toEqual({ kind: 'moves', toPlayerId: OTHER_EXILE })

        applyForcedTitleChanges(state, MachineState.ActPhase)
        expect(state.oathkeeperPlayerId).toBe(OTHER_EXILE)
    })

    it('leaves it alone when the holder still qualifies', () => {
        const state = table({
            oathkeeperPlayerId: EXILE,
            banners: testBanners({ [Banner.PeoplesFavor]: EXILE })
        })
        expect(evaluateTitle(state)).toEqual({ kind: 'unchanged' })
    })

    it('takes it to a player who qualifies while nobody holds it', () => {
        const state = table({ banners: testBanners({ [Banner.PeoplesFavor]: CITIZEN }) })
        applyForcedTitleChanges(state, MachineState.ActPhase)
        expect(state.oathkeeperPlayerId).toBe(CITIZEN)
    })
})

describe('R-2.11.b favours the incumbent', () => {
    it('keeps the title with a holder who is merely tied (R-2.11.b)', () => {
        const state = table({
            oathType: OathType.Supremacy,
            oathkeeperPlayerId: EXILE,
            warbandsBySite: { c1: { [Color.Red]: 1 }, c2: { [Color.Yellow]: 1 } }
        })
        expect(evaluateTitle(state)).toEqual({ kind: 'unchanged' })

        applyForcedTitleChanges(state, MachineState.ActPhase)
        expect(state.oathkeeperPlayerId).toBe(EXILE)
    })

    it('reports a choice — and moves nothing — when the holder drops out and two qualify', () => {
        const state = contested()
        expect(evaluateTitle(state)).toEqual({
            kind: 'choice',
            holderPlayerId: CHANCELLOR,
            candidates: [EXILE, OTHER_EXILE]
        })

        applyForcedTitleChanges(state, MachineState.ActPhase)
        expect(state.oathkeeperPlayerId).toBe(CHANCELLOR)
        expect(state.pendingOathkeeperChoice).toEqual({
            holderPlayerId: CHANCELLOR,
            candidates: [EXILE, OTHER_EXILE],
            resumeMachineState: MachineState.ActPhase
        })
    })
})

function contested() {
    return table({
        oathType: OathType.Supremacy,
        oathkeeperPlayerId: CHANCELLOR,
        warbandsBySite: { c1: { [Color.Red]: 1 }, c2: { [Color.Yellow]: 1 } }
    })
}

describe('R-2.11.b — the outgoing holder chooses from the tied players', () => {
    it('hands the title to the chosen player and clears the pending choice', () => {
        const state = contested()
        applyForcedTitleChanges(state, MachineState.ActPhase)

        const resume = resolveOathkeeperChoice(state, CHANCELLOR, OTHER_EXILE)

        expect(state.oathkeeperPlayerId).toBe(OTHER_EXILE)
        expect(state.pendingOathkeeperChoice).toBeUndefined()
        expect(resume).toBe(MachineState.ActPhase)
    })

    it('flips the title to its Oathkeeper side on the way (R-2.11.c)', () => {
        const state = contested()
        state.oathkeeperIsUsurper = true
        applyForcedTitleChanges(state, MachineState.ActPhase)
        resolveOathkeeperChoice(state, CHANCELLOR, EXILE)
        expect(state.oathkeeperIsUsurper).toBe(false)
    })

    it('refuses a chooser who is not the outgoing holder (R-X.1)', () => {
        const state = contested()
        applyForcedTitleChanges(state, MachineState.ActPhase)
        expect(reasonCannotResolveOathkeeperChoice(state, EXILE, EXILE)).toMatch(
            /belongs to chancellor/
        )
    })

    it('refuses a player who is not among the tied (R-2.11.b, R-X.1)', () => {
        const state = contested()
        applyForcedTitleChanges(state, MachineState.ActPhase)
        expect(reasonCannotResolveOathkeeperChoice(state, CHANCELLOR, CITIZEN)).toMatch(
            /not one of the tied players/
        )
        expect(() => resolveOathkeeperChoice(state, CHANCELLOR, CITIZEN)).toThrow()
    })

    it('refuses when no choice is pending', () => {
        const state = table()
        expect(reasonCannotResolveOathkeeperChoice(state, CHANCELLOR, EXILE)).toMatch(
            /no Oathkeeper choice is pending/
        )
    })

    it('does not reopen or overwrite a choice already pending', () => {
        const state = contested()
        applyForcedTitleChanges(state, MachineState.ActPhase)
        applyForcedTitleChanges(state, MachineState.RestPhase)
        expect(state.pendingOathkeeperChoice?.resumeMachineState).toBe(MachineState.ActPhase)
    })

    it('resumes a Campaign where it was interrupted (R-5.5.5, R-2.11-H1)', () => {
        const state = contested()
        applyForcedTitleChanges(state, MachineState.CampaignSacrifice)
        expect(resolveOathkeeperChoice(state, CHANCELLOR, EXILE)).toBe(
            MachineState.CampaignSacrifice
        )
    })
})

describe('R-2.11 — nobody meets the goal', () => {
    it('vacates the title when the goal-holder set empties', () => {
        const state = table({ oathkeeperPlayerId: EXILE, oathkeeperIsUsurper: true })
        expect(evaluateTitle(state)).toEqual({ kind: 'vacated' })

        applyForcedTitleChanges(state, MachineState.ActPhase)
        expect(state.oathkeeperPlayerId).toBeUndefined()
        // R-2.11.c
        expect(state.oathkeeperIsUsurper).toBe(false)
    })

    it('is a no-op when the title is already unheld', () => {
        const state = table()
        expect(evaluateTitle(state)).toEqual({ kind: 'unchanged' })
    })
})

describe('R-2.11.c — taking the title flips it to its Oathkeeper side', () => {
    it('clears the Usurper side when the title changes hands', () => {
        const state = table({
            oathkeeperPlayerId: EXILE,
            oathkeeperIsUsurper: true,
            banners: testBanners({ [Banner.PeoplesFavor]: OTHER_EXILE })
        })
        applyForcedTitleChanges(state, MachineState.ActPhase)

        expect(state.oathkeeperPlayerId).toBe(OTHER_EXILE)
        expect(state.oathkeeperIsUsurper).toBe(false)
    })

    it('clears it on a direct grant too', () => {
        const state = table({ oathkeeperPlayerId: EXILE, oathkeeperIsUsurper: true })
        grantTitle(state, CITIZEN)
        expect(state.oathkeeperPlayerId).toBe(CITIZEN)
        expect(state.oathkeeperIsUsurper).toBe(false)

        vacateTitle(state)
        expect(state.oathkeeperPlayerId).toBeUndefined()
    })
})

describe('R-4.1.3 — the Usurper flip', () => {
    it('flips for an Exile holding the title', () => {
        const state = table({ oathkeeperPlayerId: EXILE })
        expect(flipToUsurperIfExileHolds(state, EXILE)).toBe(true)
        expect(state.oathkeeperIsUsurper).toBe(true)
    })

    it('does not flip for the Chancellor or a Citizen (R-2.11.a)', () => {
        const chancellor = table({ oathkeeperPlayerId: CHANCELLOR })
        expect(flipToUsurperIfExileHolds(chancellor, CHANCELLOR)).toBe(false)
        expect(chancellor.oathkeeperIsUsurper).toBeFalsy()

        const citizen = table({ oathkeeperPlayerId: CITIZEN })
        expect(flipToUsurperIfExileHolds(citizen, CITIZEN)).toBe(false)
        expect(citizen.oathkeeperIsUsurper).toBeFalsy()
    })

    it('does not flip for an Exile who does not hold it', () => {
        const state = table({ oathkeeperPlayerId: EXILE })
        expect(flipToUsurperIfExileHolds(state, OTHER_EXILE)).toBe(false)
        expect(state.oathkeeperIsUsurper).toBeFalsy()
    })

    it('is idempotent — a second Wake does not re-flip', () => {
        const state = table({ oathkeeperPlayerId: EXILE, oathkeeperIsUsurper: true })
        expect(flipToUsurperIfExileHolds(state, EXILE)).toBe(false)
        expect(state.oathkeeperIsUsurper).toBe(true)
    })

    it('a title that changed hands starts again on its Oathkeeper side (R-2.11.c + R-4.1.3)', () => {
        const state = table({
            oathkeeperPlayerId: EXILE,
            banners: testBanners({ [Banner.PeoplesFavor]: EXILE })
        })
        flipToUsurperIfExileHolds(state, EXILE)
        expect(state.oathkeeperIsUsurper).toBe(true)

        state.banners[Banner.PeoplesFavor].holderPlayerId = OTHER_EXILE
        applyForcedTitleChanges(state, MachineState.ActPhase)
        expect(state.oathkeeperPlayerId).toBe(OTHER_EXILE)

        state.banners[Banner.PeoplesFavor].holderPlayerId = EXILE
        applyForcedTitleChanges(state, MachineState.ActPhase)
        expect(state.oathkeeperPlayerId).toBe(EXILE)
        expect(state.oathkeeperIsUsurper).toBe(false)
    })
})
