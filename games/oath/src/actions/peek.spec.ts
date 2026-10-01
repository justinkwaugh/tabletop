import { describe, expect, it } from 'vitest'
import { buildAction } from '../testing/actions.js'
import { HydratedPeek, Peek, PeekTargetKind } from './peek.js'
import { testPlayer, testState, testVaultWithRelics } from '../testing/fixture.js'
import type { OathVault } from '../model/vault.js'
import type { HydratedOathGameState } from '../model/gameState.js'
import { GRAND_SCEPTER_ID } from '../data/relics.js'
import { teachReliquaryToScepterHolder } from '../util/hiddenInputs.js'

const RELIC_A = 'relic.unnamed-1'
const RELIC_B = 'relic.unnamed-2'

function serverPeek(
    state: HydratedOathGameState,
    vault: OathVault,
    playerId: string,
    target: Peek['target']
) {
    const action = buildAction(Peek, { playerId, target })
    state.vault = vault
    const hydrated = new HydratedPeek(action)
    hydrated.apply(state)
    return hydrated
}

function siteTarget(slotId: string) {
    return { kind: PeekTargetKind.SiteRelic as const, slotId }
}

function board(playerOverrides: Record<string, unknown> = {}) {
    const state = testState(
        [
            testPlayer({ playerId: 'p1', siteId: 'c1', ...playerOverrides }),
            testPlayer({ playerId: 'p2', siteId: 'c2' })
        ],
        {
            relicsBySite: { c1: [{ slotId: 'slot-1' }], c2: [{ slotId: 'slot-2' }] },
            reliquary: [{ slotId: 'rel-1' }]
        }
    )
    const vault = testVaultWithRelics({})
    vault.relicFacedown['slot-1'] = RELIC_A
    vault.relicFacedown['slot-2'] = RELIC_B
    vault.relicFacedown['rel-1'] = GRAND_SCEPTER_ID
    return { state, vault }
}

describe('Peek at a Relic (R-6.3)', () => {
    it('looks at a facedown relic at your site and records who has seen it (R-10.17)', () => {
        const { state, vault } = board()
        const action = serverPeek(state, vault, 'p1', siteTarget('slot-1'))

        expect(state.relicSlotsAt('c1')).toEqual([{ slotId: 'slot-1' }])
        expect(state.getPlayerState('p1').peekedRelicSlotIds).toEqual(['slot-1'])
        expect(state.getPlayerState('p1').peekedRelics).toEqual({ 'slot-1': RELIC_A })
        expect(action.metadata).toEqual({ relicCardId: RELIC_A, revealedFromVault: true })
    })

    it('costs no Supply and moves no piece (R-6)', () => {
        const { state, vault } = board({ supply: 5 })
        serverPeek(state, vault, 'p1', siteTarget('slot-1'))

        const p = state.getPlayerState('p1')
        expect(p.supply).toBe(5)
        expect(p.supplySpentThisTurn).toBe(0)
        expect(p.relicIds).toEqual([])
    })

    it('reads the identity from the vault, which keeps it, so the action is not undoable (R-X.3, R-9.4)', () => {
        const { state, vault } = board()
        const action = serverPeek(state, vault, 'p1', siteTarget('slot-1'))

        expect(vault.relicFacedown['slot-1']).toBe(RELIC_A)
        expect(action.revealsInfo).toBe(true)
    })

    it('refuses a relic at another player’s site', () => {
        const { state, vault } = board()
        expect(() => serverPeek(state, vault, 'p1', siteTarget('slot-2'))).toThrow(
            /not at your site, and you have not peeked at it before/
        )
    })

    it('refuses a slot that is at no site', () => {
        const { state, vault } = board()
        expect(() => serverPeek(state, vault, 'p1', siteTarget('slot-nowhere'))).toThrow(
            /not a relic slot at any site/
        )
    })

    it('lets you peek again from anywhere once you have seen that relic', () => {
        const { state, vault } = board()
        serverPeek(state, vault, 'p1', siteTarget('slot-1'))

        state.getPlayerState('p1').siteId = 'h3'
        expect(
            HydratedPeek.reasonCannotPeek(state, 'p1', siteTarget('slot-1'))
        ).toBeUndefined()

        expect(HydratedPeek.reasonCannotPeek(state, 'p1', siteTarget('slot-2'))).toMatch(
            /not at your site/
        )
    })

    it('a re-peek moves nothing, so it stays undoable (R-X.3)', () => {
        const { state, vault } = board()
        serverPeek(state, vault, 'p1', siteTarget('slot-1'))
        const again = serverPeek(state, vault, 'p1', siteTarget('slot-1'))

        expect(again.revealsInfo).toBe(false)
        expect(again.metadata).toEqual({ relicCardId: RELIC_A, revealedFromVault: false })
        expect(state.getPlayerState('p1').peekedRelicSlotIds).toEqual(['slot-1'])
    })

    it('records the peek per player, and names the relic in no public field (R-9.4)', () => {
        const { state, vault } = board()
        state.getPlayerState('p2').siteId = 'c1'
        serverPeek(state, vault, 'p1', siteTarget('slot-1'))

        expect(state.relicSlotsAt('c1')[0]).toEqual({ slotId: 'slot-1' })
        expect(state.getPlayerState('p2').peekedRelicSlotIds).toEqual([])

        serverPeek(state, vault, 'p2', siteTarget('slot-1'))
        expect(state.getPlayerState('p2').peekedRelics).toEqual({ 'slot-1': RELIC_A })
    })

    it('offers only the relics at your site', () => {
        const { state } = board()
        expect(HydratedPeek.legalTargets(state, 'p1')).toEqual([siteTarget('slot-1')])
        expect(HydratedPeek.canDoPeek(state, 'p1')).toBe(true)
    })
})

