import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedTrade, TradeOption } from '../actions/trade.js'
import { HydratedMuster, Muster } from '../actions/muster.js'
import { HydratedTravel, Travel } from '../actions/travel.js'
import { HydratedRecover, RecoverTargetKind, Recover } from '../actions/recover.js'
import { HydratedCampaign, Campaign } from '../actions/campaign.js'
import { HydratedCampaignSacrifice } from '../actions/campaignSacrifice.js'
import { CampaignDefend, HydratedCampaignDefend } from '../actions/campaignDefend.js'
import { HydratedUseActionPower, UseActionPower } from '../actions/useActionPower.js'
import { HydratedSearchResolve, SearchPlay, SearchResolve } from '../actions/searchResolve.js'
import { reasonCannotPlayCard } from '../util/cardPlay.js'
import { HydratedSelfExile } from '../actions/selfExile.js'
import { CampaignTargetKind } from '../model/campaign.js'
import { Banner, PlayerStatus, Suit } from '../model/oathEnums.js'
import { testPlayer, testState, openTurn } from '../testing/fixture.js'
import { grantTitle } from '../util/title.js'
import { afterTravelPersistent, areEnemies, reasonPersistentForbidsFacedownAdviser, reasonPersistentForbidsTrade } from '../util/persistent.js'
import '../powers/index.js'
import { reasonFlipInvalid } from '../util/siteTravel.js'
import { reasonCannotPlayConspiracy } from '../util/cardPlay.js'
import { CONSPIRACY_ID } from '../data/visions.js'
import { ongoingCampaign } from '../testing/required.js'
import { buildAction } from '../testing/actions.js'
import { actionPowerUse, battlePlanUse, player } from '../testing/choices.js'
import { PowerChoiceKind, type PowerChoice } from '../util/powerChoice.js'
import { reasonTransferInvalid } from '../util/exchange.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { INN, FILLER } from '../testing/cards.js'
import { askQuestion } from '../util/questions.js'
import { PowerQuestionKind } from '../model/question.js'
import { OathRevision } from '../util/revision.js'
import { MachineState } from '../definition/states.js'
import { RunMode, engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'

const FOREST = 'denizen.beast.forest-council'
const GOSSIP = 'denizen.discord.gossip'
const POLICE = 'denizen.order.secret-police'
const SACRED = 'denizen.nomad.sacred-ground'
const TOME = 'denizen.order.tome-guardians'
const TONGUE = 'denizen.nomad.lost-tongue'
const BREAKER = 'denizen.nomad.spell-breaker'
const PEACE = 'denizen.hearth.vow-of-peace'
const SEAT = 'denizen.order.council-seat'
const SILENCE = 'denizen.arcane.vow-of-silence'
const FOREST_COUNCIL_ID = 'denizen.beast.forest-council'
const MARSH = 'denizen.beast.marsh-spirit'
const TAMER = 'denizen.discord.beast-tamer'
const NAMES = 'denizen.beast.true-names'
const ARMOR = 'denizen.arcane.gleaming-armor'
const SWARM = 'denizen.beast.insect-swarm'
const WARD = 'denizen.arcane.sealing-ward'
const PYTHON = 'denizen.beast.giant-python'
const VINES = 'denizen.beast.grasping-vines'
const LAKE = 'denizen.discord.boiling-lake'
const CULT = 'denizen.discord.chaos-cult'
const SADDLE = 'denizen.hearth.saddle-makers'
const TAX = 'denizen.order.royal-tax'
const MARRIAGE = 'denizen.hearth.marriage'
const RITE = 'denizen.arcane.initiation-rite'
const DISSENT = 'denizen.discord.dissent'

const WOLVES = 'denizen.beast.wolves'
const TENTS = 'denizen.nomad.tents'
const SCOUTS = 'denizen.order.scouts'
const RANGERS = 'denizen.beast.rangers'
const HORSE = 'denizen.nomad.horse-archers'
const TUTOR = 'denizen.arcane.tutor'
const VISION = 'vision.supremacy'

function board(cards: Record<string, string[]> = {}, advisers: Record<string, string[]> = {}, over: Record<string, Record<string, unknown>> = {}, state: Record<string, unknown> = {}) {
    const adv = (id: string) => (advisers[id] ?? []).map((cardId) => ({ cardId, faceUp: true }))
    const s = testState(
        [
            testPlayer({ playerId: 'ruler', color: Color.Red, siteId: 'c1', favor: 4, secrets: 3, supply: 5, warbandsOnBoard: { ruler: 4 }, warbandsInPersonalBank: { ruler: 6 }, advisers: adv('ruler'), ...over['ruler'] }),
            testPlayer({ playerId: 'other', color: Color.Blue, siteId: 'c1', favor: 4, secrets: 3, supply: 5, warbandsOnBoard: { other: 3 }, warbandsInPersonalBank: { other: 5 }, advisers: adv('other'), ...over['other'] }),
            testPlayer({ playerId: 'away', color: Color.Yellow, siteId: 'h1', favor: 2, secrets: 2, supply: 5, warbandsOnBoard: { away: 2 }, advisers: adv('away'), ...over['away'] })
        ],
        {
            denizensBySite: { c1: [], c2: [], p1: [], h1: [], ...cards },
            warbandsBySite: { c1: { ruler: 1 }, c2: { ruler: 2 }, p1: { other: 3 } },
            siteCards: { c1: 'site.plains', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' },
            discardPileCounts: { cradle: 2, provinces: 2, hinterland: 2 },
            ...state
        }
    )
    openTurn(s, 'ruler')
    return s
}
const onTurn = (s: ReturnType<typeof board>, id: string) => { openTurn(s, id); return s }

function play(s: ReturnType<typeof board>, playerId: string, cardId: string, to: SearchPlay, faceUp?: boolean) {
    s.getPlayerState(playerId).handIds = [cardId, FILLER]
    const a = new HydratedSearchResolve(buildAction(SearchResolve, { playerId, keptCardId: cardId, discardOrder: [FILLER], play: to, faceUp }))
    a.apply(s)
    return a
}
function attack(s: ReturnType<typeof board>, playerId: string, fields: Record<string, unknown> = {}) {
    return new HydratedCampaign(buildAction(Campaign, { playerId, defender: { kind: 'player', playerId: playerId === 'ruler' ? 'other' : 'ruler' }, targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }], attackDice: 2, ...fields }))
}

