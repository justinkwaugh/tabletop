import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import {
    Banner,
    CampaignTargetKind,
    HydratedOathGameState,
    type CampaignTarget
} from '@tabletop/oath'
import { testPlayer, testState } from '@tabletop/oath/testing'
import { bannerName, cardName, siteName } from './names.js'
import { spoilsSummary } from './spoils.js'

const ME = 'me'
const FOE = 'foe'

function table() {
    return new HydratedOathGameState(
        testState([
            testPlayer({ playerId: ME, color: Color.Red, siteId: 'c1' }),
            testPlayer({ playerId: FOE, color: Color.Blue, siteId: 'c1' })
        ])
    )
}

/** R-5.5.7 — the spoils, listed in the order they resolve; the History says the rest. */
describe('the spoils list', () => {
    it('names each taken site with the warbands placed there, the real 0 included', () => {
        const state = table()
        const targets: CampaignTarget[] = [
            { kind: CampaignTargetKind.Site, siteId: 'c1' },
            { kind: CampaignTargetKind.Site, siteId: 'c2' },
            { kind: CampaignTargetKind.Site, siteId: 'h1' }
        ]
        expect(spoilsSummary(state, targets, { c1: 2, c2: 1 }, FOE)).toEqual([
            { kind: 'text', text: `${siteName(state, 'c1')} · 2 warbands` },
            { kind: 'text', text: `${siteName(state, 'c2')} · 1 warband` },
            { kind: 'text', text: `${siteName(state, 'h1')} · 0 warbands` }
        ])
    })

    it('names relics and banners by their printed names', () => {
        const targets: CampaignTarget[] = [
            { kind: CampaignTargetKind.Relic, cardId: 'relic.map' },
            { kind: CampaignTargetKind.Banner, banner: Banner.PeoplesFavor }
        ]
        expect(spoilsSummary(table(), targets, {}, FOE)).toEqual([
            { kind: 'text', text: cardName('relic.map') },
            { kind: 'text', text: `The ${bannerName(Banner.PeoplesFavor)}` }
        ])
    })

    it("names the defender's pawn and favor by the defender, for a colour chip", () => {
        const targets: CampaignTarget[] = [{ kind: CampaignTargetKind.PawnAndFavor }]
        expect(spoilsSummary(table(), targets, {}, FOE)).toEqual([{ kind: 'pawn', playerId: FOE }])
    })

    it('lists nothing for a relic taken at a site: the relics row shows it', () => {
        const targets: CampaignTarget[] = [{ kind: CampaignTargetKind.SiteRelic, slotId: 'c1-r1' }]
        expect(spoilsSummary(table(), targets, {}, FOE)).toEqual([])
    })
})
