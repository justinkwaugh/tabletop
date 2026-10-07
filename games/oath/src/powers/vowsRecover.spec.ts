import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedRecover, Recover, RecoverTargetKind, isRecover } from '../actions/recover.js'
import { HydratedCampaign } from '../actions/campaign.js'
import { CampaignTargetKind } from '../model/campaign.js'
import { Banner, Suit } from '../model/oathEnums.js'
import { PowerQuestionKind } from '../model/question.js'
import { CONSPIRACY_ID } from '../data/visions.js'
import { testPlayer, testState, openTurn, withChancellor } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { modifierUse } from '../testing/choices.js'
import { RunMode, engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { INN } from '../testing/cards.js'
import { reasonCannotPlayConspiracy } from '../util/cardPlay.js'
import { askQuestion } from '../util/questions.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

const SILENCE = 'denizen.arcane.vow-of-silence'
const RENEWAL = 'denizen.discord.vow-of-renewal'
const TOME = 'denizen.order.tome-guardians'
const TONGUE = 'denizen.nomad.lost-tongue'
const CIRCLET = 'relic.circlet-of-command'
const MAGICIANS_CODE = 'denizen.arcane.magicians-code'
const PYTHON = 'denizen.beast.giant-python'
const SNEAK_ATTACK = 'denizen.discord.sneak-attack'
const WOLVES = 'denizen.beast.wolves'
const STORYTELLER = 'denizen.hearth.storyteller'
const RANGERS = 'denizen.beast.rangers'

const atRevision = OathRevision.CardFixes1
const beforeRevision = OathRevision.PlanCostsAndSearchPlays

/** `taker` is on turn at c1 beside `holder`, who rules c1 and holds both banners; the advisers match for the Conspiracy. */
function table(oathRevision: number, takerAdvisers: string[], holderAdvisers: string[] = [], over: Record<string, Record<string, unknown>> = {}, state: Record<string, unknown> = {}) {
    const adv = (cardIds: string[]) => cardIds.map((cardId) => ({ cardId, faceUp: true }))
    const s = testState(
        withChancellor([
            testPlayer({ playerId: 'taker', color: Color.Red, siteId: 'c1', favor: 6, secrets: 3, supply: 6, warbandsOnBoard: { taker: 4 }, warbandsInPersonalBank: { taker: 6 }, advisers: adv([INN, WOLVES, ...takerAdvisers]), ...over['taker'] }),
            testPlayer({ playerId: 'holder', color: Color.Blue, siteId: 'c1', favor: 4, secrets: 3, supply: 5, warbandsOnBoard: { holder: 2 }, warbandsInPersonalBank: { holder: 5 }, advisers: adv([STORYTELLER, RANGERS, ...holderAdvisers]), ...over['holder'] })
        ]),
        {
            oathRevision,
            denizensBySite: { c1: [], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { holder: 1 } },
            siteCards: { c1: 'site.plains', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' },
            banners: { [Banner.PeoplesFavor]: { value: 1, holderPlayerId: 'holder', mobSide: false }, [Banner.DarkestSecret]: { value: 1, holderPlayerId: 'holder' } },
            ...state
        }
    )
    openTurn(s, 'taker')
    return s
}

function recover(s: ReturnType<typeof table>, banner: Banner) {
    return HydratedRecover.reasonCannotRecover(s, 'taker', { target: { kind: RecoverTargetKind.Banner, banner }, amountPaid: 2, redistributeFrom: Suit.Discord })
}
function campaign(s: ReturnType<typeof table>, banner: Banner) {
    return HydratedCampaign.reasonCannotCampaign(s, 'taker', { defender: { kind: 'player', playerId: 'holder' }, targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }, { kind: CampaignTargetKind.Banner, banner }], attackDice: 2, plans: [] })
}
function conspiracy(s: ReturnType<typeof table>, banner: Banner) {
    return reasonCannotPlayConspiracy(s, 'taker', { keptCardId: CONSPIRACY_ID, conspiracy: { targetPlayerId: 'holder', take: { kind: 'banner', banner } } })
}