describe('enemies of the ruler', () => {
    it('Forest Council — enemies of its ruler cannot trade with or muster from beast cards; the ruler can', () => {
        const s = board({ c1: [FOREST, WOLVES, INN] })
        expect(HydratedTrade.reasonCannotTrade(s, 'other', WOLVES, TradeOption.ForFavor)).toMatch(/Forest Council/)
        expect(HydratedMuster.reasonCannotMuster(s, 'other', WOLVES)).toMatch(/Forest Council/)
        expect(HydratedTrade.reasonCannotTrade(s, 'other', INN, TradeOption.ForFavor)).toBeUndefined()
        expect(HydratedTrade.reasonCannotTrade(s, 'ruler', WOLVES, TradeOption.ForFavor)).toBeUndefined()
        expect(HydratedMuster.reasonCannotMuster(s, 'ruler', WOLVES)).toBeUndefined()
    })

    it('Gossip and Secret Police bind plays; Sacred Ground binds everyone away from it', () => {
        const s = board({ c1: [GOSSIP] })
        expect(reasonCannotPlayCard(s, 'other', TENTS, SearchPlay.Adviser, { faceUp: false })).toMatch(/Gossip/)
        expect(reasonCannotPlayCard(s, 'other', TENTS, SearchPlay.Adviser, { faceUp: true })).toBeUndefined()
        expect(reasonCannotPlayCard(s, 'ruler', TENTS, SearchPlay.Adviser, { faceUp: false })).toBeUndefined()

        const p = board({ c2: [POLICE] })
        expect(reasonCannotPlayCard(p, 'other', VISION, SearchPlay.RevealedVision)).toMatch(/Secret Police/)
        expect(reasonCannotPlayCard(p, 'away', VISION, SearchPlay.RevealedVision)).toBeUndefined()

        const g = board({ c2: [SACRED] })
        expect(reasonCannotPlayCard(g, 'other', VISION, SearchPlay.RevealedVision)).toMatch(/Sacred Ground/)
        g.getPlayerState('other').siteId = 'c2'
        expect(reasonCannotPlayCard(g, 'other', VISION, SearchPlay.RevealedVision)).toBeUndefined()
    })

    it('Tome Guardians and Lost Tongue guard the Darkest Secret, relics and banners', () => {
        const ds = { banners: { [Banner.DarkestSecret]: { holderPlayerId: 'ruler', value: 1 }, [Banner.PeoplesFavor]: { value: 1 } } }
        const t = board({ c1: [TOME] }, {}, {}, ds)
        const recoverDs: Pick<Recover, 'target' | 'amountPaid'> = { target: { kind: RecoverTargetKind.Banner, banner: Banner.DarkestSecret }, amountPaid: 2 }
        expect(HydratedRecover.reasonCannotRecover(t, 'other', recoverDs)).toMatch(/Tome Guardians/)
        expect(HydratedRecover.reasonCannotRecover(t, 'other', { target: { kind: RecoverTargetKind.Banner, banner: Banner.PeoplesFavor }, amountPaid: 2, redistributeFrom: Suit.Hearth })).toBeUndefined()
        expect(HydratedCampaign.reasonCannotCampaign(t, 'other', { defender: { kind: 'player', playerId: 'ruler' }, targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }, { kind: CampaignTargetKind.Banner, banner: Banner.DarkestSecret }], attackDice: 2, plans: [] })).toMatch(/Tome Guardians/)

        const l = board({}, { ruler: [TONGUE] }, { ruler: { relicIds: ['relic.cup-of-plenty'] } }, ds)
        const relicTarget: Pick<Campaign, 'defender' | 'targets' | 'attackDice' | 'plans'> = { defender: { kind: 'player', playerId: 'ruler' }, targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }, { kind: CampaignTargetKind.Relic, cardId: 'relic.cup-of-plenty' }], attackDice: 2, plans: [] }
        expect(HydratedCampaign.reasonCannotCampaign(l, 'other', relicTarget)).toMatch(/Lost Tongue/)
        expect(HydratedRecover.reasonCannotRecover(l, 'other', recoverDs)).toMatch(/Lost Tongue/)
        // Ruling a nomad card lifts it.
        l.getPlayerState('other').setAdvisers([{ cardId: TENTS, faceUp: true }])
        expect(HydratedCampaign.reasonCannotCampaign(l, 'other', relicTarget)).toBeUndefined()
    })

    it('Lost Tongue’s refusal names no seat as “you”, so a Relic Thief note that carries it reads the same at every seat', () => {
        const l = board({}, { ruler: [TONGUE] }, { ruler: { relicIds: ['relic.cup-of-plenty'] } })
        const refused = askQuestion(l, 'ruler', { kind: PowerQuestionKind.RelicThiefRoll, cardId: 'denizen.discord.relic-thief', askedPlayerId: 'other', powerIndex: 0, takerPlayerId: 'ruler', relicCardIds: ['relic.cup-of-plenty'] })
        expect(refused).toBe("other cannot use Relic Thief: Lost Tongue: its holder's relics and banners cannot be taken without ruling a nomad card")
    })

    it('Spell Breaker — enemies of its ruler cannot use powers that cost secrets', () => {
        const s = board({ c1: [BREAKER, TUTOR] })
        const use = (playerId: string) => new HydratedUseActionPower(buildAction(UseActionPower, { playerId, cardId: TUTOR, powerIndex: 0 }))
        expect(() => use('other').apply(onTurn(board({ c1: [BREAKER, TUTOR] }), 'other'))).toThrow(/Spell Breaker/)
        use('ruler').apply(s)
        expect(s.getPlayerState('ruler').secrets).toBe(3)
    })
})

