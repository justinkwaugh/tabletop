import { describe, expect, it } from 'vitest'
import { testPlayer, testState, testVaultWithRelics } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import type { OathVault } from '../model/vault.js'
import type { HydratedOathGameState, OathProjectedState } from '../model/gameState.js'
import { HydratedPeek, Peek, PeekTargetKind } from './peek.js'
import { HydratedRecover, Recover, RecoverTargetKind } from './recover.js'
import { HydratedTravel, Travel } from './travel.js'
import { Campaign, HydratedCampaign } from './campaign.js'
import { CampaignTargetKind } from '../model/campaign.js'
import { Banner, Suit } from '../model/oathEnums.js'
import { HydratedMuster, Muster } from './muster.js'

/** R-X.3 — `revealsInfo` is the only field the platform's undo reads. */

const RELIC_A = 'relic.unnamed-1'
const RELIC_B = 'relic.unnamed-2'

function board(overrides: Partial<OathProjectedState> = {}) {
    const state = testState(
        [
            testPlayer({ playerId: 'p1', siteId: 'c1', supply: 6, secrets: 3, favor: 5 }),
            testPlayer({ playerId: 'p2', siteId: 'c2', supply: 6, secrets: 3, favor: 5 })
        ],
        {
            relicsBySite: { c1: [{ slotId: 'c1-r1' }], c2: [{ slotId: 'c2-r1' }] },
            ...overrides
        }
    )
    const vault = testVaultWithRelics({})
    vault.relicFacedown['c1-r1'] = RELIC_A
    vault.relicFacedown['c2-r1'] = RELIC_B
    return { state, vault }
}

function serverApply<
    T,
    H extends { apply: (s: HydratedOathGameState) => void; revealsInfo?: boolean }
>(state: HydratedOathGameState, vault: OathVault, raw: T, Hydrated: new (a: T) => H) {
    state.vault = vault
    const hydrated = new Hydrated(raw)
    hydrated.apply(state)
    return hydrated
}

describe('revealsInfo — R-X.3, the field undo is derived from', () => {
    it('R-X.3(a) — an action that advanced the PRNG must set revealsInfo', () => {
        const { state, vault } = board()
        state.getPlayerState('p1').warbandsOnBoard = { p1: 3 }
        state.getPlayerState('p2').siteId = 'c1'
        const prngBefore = state.prng.invocations
        const raw = buildAction(Campaign, {
            playerId: 'p1',
            defender: { kind: 'player', playerId: 'p2' },
            targets: [{ kind: CampaignTargetKind.PawnAndFavor }],
            attackDice: 2,
        })
        const action = serverApply(state, vault, raw, HydratedCampaign)

        expect(state.prng.invocations).toBeGreaterThan(prngBefore)
        expect(action.revealsInfo).toBe(true)
    })

    it('R-X.3(b), R-6.3 — a first Peek reveals from the vault and is not undoable', () => {
        const { state, vault } = board()
        const raw = buildAction(Peek, {
            playerId: 'p1',
            target: { kind: PeekTargetKind.SiteRelic, slotId: 'c1-r1' }
        })
        const action = serverApply(state, vault, raw, HydratedPeek)
        expect(action.revealsInfo).toBe(true)
    })

    it('R-X.3(b), R-6.3 — peeking an already-public relic does NOT block undo', () => {
        const { state, vault } = board()
        const target = { kind: PeekTargetKind.SiteRelic as const, slotId: 'c1-r1' }

        const first = buildAction(Peek, {
            playerId: 'p1',
            target
        })
        expect(serverApply(state, vault, first, HydratedPeek).revealsInfo).toBe(true)

        const second = buildAction(Peek, {
            playerId: 'p1',
            target
        })
        expect(serverApply(state, vault, second, HydratedPeek).revealsInfo).toBe(false)
    })

    it('R-X.3(b), R-5.4 — recovering a relic blocks undo, recovering a banner does not', () => {
        // R-2.8.4 — a Recover pays the cost its site prints; Buried Giant's is one burnt secret.
        const relicBoard = board({ siteCards: { c1: 'site.buried-giant', c2: 'site.river' } })
        const relicRaw = buildAction(Recover, {
            playerId: 'p1',
            target: { kind: RecoverTargetKind.Relic, slotId: 'c1-r1' }
        })
        const relic = serverApply(
            relicBoard.state,
            relicBoard.vault,
            relicRaw,
            HydratedRecover
        )
        expect(relic.revealsInfo).toBe(true)

        const bannerBoard = board({
            banners: {
                [Banner.PeoplesFavor]: { value: 1, mobSide: false },
                [Banner.DarkestSecret]: { value: 1 }
            }
        })
        // R-5.4.2 — the payment must exceed the banner's value.
        const bannerRaw = buildAction(Recover, {
            playerId: 'p1',
            target: { kind: RecoverTargetKind.Banner, banner: Banner.PeoplesFavor },
            amountPaid: 2,
            // R-5.4.4 — the player names the bank the displaced favor leaves from.
            redistributeFrom: Suit.Discord
        })
        const banner = serverApply(
            bannerBoard.state,
            bannerBoard.vault,
            bannerRaw,
            HydratedRecover
        )
        expect(banner.revealsInfo).toBeFalsy()
    })

    it('R-X.3, R-5.6 — travelling to a faceup site leaves undo open', () => {
        const { state, vault } = board({
            siteCards: { c1: 'site.mine', c2: 'site.river', p1: 'site.plains' }
        })
        const raw = buildAction(Travel, {
            playerId: 'p1',
            siteId: 'p1'
        })
        const action = serverApply(state, vault, raw, HydratedTravel)
        expect(action.revealsInfo).toBeFalsy()
    })

    it('R-X.3 — a submitted revealsInfo on an action that reveals nothing is overwritten', () => {
        const state = testState([testPlayer({ siteId: 'c1', favor: 2 })], {
            denizensBySite: { c1: ['card-a'] }
        })
        const muster = new HydratedMuster(
            buildAction(Muster, { playerId: 'p1', cardId: 'card-a', revealsInfo: true })
        )
        muster.apply(state)
        expect(muster.revealsInfo).toBe(false)
    })

    it('R-X.3 — a submitted revealsInfo on a banner Recover is overwritten', () => {
        const { state, vault } = board({
            banners: {
                [Banner.PeoplesFavor]: { value: 1, mobSide: false },
                [Banner.DarkestSecret]: { value: 1 }
            }
        })
        const raw = buildAction(Recover, {
            playerId: 'p1',
            target: { kind: RecoverTargetKind.Banner, banner: Banner.PeoplesFavor },
            amountPaid: 2,
            redistributeFrom: Suit.Discord,
            revealsInfo: true
        })
        expect(serverApply(state, vault, raw, HydratedRecover).revealsInfo).toBe(false)
    })
})