describe('R-10.23 — Vow of Silence and Vow of Renewal forbid a Recover, not a Seize', () => {
    for (const [vow, banner, name] of [[SILENCE, Banner.DarkestSecret, /Vow of Silence/], [RENEWAL, Banner.PeoplesFavor, /Vow of Renewal/]] as const) {
        it(`${banner}: its holder may target it in a Campaign and take it with the Conspiracy, but not recover it`, () => {
            const s = table(atRevision, [vow])
            expect(campaign(s, banner)).toBeUndefined()
            expect(conspiracy(s, banner)).toBeUndefined()
            expect(recover(s, banner)).toMatch(name)
        })

        it(`${banner}: a game stored before the revision keeps the vow on every take`, () => {
            const s = table(beforeRevision, [vow])
            expect(campaign(s, banner)).toMatch(name)
            expect(conspiracy(s, banner)).toMatch(name)
            expect(recover(s, banner)).toMatch(name)
        })
    }

    it('Sneak Attack: a vow holder whose only declarable targets include the Darkest Secret is asked from the revision, and passed over before it', () => {
        // Giant Python wants an even pool: the pawn's two and the title's one are odd, so a target needs the Secret's one.
        const python = (oathRevision: number) =>
            table(oathRevision, [SILENCE], [PYTHON], {}, {
                warbandsBySite: {},
                oathkeeperPlayerId: 'holder',
                oathkeeperIsUsurper: false,
                banners: { [Banner.PeoplesFavor]: { value: 1, mobSide: false }, [Banner.DarkestSecret]: { value: 1, holderPlayerId: 'holder' } }
            })
        const ask = (s: ReturnType<typeof table>) =>
            askQuestion(s, 'holder', { kind: PowerQuestionKind.SneakAttack, cardId: SNEAK_ATTACK, askedPlayerId: 'taker', defenderPlayerId: 'holder' })
        expect(ask(python(beforeRevision))).toBe('no targets can be declared against holder')
        const s = python(atRevision)
        expect(ask(s)).toBeUndefined()
        expect(s.pendingQuestions?.queue[0]?.kind).toBe(PowerQuestionKind.SneakAttack)
    })
})

describe('Tome Guardians, Lost Tongue and Circlet of Command forbid every take, before and from the revision', () => {
    const takes = [recover, campaign, conspiracy]
    for (const oathRevision of [beforeRevision, atRevision]) {
        it(`revision ${oathRevision}`, () => {
            for (const take of takes) {
                expect(take(table(oathRevision, [], [TOME]), Banner.DarkestSecret)).toMatch(/Tome Guardians/)
                expect(take(table(oathRevision, [], [TONGUE]), Banner.DarkestSecret)).toMatch(/Lost Tongue/)
                expect(take(table(oathRevision, [], [TONGUE]), Banner.PeoplesFavor)).toMatch(/Lost Tongue/)
                const circlet = table(oathRevision, [], [], { holder: { relicIds: [CIRCLET] } })
                expect(take(circlet, Banner.DarkestSecret)).toMatch(/Circlet of Command/)
                expect(take(circlet, Banner.PeoplesFavor)).toMatch(/Circlet of Command/)
            }
        })
    }
})

describe("Vow of Silence counts the secrets placed, Magician's Code's two included", () => {
    /** `holder` keeps the vow; `taker` recovers the unheld Darkest Secret, paying one and stacking three. */
    const silent = (oathRevision: number) =>
        table(oathRevision, [MAGICIANS_CODE], [SILENCE], {}, { banners: { [Banner.PeoplesFavor]: { value: 1, mobSide: false }, [Banner.DarkestSecret]: { value: 1 } } })
    const recoverWithCode = () => buildAction(Recover, { playerId: 'taker', target: { kind: RecoverTargetKind.Banner, banner: Banner.DarkestSecret }, amountPaid: 1, modifiers: [modifierUse(MAGICIANS_CODE)] })

    for (const [oathRevision, gained] of [[beforeRevision, 1], [atRevision, 3]]) {
        it(`R-X.4 — revision ${oathRevision}: the holder gains ${gained}, and the Recover replays unchanged`, () => {
            const before = silent(oathRevision).dehydrate()
            const game = testGame(['taker', 'holder', 'chancellor'])
            const recorded = engine.runNext(recoverWithCode(), structuredClone(before), game)
            expect(recorded.updatedState.banners[Banner.DarkestSecret]).toMatchObject({ holderPlayerId: 'taker', value: 3 })
            expect(recorded.updatedState.players.find((p) => p.playerId === 'holder')?.secrets).toBe(3 + gained)
            expect(recorded.processedActions.find(isRecover)?.metadata?.modifierNotes).toEqual([`Vow of Silence: holder gained ${gained} secrets`])

            let replayed = structuredClone(before)
            for (const action of recorded.processedActions) replayed = engine.run(structuredClone(action), replayed, game, RunMode.Single).updatedState
            expect(replayed).toEqual(recorded.updatedState)
        })
    }
})