describe('vows and seats', () => {
    it('Vow of Peace — its holder cannot campaign, and attackers cannot sacrifice against them', () => {
        const s = board({}, { ruler: [PEACE] })
        expect(HydratedCampaign.canDoCampaign(s, 'ruler')).toBe(false)
        expect(HydratedCampaign.reasonCannotCampaign(s, 'ruler', { defender: { kind: 'player', playerId: 'other' }, targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }], attackDice: 2, plans: [] })).toMatch(/Vow of Peace/)
        const t = onTurn(board({}, { ruler: [PEACE] }), 'other')
        attack(t, 'other').apply(t)
        expect(HydratedCampaignSacrifice.reasonCannotResolve(t, 'other', { sacrifice: 1, defeatKills: [] })).toMatch(/Vow of Peace/)
    })

    it('Council Seat — a Citizen holding it cannot self-exile', () => {
        const s = board({}, { other: [SEAT] }, { other: { status: PlayerStatus.Citizen, owner: 'other' }, ruler: { status: PlayerStatus.Chancellor, relicIds: ['relic.grand-scepter'] } }, { chancellorPlayerId: 'ruler' })
        expect(HydratedSelfExile.reasonCannotSelfExile(s, 'other')).toMatch(/Council Seat/)
        const free = board({}, {}, { other: { status: PlayerStatus.Citizen }, ruler: { status: PlayerStatus.Chancellor, relicIds: ['relic.grand-scepter'] } }, { chancellorPlayerId: 'ruler' })
        expect(HydratedSelfExile.reasonCannotSelfExile(free, 'other')).not.toMatch(/Council Seat/)
    })

    it('Vow of Silence — its holder cannot recover the Darkest Secret, and gains what others place', () => {
        const ds = { banners: { [Banner.DarkestSecret]: { holderPlayerId: 'away', value: 1 }, [Banner.PeoplesFavor]: { value: 1 } } }
        const s = board({}, { ruler: [SILENCE] }, {}, ds)
        expect(HydratedRecover.reasonCannotRecover(s, 'ruler', { target: { kind: RecoverTargetKind.Banner, banner: Banner.DarkestSecret }, amountPaid: 2 })).toMatch(/Vow of Silence/)
        // R-2.5.4 — a card at the holder's site matching none of their advisers exposes the Secret.
        const t = onTurn(board({ h1: [INN] }, { ruler: [SILENCE] }, { other: { secrets: 4 } }, ds), 'other')
        const a = new HydratedRecover(buildAction(Recover, { playerId: 'other', target: { kind: RecoverTargetKind.Banner, banner: Banner.DarkestSecret }, amountPaid: 2 }))
        a.apply(t)
        expect(t.getPlayerState('ruler').secrets).toBe(5)
        expect(a.metadata?.modifierNotes).toEqual(['Vow of Silence: ruler gained 2 secrets'])
    })

    it('Vow of Silence — its holder cannot give anyone secrets: not by Witch\'s Bargain, the Whistle or an exchange', () => {
        const WITCH = 'denizen.arcane.witchs-bargain'
        const s = board({ c1: [WITCH] }, { ruler: [SILENCE] }, { ruler: { relicIds: ['relic.whistle'] } })
        const n = (count: number): PowerChoice => ({ kind: PowerChoiceKind.Count, n: count })
        const witch = (give: number, take: number) => HydratedUseActionPower.reasonCannotUse(s, 'ruler', WITCH, powerIndexOf(WITCH, PowerTiming.Action), [player('other'), n(give), n(take)])
        expect(witch(1, 0)).toMatch(/Vow of Silence/)
        expect(witch(0, 1)).toBeUndefined()
        expect(reasonTransferInvalid(s, 'ruler', 'other', { secrets: 1 })).toMatch(/Vow of Silence/)
        expect(reasonTransferInvalid(s, 'other', 'ruler', { secrets: 1 })).toBeUndefined()
        actionPowerUse('ruler', 'relic.whistle', [player('away')]).apply(s)
        expect(s.getPlayerState('away').siteId).toBe('c1')
        expect(s.getPlayerState('away').secrets).toBe(2)
        expect(s.tokensOn('relic.whistle').secrets).toBe(1)
    })
})