describe('The Reliquary is the Scepter holder\'s to know (R-6.4-H1)', () => {
    function taught(state: HydratedOathGameState, vault: OathVault) {
        state.vault = vault
        return teachReliquaryToScepterHolder(state)
    }

    it('no Peek targets the Reliquary, even for the Scepter\'s holder', () => {
        const { state } = board({ relicIds: [GRAND_SCEPTER_ID] })
        expect(HydratedPeek.legalTargets(state, 'p1')).toEqual([siteTarget('slot-1')])
    })

    it('the holder learns every Reliquary relic once, owner-known, leaving it facedown', () => {
        const { state, vault } = board({ relicIds: [GRAND_SCEPTER_ID] })
        expect(taught(state, vault)).toBe(true)
        expect(state.getPlayerState('p1').peekedRelics).toEqual({ 'rel-1': GRAND_SCEPTER_ID })
        expect(state.reliquarySlots()).toEqual([{ slotId: 'rel-1' }])
        expect(taught(state, vault)).toBe(false)
    })

    it('is the Scepter\'s, not the Chancellor\'s seat\'s', () => {
        const { state, vault } = board({ relicIds: [GRAND_SCEPTER_ID] })
        expect(state.getPlayerState('p1').status).toBe('exile')
        taught(state, vault)
        expect(state.getPlayerState('p2').peekedRelicSlotIds).toEqual([])
    })

    it('a new holder learns them all at once, and the former holder keeps what they saw', () => {
        const { state, vault } = board({ relicIds: [GRAND_SCEPTER_ID] })
        taught(state, vault)
        state.getPlayerState('p1').relicIds = []
        state.getPlayerState('p2').relicIds = [GRAND_SCEPTER_ID]
        expect(taught(state, vault)).toBe(true)
        expect(state.getPlayerState('p2').peekedRelics).toEqual({ 'rel-1': GRAND_SCEPTER_ID })
        expect(state.getPlayerState('p1').peekedRelics).toEqual({ 'rel-1': GRAND_SCEPTER_ID })
    })

    it('with the Scepter held by no one, no one learns', () => {
        const { state, vault } = board()
        expect(taught(state, vault)).toBe(false)
        expect(state.getPlayerState('p1').peekedRelicSlotIds).toEqual([])
    })
})