describe('R-10.7 — a card the bandits rule binds every player, for the bandits are enemies to all', () => {
    it('Gossip, Forest Council and Grasping Vines at a site no player rules', () => {
        // h1 holds no warbands, so the bandits rule it.
        const s = board({ h1: ['denizen.discord.gossip', FOREST_COUNCIL_ID, 'denizen.beast.grasping-vines'] })
        expect(reasonPersistentForbidsFacedownAdviser(s, 'ruler')).toMatch(/Gossip/)
        expect(reasonPersistentForbidsTrade(s, 'ruler', 'denizen.beast.wolves')).toMatch(/Forest Council/)
        expect(afterTravelPersistent(s, 'away', 'h1', 'c1')).toContainEqual(expect.stringMatching(/Grasping Vines/))
        expect(s.getPlayerState('away').warbandsOnBoard['away']).toBe(1)
        // Leaving a site a player rules, the bandits' Vines do nothing.
        expect(afterTravelPersistent(s, 'ruler', 'c1', 'c2')).toEqual([])
    })
})

describe('in a Campaign', () => {
    it('Marsh Spirit, Beast Tamer and True Names refuse the plans they name', () => {
        const m = onTurn(board({ c1: [MARSH] }, { other: [SCOUTS] }), 'other')
        expect(HydratedCampaign.reasonCannotCampaign(m, 'other', { defender: { kind: 'player', playerId: 'ruler' }, targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }], attackDice: 2, plans: [battlePlanUse(SCOUTS)] })).toMatch(/Marsh Spirit/)

        const t = onTurn(board({}, { ruler: [TAMER], other: [RANGERS] }, { other: { favor: 4 } }), 'other')
        expect(HydratedCampaign.reasonCannotCampaign(t, 'other', { defender: { kind: 'player', playerId: 'ruler' }, targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }], attackDice: 2, plans: [battlePlanUse(RANGERS)] })).toMatch(/Beast Tamer/)

        const n = onTurn(board({}, { ruler: [NAMES, TENTS], other: [HORSE] }), 'other')
        expect(HydratedCampaign.reasonCannotCampaign(n, 'other', { defender: { kind: 'player', playerId: 'ruler' }, targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }], attackDice: 2, plans: [battlePlanUse(HORSE)] })).toMatch(/True Names/)
        // An order plan matches no adviser of the ruler's.
        const n2 = onTurn(board({}, { ruler: [NAMES, TENTS], other: [SCOUTS] }), 'other')
        expect(HydratedCampaign.reasonCannotCampaign(n2, 'other', { defender: { kind: 'player', playerId: 'ruler' }, targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }], attackDice: 2, plans: [battlePlanUse(SCOUTS)] })).toBeUndefined()
        // A relic's plan has no suit, so it matches no adviser, a suitless Vision included.
        const n3 = onTurn(board({}, { ruler: [NAMES, 'vision.faith'] }, { other: { relicIds: ['relic.cursed-cauldron'] } }), 'other')
        expect(HydratedCampaign.reasonCannotCampaign(n3, 'other', { defender: { kind: 'player', playerId: 'ruler' }, targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }], attackDice: 2, plans: [battlePlanUse('relic.cursed-cauldron')] })).toBeUndefined()
    })

    it("Gleaming Armor and Insect Swarm surcharge the enemy's plans", () => {
        const s = onTurn(board({}, { ruler: [ARMOR, SWARM], other: [SCOUTS] }, { other: { favor: 1, secrets: 1 } }), 'other')
        attack(s, 'other', { plans: [battlePlanUse(SCOUTS)] }).apply(s)
        expect(s.getPlayerState('other').secrets).toBe(0)
        expect(s.getPlayerState('other').favor).toBe(0)
        expect(s.tokensOn(SCOUTS).secrets).toBe(1)
        const broke = onTurn(board({}, { ruler: [ARMOR], other: [SCOUTS] }, { other: { secrets: 0 } }), 'other')
        expect(() => attack(broke, 'other', { plans: [battlePlanUse(SCOUTS)] }).apply(broke)).toThrow(/costs 1 secrets here/)
    })

    it("Spell Breaker — its Q&A: Gleaming Armor's added secret, a secret flipped to travel or target, and the Conspiracy's burned secret", () => {
        const armored = onTurn(board({}, { ruler: [ARMOR, BREAKER], other: [SCOUTS] }, { other: { favor: 1, secrets: 1 } }), 'other')
        expect(() => attack(armored, 'other', { plans: [battlePlanUse(SCOUTS)] }).apply(armored)).toThrow(/Spell Breaker/)
        const s = board({}, { ruler: [BREAKER] })
        expect(reasonFlipInvalid(s, 'other', true, true)).toMatch(/Spell Breaker/)
        expect(reasonFlipInvalid(s, 'ruler', true, true)).toBeUndefined()
        const conspiring = board({}, { ruler: [BREAKER, 'denizen.hearth.storyteller', 'denizen.beast.rangers'], other: ['denizen.hearth.wayside-inn', 'denizen.beast.wolves'] })
        expect(reasonCannotPlayConspiracy(conspiring, 'other', { keptCardId: CONSPIRACY_ID, conspiracy: { targetPlayerId: 'ruler', take: { kind: 'banner', banner: Banner.DarkestSecret } } })).toMatch(/Spell Breaker/)
    })

    it("the Conspiracy's banner take: Tome Guardians and Lost Tongue forbid it, as they forbid any take", () => {
        const holding = { banners: { [Banner.PeoplesFavor]: { value: 1, mobSide: false }, [Banner.DarkestSecret]: { value: 1, holderPlayerId: 'ruler' } } }
        const matching = ['denizen.hearth.storyteller', 'denizen.beast.rangers']
        const theirs = ['denizen.hearth.wayside-inn', 'denizen.beast.wolves']
        const takeDarkestSecret = (s: ReturnType<typeof board>) =>
            reasonCannotPlayConspiracy(s, 'other', { keptCardId: CONSPIRACY_ID, conspiracy: { targetPlayerId: 'ruler', take: { kind: 'banner', banner: Banner.DarkestSecret } } })
        expect(takeDarkestSecret(board({}, { ruler: matching, other: theirs }, {}, holding))).toBeUndefined()
        expect(takeDarkestSecret(board({}, { ruler: [...matching, 'denizen.order.tome-guardians'], other: theirs }, {}, holding))).toMatch(/Tome Guardians/)
        expect(takeDarkestSecret(board({}, { ruler: [...matching, 'denizen.nomad.lost-tongue'], other: theirs }, {}, holding))).toMatch(/Lost Tongue/)
    })

    it('the Conspiracy is a Vision played faceup: Vow of Obedience and Secret Police forbid it', () => {
        const s = board({}, { ruler: ['denizen.order.vow-of-obedience'] })
        expect(reasonCannotPlayConspiracy(s, 'ruler', { keptCardId: CONSPIRACY_ID })).toMatch(/Vow of Obedience/)
        const policed = board({ c1: ['denizen.order.secret-police'] })
        expect(reasonCannotPlayConspiracy(policed, 'other', { keptCardId: CONSPIRACY_ID })).toMatch(/Secret Police/)
        expect(reasonCannotPlayConspiracy(board(), 'ruler', { keptCardId: CONSPIRACY_ID })).toBeUndefined()
    })

    it('R-7.1.2.a — a defender pays the surcharge out of turn: the secret goes facedown on their board, not onto the plan', () => {
        const PROVISIONS = 'denizen.hearth.extra-provisions'
        const s = board({}, { ruler: [ARMOR], other: [PROVISIONS] }, { other: { favor: 2, secrets: 1 } })
        attack(s, 'ruler', { targets: [{ kind: CampaignTargetKind.PawnAndFavor }] }).apply(s)
        expect(ongoingCampaign(s).pendingDefenderPlans?.queue).toEqual(['other'])
        new HydratedCampaignDefend(buildAction(CampaignDefend, { playerId: 'other', plans: [battlePlanUse(PROVISIONS)] })).apply(s)
        const defender = s.getPlayerState('other')
        expect(defender.secrets).toBe(0)
        expect(defender.secretsFacedown).toBe(1)
        expect(s.tokensOn(PROVISIONS).secrets).toBe(0)
    })

    it('Sealing Ward adds a die per targeted relic; Giant Python wants an even pool', () => {
        const w = onTurn(board({}, { ruler: [WARD] }, { ruler: { relicIds: ['relic.cup-of-plenty'] } }), 'other')
        attack(w, 'other', { targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }, { kind: CampaignTargetKind.Relic, cardId: 'relic.cup-of-plenty' }] }).apply(w)
        const plain = onTurn(board({}, {}, { ruler: { relicIds: ['relic.cup-of-plenty'] } }), 'other')
        attack(plain, 'other', { targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }, { kind: CampaignTargetKind.Relic, cardId: 'relic.cup-of-plenty' }] }).apply(plain)
        expect(ongoingCampaign(w).defensePool).toBe(ongoingCampaign(plain).defensePool + 1)

        const p = onTurn(board({}, { ruler: [PYTHON] }), 'other')
        expect(HydratedCampaign.reasonCannotCampaign(p, 'other', { defender: { kind: 'player', playerId: 'ruler' }, targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }], attackDice: 2, plans: [] })).toMatch(/Giant Python/)
        expect(HydratedCampaign.reasonCannotCampaign(p, 'other', { defender: { kind: 'player', playerId: 'ruler' }, targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }, { kind: CampaignTargetKind.Site, siteId: 'c2' }], attackDice: 2, plans: [] })).toBeUndefined()
    })
})

describe('travel and triggers', () => {
    it('Grasping Vines and Boiling Lake kill on the road', () => {
        const v = onTurn(board({ c1: [VINES] }), 'other')
        const a = new HydratedTravel(buildAction(Travel, { playerId: 'other', siteId: 'c2' }))
        a.apply(v)
        expect(v.getPlayerState('other').warbandsOnBoard['other']).toBe(2)
        expect(a.metadata?.modifierNotes).toEqual(["Grasping Vines: killed a warband on other's board"])
        const r = board({ c1: [VINES] })
        new HydratedTravel(buildAction(Travel, { playerId: 'ruler', siteId: 'c2' })).apply(r)
        expect(r.getPlayerState('ruler').warbandsOnBoard['ruler']).toBe(4)

        const l = onTurn(board({ c2: [LAKE] }), 'other')
        new HydratedTravel(buildAction(Travel, { playerId: 'other', siteId: 'c2' })).apply(l)
        expect(l.getPlayerState('other').warbandsOnBoard['other']).toBe(1)
        const owner = board({ c2: [LAKE] })
        new HydratedTravel(buildAction(Travel, { playerId: 'ruler', siteId: 'c2' })).apply(owner)
        expect(owner.getPlayerState('ruler').warbandsOnBoard['ruler']).toBe(4)
    })

    it('Chaos Cult taxes a new Oathkeeper; Saddle Makers pays on nomad and order plays', () => {
        const c = board({}, { ruler: [CULT] })
        grantTitle(c, 'other')
        expect(c.getPlayerState('other').favor).toBe(3)
        expect(c.getPlayerState('ruler').favor).toBe(5)
        grantTitle(c, 'ruler')
        expect(c.getPlayerState('ruler').favor).toBe(5)

        const s = onTurn(board({}, { ruler: [SADDLE] }), 'other')
        const order = s.favorBank[Suit.Order]
        const a = play(s, 'other', SCOUTS, SearchPlay.Site)
        // R-5.1.4.I — one favor to the player for the site play; two to Saddle Makers' holder.
        expect(s.favorBank[Suit.Order]).toBe(order - 3)
        expect(s.getPlayerState('ruler').favor).toBe(6)
        expect(a.metadata?.triggered).toEqual(['Saddle Makers: ruler gained 2 favor from the order bank'])
        // R-5.1.4.I — the holder's own play earns only the site play's one favor.
        const own = board({}, { ruler: [SADDLE] })
        play(own, 'ruler', SCOUTS, SearchPlay.Site)
        expect(own.getPlayerState('ruler').favor).toBe(5)
        const hearth = onTurn(board({}, { ruler: [SADDLE] }), 'other')
        play(hearth, 'other', INN, SearchPlay.Site)
        expect(hearth.getPlayerState('ruler').favor).toBe(4)
    })

    it('Marriage counts twice at a hearth Trade; Initiation Rite musters with a secret; Dissent taxes by suit', () => {
        expect(HydratedTrade.matchingAdvisers(board({}, { ruler: [MARRIAGE] }), 'ruler', INN)).toBe(2)
        expect(HydratedTrade.matchingAdvisers(board({}, { ruler: [MARRIAGE] }), 'ruler', WOLVES)).toBe(0)

        const r = board({ c1: [INN] }, { ruler: [RITE] }, { ruler: { favor: 0, secrets: 2 } })
        expect(HydratedMuster.reasonCannotMuster(r, 'ruler', INN)).toBeUndefined()
        new HydratedMuster(buildAction(Muster, { playerId: 'ruler', cardId: INN })).apply(r)
        expect(r.tokensOn(INN)).toEqual({ favor: 0, secrets: 1 })
        expect(r.getPlayerState('ruler').secrets).toBe(1)
        expect(HydratedMuster.reasonCannotMuster(board({ c1: [INN] }, { ruler: [RITE] }, { ruler: { secrets: 0 } }), 'ruler', INN)).toMatch(/Initiation Rite/)

        const pf = { banners: { [Banner.PeoplesFavor]: { holderPlayerId: 'away', value: 1 }, [Banner.DarkestSecret]: { value: 1 } } }
        const d = board({ c1: [WOLVES, INN], p1: [TENTS] }, {}, {}, pf)
        // ruler rules c1 (beast, hearth) and c2, other p1 (nomad); away holds the People's Favor.
        play(d, 'ruler', DISSENT, SearchPlay.Site)
        expect(d.tokensOn(DISSENT).favor).toBe(4)
        // R-5.1.4.I — the ruler gains a favor for the site play, then pays three.
        expect(d.getPlayerState('ruler').favor).toBe(2)
        expect(d.getPlayerState('other').favor).toBe(3)
        expect(d.getPlayerState('away').favor).toBe(2)
    })

    it('areEnemies — Exiles against everyone, Imperial players not against each other', () => {
        const s = board({}, {}, { ruler: { status: PlayerStatus.Chancellor }, other: { status: PlayerStatus.Citizen } })
        expect(areEnemies(s, 'ruler', 'other')).toBe(false)
        expect(areEnemies(s, 'ruler', 'away')).toBe(true)
        expect(areEnemies(s, 'away', 'other')).toBe(true)
        expect(areEnemies(s, 'away', 'away')).toBe(false)
    })
})

describe('Saddle Makers pays before the played card’s When Played (its Q&A)', () => {
    const atRevision = OathRevision.CardFixes1
    const before = OathRevision.PlanCostsAndSearchPlays

    /** `other` is on turn at p1, which they rule; Saddle Makers' holder stands there with one favor. */
    function taxed(oathRevision: number, state: Record<string, unknown> = {}) {
        return onTurn(board({}, { ruler: [SADDLE] }, { ruler: { siteId: 'p1', favor: 1 }, other: { siteId: 'p1' }, away: { status: PlayerStatus.Chancellor } }, { oathRevision, ...state }), 'other')
    }

    it('the holder gains 2 favor first, so Royal Tax then takes 2 of their 3', () => {
        const s = taxed(atRevision)
        const a = play(s, 'other', TAX, SearchPlay.Adviser, true)
        expect(a.metadata?.triggered).toEqual(['Saddle Makers: ruler gained 2 favor from the order bank'])
        expect(a.metadata?.whenPlayed).toBe("taxed 2 favor from players at other's ruled sites in the region")
        expect(s.getPlayerState('ruler').favor).toBe(1)
        expect(s.getPlayerState('other').favor).toBe(6)
    })

    it('R-X.4 — in a game created before revision 4 it paid after: Royal Tax took the one favor, then Saddle Makers gave 2', () => {
        const s = taxed(before)
        const a = play(s, 'other', TAX, SearchPlay.Adviser, true)
        expect(a.metadata?.triggered).toEqual(['Saddle Makers: ruler gained 2 favor from the order bank'])
        expect(a.metadata?.whenPlayed).toBe("taxed 1 favor from players at other's ruled sites in the region")
        expect(s.getPlayerState('ruler').favor).toBe(2)
        expect(s.getPlayerState('other').favor).toBe(5)
    })

    it('R-X.4 — each revision’s Royal Tax play replays unchanged', () => {
        for (const [revision, favor] of [[before, 2], [atRevision, 1]]) {
            const s = taxed(revision, { machineState: MachineState.Searching })
            s.getPlayerState('other').handIds = [TAX, FILLER]
            const start = s.dehydrate()
            start.activePlayerIds = ['other']
            const game = testGame(['ruler', 'other', 'away'])
            const recorded = engine.runNext(buildAction(SearchResolve, { playerId: 'other', keptCardId: TAX, discardOrder: [FILLER], play: SearchPlay.Adviser, faceUp: true }), structuredClone(start), game)
            expect(recorded.updatedState.players.find((p) => p.playerId === 'ruler')?.favor).toBe(favor)

            let replayed = structuredClone(start)
            for (const action of recorded.processedActions) replayed = engine.run(structuredClone(action), replayed, game, RunMode.Single).updatedState
            expect(replayed).toEqual(recorded.updatedState)
        }
    })
})
