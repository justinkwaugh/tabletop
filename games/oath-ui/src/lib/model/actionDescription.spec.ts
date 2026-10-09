import { describe, expect, it } from 'vitest'
import {
    ActionType,
    AnswerQuestion,
    ExileCitizen,
    HydratedAnswerQuestion,
    HydratedExileCitizen,
    MachineState,
    PowerQuestionKind,
    type OathPlayerState,
    type PowerQuestion,
    type QuestionAnswer,
    HydratedMuster,
    HydratedPlayFacedownAdviser,
    HydratedSearch,
    HydratedSearchResolve,
    HydratedSelfExile,
    HydratedUseActionPower,
    IMPERIAL_WARBANDS,
    Muster,
    OathRevision,
    PlayFacedownAdviser,
    PlayerStatus,
    PowerChoiceKind,
    PowerTiming,
    Search,
    SearchPlay,
    SearchResolve,
    SearchSource,
    SelfExile,
    Suit,
    UseActionPower,
    ownWarbandOwner,
    powerIndexOf
} from '@tabletop/oath'
import { UNDESCRIBED, describeAction, rowWarbandOwner } from './actionDescription.js'
import { ActionSource, Color, type GameAction } from '@tabletop/common'
import { buildAction, testPlayer, testState } from '@tabletop/oath/testing'
import { siteName, slotLabel } from './names.js'

const nameOf = { player: (playerId: string) => ({ p1: 'Alice', p2: 'Bob', p3: 'Cass' })[playerId] ?? playerId, site: slotLabel, seats: ['p1', 'p2', 'p3'] }

function action(fields: { type: ActionType; playerId?: string } & Record<string, unknown>): GameAction {
    return { id: 'a1', gameId: 'g1', source: ActionSource.User, ...fields }
}

// A registered card: a sentence names the card an action was taken on.
const CARD = 'denizen.beast.errand-boy'

/** Only each schema's required fields, so every sentence must survive missing metadata. */
const MINIMAL: Record<string, Record<string, unknown>> = {
    [ActionType.SetupChoice]: { siteId: 'c1', adviserCardId: 'x', discardOrder: [] },
    [ActionType.Travel]: { siteId: 'c1' },
    [ActionType.Muster]: { cardId: CARD },
    [ActionType.Trade]: { cardId: CARD, option: 'forFavor' },
    [ActionType.Search]: { drawFrom: SearchSource.WorldDeck },
    [ActionType.SearchResolve]: { keptCardId: 'x', discardOrder: [], play: 'adviser' },
    [ActionType.Recover]: { target: { kind: 'relic', slotId: 's1' } },
    [ActionType.Campaign]: {
        defender: { kind: 'bandits' },
        targets: [],
        attackDice: 1
    },
    [ActionType.CampaignAttackPlans]: { plans: [] },
    [ActionType.CampaignDefend]: { plans: [] },
    [ActionType.UseRestPower]: { cardId: CARD, powerIndex: 0 },
    [ActionType.CampaignSacrifice]: { sacrifice: 0 },
    [ActionType.CampaignDefeatKills]: { kills: [] },
    [ActionType.CampaignResolveVictory]: { placements: [], burnFavor: false },
    [ActionType.PlayFacedownAdviser]: { cardId: CARD, play: 'adviser' },
    [ActionType.UseActionPower]: { cardId: CARD },
    [ActionType.Peek]: { target: { kind: 'siteRelic', slotId: 's1' } },
    [ActionType.LetPeek]: { toPlayerId: 'p2', subject: { kind: 'reliquary', slotId: 'r1' } },
    [ActionType.MoveWarbands]: { move: { kind: 'siteToBoard' }, owner: 'p1', count: 1 },
    [ActionType.OfferCitizenship]: { exilePlayerId: 'p2', reliquarySlotId: 'r1' },
    [ActionType.ResolveCitizenshipOffer]: { granted: true },
    [ActionType.AnswerConsent]: { granted: true },
    [ActionType.AnswerQuestion]: { answer: { kind: 'exchange', accept: true } },
    [ActionType.ExileCitizen]: { citizenPlayerId: 'p2' },
    [ActionType.SelfExile]: {},
    [ActionType.ResolveWake]: { favorSteps: [] },
    [ActionType.EndActPhase]: {},
    [ActionType.ForgoFreeAction]: { metadata: { forgone: ActionType.Travel } },
    [ActionType.CompleteRest]: {},
    [ActionType.RollEndDie]: { metadata: { roll: 4, round: 6, threshold: 5 } },
    [ActionType.ResolveOathkeeper]: { chosenPlayerId: 'p2' },
    [ActionType.TransferOathkeeper]: { source: 'system', fromPlayerId: 'p2', toPlayerId: 'p1' }
}

describe('a history line names a site by its printed name', () => {
    const TRIBUNAL = 'site.plains'
    const board = () =>
        testState([testPlayer({ playerId: 'p1', color: Color.Red, siteId: 'c1' })], { siteCards: { c1: TRIBUNAL } })

    it('uses the site card faceup, and the region for a facedown site', () => {
        const state = board()
        expect(siteName(state, 'c1')).toBe('Plains')
        expect(siteName(state, 'p1')).toBe('a facedown site in the Provinces')
    })

    it('Setup, Travel and Campaign targets name the site through the resolver', () => {
        const printed: Record<string, string> = { 'slot.provinces.2': 'Tribunal', 'slot.cradle.0': 'Plains', 'slot.hinterland.1': 'Mine' }
        const names = { ...nameOf, site: (slotId: string) => printed[slotId] }
        expect(describeAction(action({ type: ActionType.Travel, playerId: 'p1', siteId: 'slot.provinces.2' }), names)).toContain(
            'travelled to Tribunal'
        )
        expect(
            describeAction(action({ type: ActionType.SetupChoice, playerId: 'p1', siteId: 'slot.cradle.0', adviserCardId: 'x', discardOrder: [] }), names)
        ).toContain('placed a pawn at Plains')
        expect(
            describeAction(
                action({ type: ActionType.Campaign, playerId: 'p1', defender: { kind: 'bandits' }, targets: [{ kind: 'site', siteId: 'slot.hinterland.1' }], attackDice: 1, plans: [] }),
                names
            )
        ).toContain('for Mine')
    })

    it('a site id inside a power summary is named too', () => {
        const names = { ...nameOf, site: (slotId: string) => (slotId === 'slot.cradle.0' ? 'Plains' : slotId) }
        const line = describeAction(
            action({ type: ActionType.UseRestPower, playerId: 'p1', cardId: 'denizen.discord.insomnia', powerIndex: 0, choices: [], metadata: { summary: 'moved to slot.cradle.0' } }),
            names
        )
        expect(line).toBe('rested with Insomnia: moved to Plains')
    })
})

describe('the history tab describes every action', () => {
    it('has a sentence for all 32 action types, and reaches no fallback', () => {
        const types = Object.values(ActionType)
        // Pinned rather than read off the enum, so adding an action type fails here.
        expect(types).toHaveLength(32)

        for (const type of types) {
            const fields = MINIMAL[type]
            expect(fields, `no fixture for ${type}`).toBeDefined()
            const text = describeAction(action({ type, playerId: 'p1', ...fields }), nameOf)
            expect(text, `${type} fell through to the fallback`).not.toBe(UNDESCRIBED)
            expect(text.length, `${type} described as empty`).toBeGreaterThan(3)
        }
    })

    it('R-10.2 — names the free action given up', () => {
        const forgo = (forgone: ActionType) =>
            describeAction(action({ type: ActionType.ForgoFreeAction, playerId: 'p1', metadata: { forgone } }), nameOf)
        expect(forgo(ActionType.Travel)).toBe('gave up the free Travel')
        expect(forgo(ActionType.Campaign)).toBe('gave up the free Campaign')
    })

    it('R-2.11-H1 — names who the title came from, or says nobody holds it', () => {
        const transfer = (fields: Record<string, unknown>) =>
            describeAction(action({ type: ActionType.TransferOathkeeper, source: 'system', ...fields }), nameOf)
        expect(transfer({ fromPlayerId: 'p2', toPlayerId: 'p1' })).toBe('took the Oathkeeper title from Bob')
        expect(transfer({ fromPlayerId: 'p1' })).toBe('lost the Oathkeeper title; nobody holds it')
    })

    it('R-3.3 — gives the end die’s roll', () => {
        expect(describeAction(action({ type: ActionType.RollEndDie, playerId: 'p1', metadata: { roll: 4, round: 6, threshold: 5 } }), nameOf)).toBe('rolled the end die: 4')
    })

    it('R-5.1.2 — says a Search stopped on a Vision, from the public flag or the drawer’s own draw', () => {
        const search = (metadata: Record<string, unknown>) =>
            describeAction(action({ type: ActionType.Search, playerId: 'p1', drawFrom: SearchSource.WorldDeck, metadata: { supplySpent: 3, cardsDrawn: 2, visionsDrawn: 3, ...metadata } }), nameOf, 'p2')
        expect(search({ stoppedOnVision: true })).toBe('searched the world deck, spending 3 Supply; the draw stopped on a Vision')
        expect(search({ draw: { drawnCardIds: [], stoppedOnVision: true, worldDeckExhausted: false } })).toBe('searched the world deck, spending 3 Supply; the draw stopped on a Vision')
        expect(search({})).toBe('searched the world deck, spending 3 Supply')
    })

    it('R-7.1.4 — a Search names its toll: the favor, whom it went to and the card; a burned one; an older record as before', () => {
        const FORCED_LABOR = 'denizen.order.forced-labor'
        const search = (metadata: Record<string, unknown>) =>
            describeAction(action({ type: ActionType.Search, playerId: 'p1', drawFrom: SearchSource.WorldDeck, metadata: { supplySpent: 2, cardsDrawn: 3, visionsDrawn: 0, ...metadata } }), nameOf, 'p2')
        expect(search({ tollsPaid: [`${FORCED_LABOR}: gave a favor to p3`] })).toBe('searched the world deck, spending 2 Supply; 1 favor to Cass (Forced Labor)')
        expect(search({ tollsPaid: [`${FORCED_LABOR}: burned a favor for the bandits`] })).toBe('searched the world deck, spending 2 Supply; burned 1 favor (Forced Labor)')
        expect(search({ tollsPaid: [`${FORCED_LABOR}: gave a favor to p3`], stoppedOnVision: true })).toBe('searched the world deck, spending 2 Supply; 1 favor to Cass (Forced Labor); the draw stopped on a Vision')
        expect(search({ tollsPaid: ['not a toll note'] })).toBe('searched the world deck, spending 2 Supply')
        expect(search({})).toBe('searched the world deck, spending 2 Supply')
    })

    it('names the banners the spoils seized', () => {
        const spoils = (metadata: Record<string, unknown>) =>
            describeAction(action({ type: ActionType.CampaignResolveVictory, playerId: 'p1', metadata: { warbandsPlaced: 0, seizeBurned: 0, favorBurned: 0, relicsTaken: [], bannersSeized: [], ...metadata } }), nameOf)
        expect(spoils({ relicsTaken: ['relic.book-of-records'], bannersSeized: ['darkestSecret'] })).toBe('took the spoils, taking Book of Records and seizing the Darkest Secret')
        expect(spoils({ bannersSeized: ['darkestSecret'] })).toBe('took the spoils, seizing the Darkest Secret')
    })

    describe('a power row names its card, its printed cost, and what it did to whom', () => {
        const wolves = (actor: string, target: string, summary: string, viewer?: string) =>
            describeAction(action({ type: ActionType.UseActionPower, playerId: actor, cardId: 'denizen.beast.wolves', powerIndex: 0, metadata: { summary, targetPlayerId: target } }), nameOf, viewer)

        it('names another seat’s board, or “your” board for that seat', () => {
            expect(wolves('p1', 'p2', "killed a warband on p2's board")).toBe("used Wolves, placing a secret on it: killed a warband on Bob's board")
            expect(wolves('p1', 'p2', "killed a warband on p2's board", 'p2')).toBe('used Wolves, placing a secret on it: killed a warband on your board')
        })

        it('says “their own” for the actor’s board, “your own” to the actor', () => {
            expect(wolves('p1', 'p1', "killed a warband on p1's board", 'p2')).toBe('used Wolves, placing a secret on it: killed a warband on their own board')
            expect(wolves('p1', 'p1', "killed a warband on p1's board", 'p1')).toBe('used Wolves, placing a secret on it: killed a warband on your own board')
        })

        it('says plainly when nothing happened', () => {
            expect(wolves('p1', 'p2', "p2's board held no warbands")).toBe("used Wolves, placing a secret on it: Bob's board held no warbands")
        })

        it('names the seat a power took from', () => {
            const sleight = describeAction(action({ type: ActionType.UseActionPower, playerId: 'p1', cardId: 'denizen.discord.sleight-of-hand', powerIndex: 0, metadata: { summary: 'took 1 secret from p2', targetPlayerId: 'p2' } }), nameOf)
            expect(sleight).toBe('used Sleight of Hand, placing a favor on it: took 1 secret from Bob')
        })

        it('names a Rest power’s card once and its bank by its printed name', () => {
            const rest = describeAction(action({ type: ActionType.UseRestPower, playerId: 'p1', cardId: 'denizen.order.vow-of-obedience', powerIndex: 1, metadata: { summary: 'Vow of Obedience: took 1 favor from the order bank' } }), nameOf)
            expect(rest).toBe('rested with Vow of Obedience: took 1 favor from the Order bank')
        })
    })

    describe('a power row names every seat in it, and only the viewer reads “you”', () => {
        const ENCHANTRESS_SWAP = (() => {
            const state = testState([
                testPlayer({ playerId: 'p1', siteId: 'c1', secrets: 1, advisers: [{ cardId: 'denizen.discord.enchantress', faceUp: true }] }),
                testPlayer({ playerId: 'p2', color: Color.Blue, siteId: 'c1', advisers: [{ cardId: 'denizen.beast.wolves', faceUp: true }] }),
                testPlayer({ playerId: 'p3', color: Color.Yellow, siteId: 'c1' })
            ])
            const use = new HydratedUseActionPower(buildAction(UseActionPower, { playerId: 'p1', cardId: 'denizen.discord.enchantress', powerIndex: powerIndexOf('denizen.discord.enchantress', PowerTiming.Action), choices: [{ kind: PowerChoiceKind.Card, cardId: 'denizen.beast.wolves' }] }))
            use.apply(state)
            return use.metadata?.summary ?? ''
        })()

        const names = { ...nameOf, site: (slotId: string) => (slotId === 'slot.cradle.0' ? 'Plains' : slotId) }
        const effect = (cardId: string, summary: string, viewer: string) => {
            const line = describeAction(action({ type: ActionType.UseActionPower, playerId: 'p1', cardId, powerIndex: 0, metadata: { summary } }), names, viewer)
            return line.slice(line.indexOf(': ') + 2)
        }

        // Alice (p1) acts; Bob (p2) is the seat acted on; Cass (p3) is a third seat.
        const ROWS: Array<{ card: string; summary: string; actor: string; target: string; third: string }> = [
            {
                card: 'denizen.order.palanquin',
                summary: "Palanquin: p1 and p2 went to slot.cradle.0, spending no Supply (Boiling Lake: killed 2 warbands on p2's board)",
                actor: "you and Bob went to Plains, spending no Supply (Boiling Lake: killed 2 warbands on Bob's board)",
                target: 'Alice and you went to Plains, spending no Supply (Boiling Lake: killed 2 warbands on your board)',
                third: "Alice and Bob went to Plains, spending no Supply (Boiling Lake: killed 2 warbands on Bob's board)"
            },
            {
                card: 'denizen.order.palanquin',
                summary: "Palanquin: p1 went to slot.cradle.0; the Shrouded Wood's ruler chooses p2's destination",
                actor: "you went to Plains; the Shrouded Wood's ruler chooses Bob's destination",
                target: "Alice went to Plains; the Shrouded Wood's ruler chooses your destination",
                third: "Alice went to Plains; the Shrouded Wood's ruler chooses Bob's destination"
            },
            {
                card: 'denizen.arcane.dream-thief',
                summary: 'Dream Thief: swapped facedown advisers between p2 and p3',
                actor: 'swapped facedown advisers between Bob and Cass',
                target: 'swapped facedown advisers between you and Cass',
                third: 'swapped facedown advisers between Bob and you'
            },
            {
                card: 'denizen.arcane.dream-thief',
                summary: 'Dream Thief: both advisers belonged to p2, so nothing moved',
                actor: 'both advisers belonged to Bob, so nothing moved',
                target: 'both advisers belonged to you, so nothing moved',
                third: 'both advisers belonged to Bob, so nothing moved'
            },
            {
                card: 'denizen.arcane.inquisitor',
                summary: "Inquisitor: peeked at p2's adviser, not the Conspiracy; gave p2 1 favor",
                actor: "peeked at Bob's adviser, not the Conspiracy; gave Bob 1 favor",
                target: 'peeked at your adviser, not the Conspiracy; gave you 1 favor',
                third: "peeked at Bob's adviser, not the Conspiracy; gave Bob 1 favor"
            },
            {
                card: 'denizen.arcane.inquisitor',
                summary: "Inquisitor: p2's adviser is the Conspiracy — play it, or discard it",
                actor: "Bob's adviser is the Conspiracy — play it, or discard it",
                target: 'your adviser is the Conspiracy — play it, or discard it',
                third: "Bob's adviser is the Conspiracy — play it, or discard it"
            },
            {
                card: 'denizen.beast.pied-piper',
                summary: "Pied Piper: moved to p2's advisers and took 2 favor from p2",
                actor: "moved to Bob's advisers and took 2 favor from Bob",
                target: 'moved to your advisers and took 2 favor from you',
                third: "moved to Bob's advisers and took 2 favor from Bob"
            },
            {
                card: 'relic.whistle',
                summary: 'Whistle: p2 travelled to slot.cradle.0, gaining 1 secret',
                actor: 'Bob travelled to Plains, gaining 1 secret',
                target: 'you travelled to Plains, gaining 1 secret',
                third: 'Bob travelled to Plains, gaining 1 secret'
            },
            {
                card: 'denizen.discord.enchantress',
                summary: ENCHANTRESS_SWAP,
                actor: "Enchantress went to Bob's advisers; Wolves to your own advisers",
                target: "Enchantress went to your advisers; Wolves to Alice's advisers",
                third: "Enchantress went to Bob's advisers; Wolves to Alice's advisers"
            },
            {
                card: 'relic.whistle',
                summary: 'Whistle: p2 cannot travel to slot.cradle.0',
                actor: 'Bob cannot travel to Plains',
                target: 'you cannot travel to Plains',
                third: 'Bob cannot travel to Plains'
            },
            {
                card: 'denizen.arcane.witchs-bargain',
                summary: "Witch's Bargain: with p2, gave 1 secrets for 2 favor and 0 favor for 0 secrets",
                actor: 'with Bob, gave 1 secrets for 2 favor and 0 favor for 0 secrets',
                target: 'with you, gave 1 secrets for 2 favor and 0 favor for 0 secrets',
                third: 'with Bob, gave 1 secrets for 2 favor and 0 favor for 0 secrets'
            },
            {
                card: 'denizen.discord.relic-thief',
                summary: 'Relic Thief: rolled 1 shields; relic.brass-horse stayed with p2',
                actor: 'rolled 1 shields; Brass Horse stayed with Bob',
                target: 'rolled 1 shields; Brass Horse stayed with you',
                third: 'rolled 1 shields; Brass Horse stayed with Bob'
            },
            {
                card: 'denizen.arcane.terror-spells',
                summary: "Terror Spells: killed 2 warbands in p1's region",
                actor: 'killed 2 warbands in your own region',
                target: 'killed 2 warbands in their own region',
                third: 'killed 2 warbands in their own region'
            },
            {
                card: 'denizen.hearth.a-round-of-ale',
                summary: "A Round of Ale: returned 3 favor to the banks and 2 secrets to p1's board",
                actor: 'returned 3 favor to the banks and 2 secrets to your own board',
                target: 'returned 3 favor to the banks and 2 secrets to their own board',
                third: 'returned 3 favor to the banks and 2 secrets to their own board'
            },
            {
                card: 'denizen.nomad.oracle',
                summary: 'Oracle: drew the next Vision; keep it or discard it as if p1 had searched',
                actor: 'drew the next Vision; keep it or discard it as if you had searched',
                target: 'drew the next Vision; keep it or discard it as if Alice had searched',
                third: 'drew the next Vision; keep it or discard it as if Alice had searched'
            }
        ]

        it.each(ROWS)('$summary', (row) => {
            expect(effect(row.card, row.summary, 'p1')).toBe(row.actor)
            expect(effect(row.card, row.summary, 'p2')).toBe(row.target)
            expect(effect(row.card, row.summary, 'p3')).toBe(row.third)
        })

        it('prints a display name as written, even one with replacement patterns in it', () => {
            const odd = "B$&b $' $$ $1"
            const named = { ...names, player: (playerId: string) => (playerId === 'p2' ? odd : nameOf.player(playerId)) }
            const line = describeAction(action({ type: ActionType.UseActionPower, playerId: 'p1', cardId: 'denizen.beast.pied-piper', powerIndex: 0, metadata: { summary: "Pied Piper: moved to p2's advisers and took 2 favor from p2" } }), named, 'p3')
            expect(line).toContain(`moved to ${odd}'s advisers and took 2 favor from ${odd}`)
        })
    })

    describe('an answer row names every seat in it, and only the viewer reads “you”', () => {
        const SHROUDED_WOOD = 'site.shrouded-wood'
        const RELIC = 'relic.cup-of-plenty'

        // Alice (p1) answers; Bob (p2) is the other seat the answer names; Cass (p3) is a third seat.
        function answered(question: PowerQuestion, answer: QuestionAnswer, setup: { p1?: Partial<OathPlayerState>; p3?: Partial<OathPlayerState>; denizensBySite?: Record<string, string[]> } = {}): string {
            const state = testState(
                [
                    testPlayer({ playerId: 'p1', siteId: 'c1', favor: 4, ...setup.p1 }),
                    testPlayer({ playerId: 'p2', color: Color.Blue, siteId: 'c1', favor: 4 }),
                    testPlayer({ playerId: 'p3', color: Color.Yellow, siteId: 'c1', ...setup.p3 })
                ],
                { siteCards: { c1: SHROUDED_WOOD, c2: 'site.plains', h1: 'site.mountain' }, denizensBySite: { c1: [], c2: [], h1: [], ...setup.denizensBySite } }
            )
            state.pendingQuestions = { queue: [question], askingPlayerId: 'p2', resumeMachineState: MachineState.ActPhase }
            const answer_ = new HydratedAnswerQuestion(buildAction(AnswerQuestion, { playerId: 'p1', answer }))
            answer_.apply(state)
            return answer_.metadata?.summary ?? ''
        }

        const row = (cardId: string, summary: string, viewer: string, names = nameOf) => {
            const line = describeAction(action({ type: ActionType.AnswerQuestion, playerId: 'p1', answer: { kind: PowerQuestionKind.Exchange, accept: true }, metadata: { cardId, kind: PowerQuestionKind.Exchange, summary, resumeMachineState: MachineState.ActPhase, last: true } }), names, viewer)
            return line.slice(line.indexOf(': ') + 2)
        }

        const ROWS: Array<{ name: string; card: string; summary: () => string; answerer: string; other: string; third: string }> = [
            {
                name: 'Shrouded Wood: the ruler sends the traveler',
                card: SHROUDED_WOOD,
                summary: () => answered({ kind: PowerQuestionKind.ShroudedWoodDestination, cardId: SHROUDED_WOOD, askedPlayerId: 'p1', travelerPlayerId: 'p2', fromSiteId: 'c1' }, { kind: PowerQuestionKind.ShroudedWoodDestination, siteId: 'c2' }),
                answerer: 'sent Bob to c2',
                other: 'sent you to c2',
                third: 'sent Bob to c2'
            },
            {
                name: 'an exchange refused',
                card: 'denizen.nomad.the-gathering',
                summary: () => answered({ kind: PowerQuestionKind.Exchange, cardId: 'denizen.nomad.the-gathering', askedPlayerId: 'p1', proposerPlayerId: 'p2', terms: {} }, { kind: PowerQuestionKind.Exchange, accept: false }),
                answerer: "refused Bob's exchange",
                other: 'refused your exchange',
                third: "refused Bob's exchange"
            },
            {
                name: 'an exchange proposed',
                card: 'denizen.nomad.the-gathering',
                summary: () => answered({ kind: PowerQuestionKind.GatheringFloor, cardId: 'denizen.nomad.the-gathering', askedPlayerId: 'p1', siteId: 'c1' }, { kind: PowerQuestionKind.GatheringFloor, proposal: { withPlayerId: 'p2', terms: { fromProposer: { favor: 1 } } } }),
                answerer: 'proposed an exchange to Bob',
                other: 'proposed an exchange to you',
                third: 'proposed an exchange to Bob'
            },
            {
                name: 'a relic let go rather than paid for',
                card: 'denizen.discord.blackmail',
                summary: () => answered({ kind: PowerQuestionKind.PayOrLoseRelic, cardId: 'denizen.discord.blackmail', askedPlayerId: 'p1', takerPlayerId: 'p2', relicCardId: RELIC, price: 2 }, { kind: PowerQuestionKind.PayOrLoseRelic, pay: false }, { p1: { relicIds: [RELIC] } }),
                answerer: 'let Bob take Cup of Plenty',
                other: 'let you take Cup of Plenty',
                third: 'let Bob take Cup of Plenty'
            },
            {
                name: 'a Sneak Attack passed on',
                card: 'denizen.discord.sneak-attack',
                summary: () => answered({ kind: PowerQuestionKind.SneakAttack, cardId: 'denizen.discord.sneak-attack', askedPlayerId: 'p1', defenderPlayerId: 'p2' }, { kind: PowerQuestionKind.SneakAttack, campaign: false }),
                answerer: 'passed on a Sneak Attack against Bob',
                other: 'passed on a Sneak Attack against you',
                third: 'passed on a Sneak Attack against Bob'
            },
            {
                name: 'a free travel whose site hurts the answerer',
                card: 'relic.brass-horse',
                summary: () => answered({ kind: PowerQuestionKind.TravelFreeTo, cardId: 'relic.brass-horse', askedPlayerId: 'p1', siteIds: ['c2'] }, { kind: PowerQuestionKind.TravelFreeTo, siteId: 'c2' }, { p1: { warbandsOnBoard: { p1: 3 } }, denizensBySite: { c2: ['denizen.discord.boiling-lake'] } }),
                answerer: 'travelled to c2 for no Supply (Boiling Lake: killed 2 warbands on your own board)',
                other: 'travelled to c2 for no Supply (Boiling Lake: killed 2 warbands on their own board)',
                third: 'travelled to c2 for no Supply (Boiling Lake: killed 2 warbands on their own board)'
            },
            {
                name: 'a relic kept, and a Relic Thief who cannot roll for it',
                card: 'relic.cup-of-plenty',
                summary: () => answered({ kind: PowerQuestionKind.KeepOrBottomRelic, cardId: RELIC, askedPlayerId: 'p1', relicCardId: RELIC }, { kind: PowerQuestionKind.KeepOrBottomRelic, keep: true }, { p1: { advisers: [{ cardId: 'denizen.nomad.lost-tongue', faceUp: true }] }, p3: { advisers: [{ cardId: 'denizen.discord.relic-thief', faceUp: true }] } }),
                answerer: "took Cup of Plenty (Relic Thief: Cass cannot use Relic Thief: Lost Tongue: its holder's relics and banners cannot be taken without ruling a nomad card)",
                other: "took Cup of Plenty (Relic Thief: Cass cannot use Relic Thief: Lost Tongue: its holder's relics and banners cannot be taken without ruling a nomad card)",
                third: "took Cup of Plenty (Relic Thief: you cannot use Relic Thief: Lost Tongue: its holder's relics and banners cannot be taken without ruling a nomad card)"
            },
            {
                name: 'the Conspiracy played with a take',
                card: 'denizen.arcane.inquisitor',
                summary: () => 'played the Conspiracy and took from p2',
                answerer: 'played the Conspiracy and took from Bob',
                other: 'played the Conspiracy and took from you',
                third: 'played the Conspiracy and took from Bob'
            },
            {
                name: 'the Conspiracy played as an adviser, facedown',
                card: 'denizen.arcane.inquisitor',
                summary: () => answered({ kind: PowerQuestionKind.PlayOrDiscardConspiracy, cardId: 'denizen.arcane.inquisitor', askedPlayerId: 'p1', holderPlayerId: 'p3', index: 0 }, { kind: PowerQuestionKind.PlayOrDiscardConspiracy, play: true, facedown: true }, { p3: { advisers: [{ cardId: 'vision.conspiracy', faceUp: false }] } }),
                answerer: 'played the Conspiracy as an adviser, facedown',
                other: 'played the Conspiracy as an adviser, facedown',
                third: 'played the Conspiracy as an adviser, facedown'
            },
            {
                name: 'a Relic Thief roll that failed',
                card: 'denizen.discord.relic-thief',
                summary: () => `Relic Thief: rolled 1 shields; ${RELIC} stayed with p2`,
                answerer: 'rolled 1 shields; Cup of Plenty stayed with Bob',
                other: 'rolled 1 shields; Cup of Plenty stayed with you',
                third: 'rolled 1 shields; Cup of Plenty stayed with Bob'
            },
            {
                name: 'a Jinx reroll declined on a Relic Thief roll that took',
                card: 'denizen.arcane.jinx',
                summary: () => `kept the roll; Relic Thief: rolled no shields and took ${RELIC} from p2`,
                answerer: 'kept the roll; Relic Thief: rolled no shields and took Cup of Plenty from Bob',
                other: 'kept the roll; Relic Thief: rolled no shields and took Cup of Plenty from you',
                third: 'kept the roll; Relic Thief: rolled no shields and took Cup of Plenty from Bob'
            }
        ]

        it.each(ROWS)('$name', (entry) => {
            const summary = entry.summary()
            expect(row(entry.card, summary, 'p1')).toBe(entry.answerer)
            expect(row(entry.card, summary, 'p2')).toBe(entry.other)
            expect(row(entry.card, summary, 'p3')).toBe(entry.third)
        })

        it('names the traveler in a recorded Shrouded Wood answer instead of printing their id', () => {
            const traveler = 'fkylqsgcyczM0R0_40ImG'
            const names = { player: (playerId: string) => (playerId === traveler ? 'Dana' : nameOf.player(playerId)), site: (slotId: string) => (slotId === 'slot.cradle.0' ? 'The Tribunal' : slotId), seats: ['p1', traveler] }
            const line = (viewer: string) => describeAction(action({ type: ActionType.AnswerQuestion, playerId: 'p1', answer: { kind: PowerQuestionKind.ShroudedWoodDestination, siteId: 'slot.cradle.0' }, metadata: { cardId: SHROUDED_WOOD, kind: PowerQuestionKind.ShroudedWoodDestination, summary: `sent ${traveler} to slot.cradle.0`, resumeMachineState: MachineState.ActPhase, last: true } }), names, viewer)
            expect(line('p1')).toBe('Shrouded Wood: sent Dana to The Tribunal')
            expect(line(traveler)).toBe('Shrouded Wood: sent you to The Tribunal')
        })

        it('names an id that begins another seat’s id as its own seat', () => {
            const names = { ...nameOf, player: (playerId: string) => ({ p1: 'Alice', p10: 'Jo' })[playerId] ?? playerId, seats: ['p1', 'p10'] }
            expect(row(SHROUDED_WOOD, 'sent p10 to c2', 'p1', names)).toBe('sent Jo to c2')
            expect(row(SHROUDED_WOOD, 'sent p10 to c2', 'p10', names)).toBe('sent you to c2')
        })

        it('prints a display name as written, even one with replacement patterns in it', () => {
            const odd = "B$&b $' $$ $1"
            const names = { ...nameOf, player: (playerId: string) => (playerId === 'p2' ? odd : nameOf.player(playerId)) }
            expect(row(SHROUDED_WOOD, "refused p2's exchange", 'p3', names)).toBe(`refused ${odd}'s exchange`)
        })

        it('keeps the “you” an older record was written with', () => {
            const summary = "took relic.cup-of-plenty (Relic Thief: p3 cannot use Relic Thief: Lost Tongue: you cannot take its holder's relics or banners without ruling a nomad card)"
            expect(row(RELIC, summary, 'p2')).toBe("took Cup of Plenty (Relic Thief: Cass cannot use Relic Thief: Lost Tongue: you cannot take its holder's relics or banners without ruling a nomad card)")
        })
    })

    it('names players rather than printing their ids', () => {
        expect(
            describeAction(
                action({ type: ActionType.ExileCitizen, playerId: 'p1', citizenPlayerId: 'p2' }),
                nameOf
            )
        ).toBe('exiled Bob')
    })

    it('R-4.1.3 — says when the title flipped to Usurper', () => {
        const text = describeAction(
            action({
                type: ActionType.ResolveWake,
                playerId: 'p1',
                favorSteps: [],
                metadata: { flippedToUsurper: true }
            }),
            nameOf
        )
        expect(text).toContain('Usurper')
    })

    it('R-4.1.1, R-4.1.4 — the Wake says each People’s Favor step and the site’s take, from its own record', () => {
        const wake = (fields: Record<string, unknown>) =>
            describeAction(action({ type: ActionType.ResolveWake, playerId: 'p1', ...fields }), nameOf)
        expect(
            wake({
                favorSteps: [{ kind: 'place' }, { kind: 'return', toSuit: Suit.Order }],
                sitePowerTake: 'secret'
            })
        ).toBe(
            'began the turn; placed 1 favor on the People’s Favor; returned 1 favor to the Order bank; took 1 secret from their site'
        )
        expect(wake({ favorSteps: [], sitePowerTake: 'favor' })).toBe(
            'began the turn; took 1 favor from their site'
        )
        expect(wake({ favorSteps: [{ kind: 'place' }], metadata: { flippedToMob: true } })).toBe(
            'began the turn; placed 1 favor on the People’s Favor — the People’s Favor flipped to Mob'
        )
    })

    it('R-4.1.2 — a Wake that won the game took nothing from the site', () => {
        expect(
            describeAction(
                action({
                    type: ActionType.ResolveWake,
                    playerId: 'p1',
                    favorSteps: [],
                    sitePowerTake: 'favor',
                    metadata: { wonBy: 'R-3.1' }
                }),
                nameOf
            )
        ).toBe('began the turn')
    })

    it('never says "their" about the acting player', () => {
        // Listed, not banned by regex: a Campaign's "their" is the defender's.
        const cases: Array<[ActionType, Record<string, unknown>, string]> = [
            [ActionType.ResolveWake, { favorSteps: [] }, 'began the turn'],
            [ActionType.EndActPhase, {}, 'ended the Act Phase'],
            [
                ActionType.SetupChoice,
                { siteId: 'c1', adviserCardId: 'x', discardOrder: [] },
                'placed a pawn at c1 and kept one card facedown'
            ],
            [
                ActionType.MoveWarbands,
                { move: { kind: 'siteToBoard' }, owner: 'p1', count: 2 },
                'moved 2 warbands from site to board'
            ],
            [
                ActionType.MoveWarbands,
                { move: { kind: 'boardToSite' }, owner: 'p2', count: 2 },
                "moved 2 of Bob's warbands from board to site"
            ]
        ]
        for (const [type, fields, expected] of cases) {
            expect(describeAction(action({ type, playerId: 'p1', ...fields }), nameOf)).toBe(
                expected
            )
        }
    })

    it('R-9.4 — names a shown adviser only to a viewer who saw it', () => {
        const shown = { type: ActionType.LetPeek, playerId: 'p1', toPlayerId: 'p2' }
        expect(describeAction(action({ ...shown, subject: { kind: 'adviser', cardId: CARD } }), nameOf, 'p2')).toBe(
            'let Bob peek at Errand Boy'
        )
        expect(describeAction(action({ ...shown, subject: { kind: 'adviser', cardId: CARD } }), nameOf, 'p3')).toBe(
            'let Bob peek at a facedown adviser'
        )
        expect(describeAction(action({ ...shown, subject: { kind: 'adviser' } }), nameOf)).toBe(
            'let Bob peek at a facedown adviser'
        )
    })

    it('R-6.6.1 — names a Reliquary relic to the Exile shown it, not to the Scepter holder', () => {
        const relic = action({ type: ActionType.LetPeek, playerId: 'p1', toPlayerId: 'p2', subject: { kind: 'reliquary', slotId: 'reliquary.0' }, metadata: { relicCardId: 'relic.brass-horse' } })
        expect(describeAction(relic, nameOf, 'p2')).toMatch(/\(Brass Horse\)$/)
        expect(describeAction(relic, nameOf, 'p1')).not.toMatch(/\(/)
        expect(describeAction(relic, nameOf, 'p3')).not.toMatch(/\(/)
    })

    it('pluralises warbands', () => {
        expect(
            describeAction(
                action({
                    type: ActionType.MoveWarbands,
                    playerId: 'p1',
                    move: { kind: 'boardToSite' },
                    owner: IMPERIAL_WARBANDS,
                    count: 1
                }),
                nameOf
            )
        ).toBe('moved 1 Imperial warband from board to site')
    })

    it('R-5.6.2 — names the site a Travel revealed, and its relics', () => {
        expect(
            describeAction(
                action({
                    type: ActionType.Travel,
                    playerId: 'p1',
                    siteId: 'slot.cradle.1',
                    metadata: {
                        supplySpent: 1,
                        supplyRemaining: 6,
                        revealedSiteCardId: 'site.mine',
                        relicsRevealed: 1
                    }
                }),
                nameOf
            )
        ).toBe(
            'travelled to Cradle 2, spending 1 Supply — revealing Mine and 1 facedown relic'
        )
    })

    describe('R-7.1.4 — a Travel names each toll it paid and a secret it flipped', () => {
        const travel = (metadata: Record<string, unknown>) =>
            describeAction(
                action({
                    type: ActionType.Travel,
                    playerId: 'p1',
                    siteId: 'slot.provinces.1',
                    metadata: { supplySpent: 2, supplyRemaining: 4, ...metadata }
                }),
                nameOf
            )

        it('a toll given to a player names them and the card', () => {
            expect(travel({ tollsPaid: ['denizen.order.toll-roads: gave a favor to p2'] })).toBe(
                'travelled to Provinces 2, spending 2 Supply; 1 favor to Bob (Toll Roads)'
            )
        })

        it('a toll the bandits rule is burned', () => {
            expect(
                travel({ tollsPaid: ['denizen.order.toll-roads: burned a favor for the bandits'] })
            ).toBe('travelled to Provinces 2, spending 2 Supply; burned 1 favor (Toll Roads)')
        })

        it('two tolls are two clauses, in the record’s order', () => {
            expect(
                travel({
                    tollsPaid: [
                        'denizen.order.toll-roads: gave a favor to p2',
                        'denizen.nomad.way-station: gave a favor to p3'
                    ]
                })
            ).toBe(
                'travelled to Provinces 2, spending 2 Supply; 1 favor to Bob (Toll Roads); 1 favor to Cass (Way Station)'
            )
        })

        it('a flipped secret is named after the tolls', () => {
            expect(travel({ secretFlipped: true })).toBe(
                'travelled to Provinces 2, spending 2 Supply; flipped 1 secret'
            )
        })

        it('a note of another shape is not printed, and a record without tolls reads as before', () => {
            expect(travel({ tollsPaid: ['something else'] })).toBe(
                'travelled to Provinces 2, spending 2 Supply'
            )
            expect(travel({})).toBe('travelled to Provinces 2, spending 2 Supply')
        })
    })

    it('describes an action that has no metadata yet', () => {
        expect(() =>
            describeAction(
                action({ type: ActionType.Travel, playerId: 'p1', siteId: 'c1' }),
                nameOf
            )
        ).not.toThrow()
        expect(
            describeAction(
                action({ type: ActionType.Travel, playerId: 'p1', siteId: 'c1' }),
                nameOf
            )
        ).toBe('travelled to c1')
    })

    describe('R-9.4 — never names a card the game did not show', () => {
        // Checked by absence, not exact strings, so a rewording cannot bring the card back.
        const HIDDEN = 'denizen.order.secret-police'
        // Lines print a card's name, never its id.
        const SHOWN = 'Secret Police'

        it('R-1.23.2 — the setup adviser is kept facedown, so it is never named', () => {
            const line = describeAction(
                action({
                    type: ActionType.SetupChoice,
                    playerId: 'p1',
                    siteId: 'slot.cradle.0',
                    adviserCardId: HIDDEN,
                    discardOrder: ['a', 'b'],
                    metadata: { discardPileRegion: 'provinces' }
                }),
                nameOf
            )
            expect(line).not.toContain(SHOWN)
            expect(line).toContain('facedown')
        })

        it('R-5.1.4.II — a facedown adviser is not named, a faceup one is', () => {
            const facedown = describeAction(
                action({
                    type: ActionType.SearchResolve,
                    playerId: 'p1',
                    keptCardId: HIDDEN,
                    discardOrder: [],
                    play: SearchPlay.Adviser,
                    faceUp: false
                }),
                nameOf
            )
            expect(facedown).not.toContain(SHOWN)

            const faceup = describeAction(
                action({
                    type: ActionType.SearchResolve,
                    playerId: 'p1',
                    keptCardId: HIDDEN,
                    discardOrder: [],
                    play: SearchPlay.Adviser,
                    faceUp: true,
                    metadata: { playedCardId: HIDDEN }
                }),
                nameOf
            )
            expect(faceup).toContain(SHOWN)
        })

        it('R-5.1.4, R-10.5 — the discards: the region and count for everyone, the cards for the searcher alone', () => {
            const resolve = (metadata: Record<string, unknown>) =>
                action({
                    type: ActionType.SearchResolve,
                    playerId: 'p1',
                    keptCardId: 'x',
                    discardOrder: [],
                    play: SearchPlay.Adviser,
                    metadata: { discardedCount: 2, discardPileRegion: 'cradle', ...metadata }
                })
            const seen = resolve({ discardedCardIds: [HIDDEN, HIDDEN] })
            expect(describeAction(seen, nameOf, 'p1')).toContain(`${SHOWN}, ${SHOWN} went to the cradle discard pile`)
            const projected = resolve({})
            expect(describeAction(projected, nameOf, 'p2')).toContain('2 cards went to the cradle discard pile')
            expect(describeAction(seen, nameOf, 'p2')).not.toContain(SHOWN)
            expect(describeAction(resolve({ discardedCardIds: [HIDDEN], discardedCount: 1, discardToWorldDeck: true }), nameOf, 'p2')).toContain(
                '1 card went to the bottom of the world deck'
            )
            expect(describeAction(resolve({ discardedCardIds: [], discardedCount: 0 }), nameOf, 'p1')).not.toContain('went to')
        })

        it('R-5.1.4 — a card kept and then discarded is never named', () => {
            const line = describeAction(
                action({
                    type: ActionType.SearchResolve,
                    playerId: 'p1',
                    keptCardId: HIDDEN,
                    discardOrder: [],
                    play: SearchPlay.Discard
                }),
                nameOf
            )
            expect(line).not.toContain(SHOWN)
        })

        it('R-5.1.4.I — a card played to a site is named; it is on the board', () => {
            const line = describeAction(
                action({
                    type: ActionType.SearchResolve,
                    playerId: 'p1',
                    keptCardId: HIDDEN,
                    discardOrder: [],
                    play: SearchPlay.Site,
                    metadata: { playedCardId: HIDDEN }
                }),
                nameOf
            )
            expect(line).toContain(SHOWN)
        })

        it('R-6.1 — turning a facedown adviser faceup names it; discarding it does not', () => {
            expect(
                describeAction(
                    action({
                        type: ActionType.PlayFacedownAdviser,
                        playerId: 'p1',
                        cardId: HIDDEN,
                        play: SearchPlay.Adviser,
                        metadata: { playedCardId: HIDDEN }
                    }),
                    nameOf
                )
            ).toContain(SHOWN)

            expect(
                describeAction(
                    action({
                        type: ActionType.PlayFacedownAdviser,
                        playerId: 'p1',
                        cardId: HIDDEN,
                        play: SearchPlay.Discard
                    }),
                    nameOf
                )
            ).not.toContain(SHOWN)
        })

        it('R-6.7, R-6.8 — the exile lines carry the price', () => {
            // R-6.7 — the exiler pays the Citizen; neither price can be read back off the board.
            expect(
                describeAction(
                    action({
                        type: ActionType.ExileCitizen,
                        playerId: 'p1',
                        citizenPlayerId: 'p2',
                        metadata: { favorGiven: 4, replacedCount: 3, unreplacedCount: 0 }
                    }),
                    nameOf
                )
            ).toBe('exiled Bob, giving them 4 favor')

            expect(
                describeAction(
                    action({
                        type: ActionType.SelfExile,
                        playerId: 'p1',
                        metadata: { favorGiven: 4, replacedCount: 3, unreplacedCount: 0 }
                    }),
                    nameOf
                )
            ).toBe('went into exile, giving 4 favor to the Grand Scepter’s holder')
        })

        it('R-9.3 — warbands left Imperial for want of the player’s own', () => {
            expect(
                describeAction(
                    action({
                        type: ActionType.SelfExile,
                        playerId: 'p1',
                        metadata: { favorGiven: 2, replacedCount: 1, unreplacedCount: 3 }
                    }),
                    nameOf
                )
            ).toContain('with 3 warbands left Imperial')
        })

        it('R-6.7-H1 — says where an exile’s leftover Imperial warbands went', () => {
            const exile = (metadata: Record<string, unknown>) =>
                describeAction(action({ type: ActionType.SelfExile, playerId: 'p1', metadata: { favorGiven: 0, unreplacedCount: 2, endsActPhase: true, ...metadata } }), nameOf)
            expect(exile({})).toBe('went into exile, with 2 warbands left Imperial')
            expect(exile({ unreplacedReturned: true })).toBe('went into exile, returning 2 Imperial warbands to the Chancellor’s bank')
            expect(exile({ unreplacedCount: 1, unreplacedReturned: true })).toBe('went into exile, returning 1 Imperial warband to the Chancellor’s bank')
        })

        it('R-6.7-H1 — an exile’s row keeps today’s words before revision 5 and names the Chancellor’s bank from it', () => {
            // p1 holds the Grand Scepter; p2's board holds 16 Imperial warbands against 14 of their own.
            const row = (oathRevision: OathRevision, exile: 'self' | 'exiled') => {
                const state = testState(
                    [
                        testPlayer({ playerId: 'p1', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'c2', favor: 10, relicIds: ['relic.grand-scepter'], warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 5 } }),
                        testPlayer({ playerId: 'p2', color: Color.Red, status: PlayerStatus.Citizen, siteId: 'c1', favor: 20, warbandsOnBoard: { [IMPERIAL_WARBANDS]: 16 }, warbandsInPersonalBank: { p2: 14 } })
                    ],
                    { oathRevision, chancellorPlayerId: 'p1' }
                )
                const applied =
                    exile === 'self'
                        ? new HydratedSelfExile(buildAction(SelfExile, { playerId: 'p2' }))
                        : new HydratedExileCitizen(buildAction(ExileCitizen, { playerId: 'p1', citizenPlayerId: 'p2' }))
                applied.apply(state)
                return describeAction(applied.dehydrate(), nameOf)
            }

            expect(row(OathRevision.CardFixes1, 'self')).toBe('went into exile, giving 16 favor to the Grand Scepter’s holder, with 2 warbands left Imperial')
            expect(row(OathRevision.EngineFixes2, 'self')).toBe('went into exile, giving 16 favor to the Grand Scepter’s holder, returning 2 Imperial warbands to the Chancellor’s bank')
            expect(row(OathRevision.CardFixes1, 'exiled')).toBe('exiled Bob, giving them 5 favor, with 2 warbands left Imperial')
            expect(row(OathRevision.EngineFixes2, 'exiled')).toBe('exiled Bob, giving them 5 favor, returning 2 Imperial warbands to the Chancellor’s bank')
        })

        it('R-6.1 — names the card in place, with no dangling "it"', () => {
            const play = (p: SearchPlay) =>
                describeAction(
                    action({
                        type: ActionType.PlayFacedownAdviser,
                        playerId: 'p1',
                        cardId: 'denizen.beast.errand-boy',
                        play: p,
                        metadata: p === SearchPlay.Discard ? {} : { playedCardId: 'denizen.beast.errand-boy' }
                    }),
                    nameOf
                )

            expect(play(SearchPlay.Site)).toBe('played Errand Boy to their site')
            expect(play(SearchPlay.Adviser)).toBe(
                'turned Errand Boy faceup as an adviser'
            )
            // R-10.5 — a discarded card is never named, so nothing is placed.
            expect(play(SearchPlay.Discard)).toBe('discarded a card')
        })

        it('R-6.1 — a facedown site play under Book of Records says it gained a secret, and why', () => {
            const INN = 'denizen.hearth.wayside-inn'
            const row = (oathRevision: OathRevision) => {
                const state = testState(
                    [testPlayer({ playerId: 'p1', color: Color.Red, siteId: 'c1', relicIds: ['relic.book-of-records'], advisers: [{ cardId: INN, faceUp: false }] })],
                    { oathRevision, denizensBySite: { c1: [] } }
                )
                const played = new HydratedPlayFacedownAdviser(buildAction(PlayFacedownAdviser, { playerId: 'p1', cardId: INN, play: SearchPlay.Site }))
                played.apply(state)
                return describeAction(played.dehydrate(), nameOf)
            }

            expect(row(OathRevision.CostsAndFacedownModifiers)).toBe('played Wayside Inn to their site, gaining 1 secret (Book of Records)')
            expect(row(OathRevision.TurnFlow)).toBe('played Wayside Inn to their site, gaining 1 favor')
        })

        it('Land Warden — two cards played to the site under Book of Records: the row counts both secrets from revision 3', () => {
            const LAND_WARDEN = 'denizen.hearth.land-warden'
            const WOLVES = 'denizen.beast.wolves'
            const INN = 'denizen.hearth.wayside-inn'
            const FILLER = 'denizen.order.scouts'
            const row = (oathRevision: OathRevision) => {
                const state = testState(
                    [testPlayer({ playerId: 'p1', color: Color.Red, siteId: 'c1', favor: 3, supply: 6, relicIds: ['relic.book-of-records'], advisers: [{ cardId: LAND_WARDEN, faceUp: true }] })],
                    { oathRevision, denizensBySite: { c1: [] }, siteCards: { c1: 'site.plains' } }
                )
                state.requireVault().worldDeck = [WOLVES, INN, FILLER]
                const modifiers = [{ cardId: LAND_WARDEN, powerIndex: powerIndexOf(LAND_WARDEN, PowerTiming.Modifier) }]
                new HydratedSearch(buildAction(Search, { playerId: 'p1', drawFrom: SearchSource.WorldDeck, revealsInfo: true, modifiers })).apply(state)
                const played = new HydratedSearchResolve(
                    buildAction(SearchResolve, { playerId: 'p1', keptCardId: WOLVES, discardOrder: [FILLER], play: SearchPlay.Site, secondPlay: { cardId: INN, play: SearchPlay.Site } })
                )
                played.apply(state)
                return describeAction(played.dehydrate(), nameOf)
            }

            expect(row(OathRevision.PlanCostsAndSearchPlays)).toBe('kept Wolves and played it to their site, gaining 2 secrets; 1 card went to the provinces discard pile')
            expect(row(OathRevision.CostsAndFacedownModifiers)).toBe('kept Wolves and played it to their site, gaining 1 secret; 1 card went to the provinces discard pile')
        })

        it('R-6.2 — an Action power is named, since only a faceup card has one (R-5.1.4.II)', () => {
            const line = describeAction(
                action({ type: ActionType.UseActionPower, playerId: 'p1', cardId: HIDDEN }),
                nameOf
            )
            expect(line).toContain(SHOWN)
        })

        it('R-5.1.3 — the two discarded cards are never named', () => {
            const line = describeAction(
                action({
                    type: ActionType.SearchResolve,
                    playerId: 'p1',
                    keptCardId: 'denizen.hearth.herald',
                    discardOrder: ['denizen.beast.wolves', 'denizen.nomad.tents'],
                    play: SearchPlay.Site
                }),
                nameOf
            )
            expect(line).not.toContain('denizen.beast.wolves')
            expect(line).not.toContain('denizen.nomad.tents')
        })
    })
})

describe('R-10.13 — whose warbands a History row counts', () => {
    const own = (playerId: string) => (playerId === 'p1' ? IMPERIAL_WARBANDS : playerId)
    const group = (owner: string, count: number) => ({ at: { kind: 'site', siteId: 'c1' }, owner, count })

    it('a warband move counts the owner it names', () => {
        expect(rowWarbandOwner(action({ type: ActionType.MoveWarbands, playerId: 'p2', owner: IMPERIAL_WARBANDS, count: 2, move: { kind: 'siteToBoard', siteId: 'c1' } }), own)).toBe(IMPERIAL_WARBANDS)
    })

    it('a power counts the owner it recorded, a Citizen’s Imperial warbands the Empire’s', () => {
        const wolves = { type: ActionType.UseActionPower, playerId: 'p3', cardId: 'denizen.beast.wolves', powerIndex: 0 }
        expect(rowWarbandOwner(action({ ...wolves, metadata: { summary: "killed a warband on p2's board", targetPlayerId: 'p2', warbandOwner: IMPERIAL_WARBANDS } }), own)).toBe(IMPERIAL_WARBANDS)
        expect(rowWarbandOwner(action({ ...wolves, metadata: { summary: "killed a warband on p1's board", targetPlayerId: 'p1', warbandOwner: IMPERIAL_WARBANDS } }), own)).toBe(IMPERIAL_WARBANDS)
    })

    it('a power recorded with no owner counts the seat it acted on', () => {
        expect(rowWarbandOwner(action({ type: ActionType.UseActionPower, playerId: 'p1', cardId: 'denizen.beast.wolves', powerIndex: 0, metadata: { summary: '', targetPlayerId: 'p2' } }), own)).toBe('p2')
    })

    describe('R-5.2.2 — a Muster counts the owner it recorded, whatever the seat is later', () => {
        function table(status: PlayerStatus) {
            return testState(
                [
                    testPlayer({ playerId: 'p1', status: PlayerStatus.Chancellor, color: Color.Purple, warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 10 } }),
                    testPlayer({ playerId: 'p2', status, color: Color.Blue, siteId: 'c1', favor: 2 })
                ],
                { denizensBySite: { c1: ['card-a'] }, chancellorPlayerId: 'p1' }
            )
        }
        function musterAs(status: PlayerStatus) {
            const state = table(status)
            const muster = new HydratedMuster(buildAction(Muster, { playerId: 'p2', cardId: 'card-a' }))
            muster.apply(state)
            return { state, muster }
        }
        const ownIn = (state: ReturnType<typeof table>) => (playerId: string) => ownWarbandOwner(state, playerId)

        it('an Exile’s Muster keeps their own colour after they become a Citizen', () => {
            const { state, muster } = musterAs(PlayerStatus.Exile)
            state.getPlayerState('p2').status = PlayerStatus.Citizen
            expect(rowWarbandOwner(muster, ownIn(state))).toBe('p2')
        })

        it('a Citizen’s Muster stays Imperial after they are exiled', () => {
            const { state, muster } = musterAs(PlayerStatus.Citizen)
            state.getPlayerState('p2').status = PlayerStatus.Exile
            expect(rowWarbandOwner(muster, ownIn(state))).toBe(IMPERIAL_WARBANDS)
        })

        it('a Muster recorded with no owner counts the actor’s own', () => {
            expect(rowWarbandOwner(action({ type: ActionType.Muster, playerId: 'p2', cardId: CARD }), own)).toBe('p2')
            expect(rowWarbandOwner(action({ type: ActionType.Muster, playerId: 'p1', cardId: CARD }), own)).toBe(IMPERIAL_WARBANDS)
        })
    })

    it('R-9.3 — an exile’s warbands left Imperial are the Empire’s', () => {
        expect(rowWarbandOwner(action({ type: ActionType.SelfExile, playerId: 'p2', metadata: { favorGiven: 0, unreplacedCount: 2 } }), own)).toBe(IMPERIAL_WARBANDS)
        expect(rowWarbandOwner(action({ type: ActionType.ExileCitizen, playerId: 'p1', citizenPlayerId: 'p2', metadata: { favorGiven: 0, unreplacedCount: 2 } }), own)).toBe(IMPERIAL_WARBANDS)
    })

    it('R-5.5.5 — a sacrifice counts the owner the engine recorded killing, a Citizen’s Imperial force the Empire’s', () => {
        const battle = { attack: 4, defense: 3, attackerVictorious: true, sacrificed: 1 }
        expect(rowWarbandOwner(action({ type: ActionType.CampaignSacrifice, playerId: 'p2', sacrifice: 1, metadata: { ...battle, sacrificedOwner: IMPERIAL_WARBANDS } }), own)).toBe(IMPERIAL_WARBANDS)
        expect(rowWarbandOwner(action({ type: ActionType.CampaignSacrifice, playerId: 'p2', sacrifice: 2, sacrificeKills: [group(IMPERIAL_WARBANDS, 2)] }), own)).toBe(IMPERIAL_WARBANDS)
        expect(rowWarbandOwner(action({ type: ActionType.CampaignSacrifice, playerId: 'p2', sacrifice: 2, sacrificeKills: [group(IMPERIAL_WARBANDS, 1), group('p2', 1)], metadata: { ...battle, sacrificed: 2 } }), own)).toBe('p2')
        expect(rowWarbandOwner(action({ type: ActionType.CampaignSacrifice, playerId: 'p2', sacrifice: 1 }), own)).toBe('p2')
    })

    it('R-5.5.5 — the skulls’ losses stay words, so a battle’s row counts the actor’s own', () => {
        const battle = { attackPool: 3, defensePool: 1, defense: 2, swords: 3, skullsKilled: 1 }
        const row = action({ type: ActionType.Campaign, playerId: 'p2', defender: { kind: 'bandits' }, targets: [], attackDice: 3, metadata: { supplySpent: 1, battle } })
        expect(rowWarbandOwner(row, own)).toBe('p2')
        expect(rowWarbandOwner(action({ type: ActionType.CampaignAttackPlans, playerId: 'p2', plans: [], metadata: { battle } }), own)).toBe('p2')
        expect(describeAction(row, nameOf)).toContain('losing 1 to skulls')
    })

    it('R-5.5.6.a — a choice of losses counts the owner it names, when it names one', () => {
        expect(rowWarbandOwner(action({ type: ActionType.CampaignDefeatKills, playerId: 'p1', kills: [group('p2', 1), group(IMPERIAL_WARBANDS, 0)] }), own)).toBe('p2')
        expect(rowWarbandOwner(action({ type: ActionType.CampaignDefeatKills, playerId: 'p1', kills: [group('p2', 1), group(IMPERIAL_WARBANDS, 1)] }), own)).toBe(IMPERIAL_WARBANDS)
    })

    it('anything else counts the actor’s own, the Empire’s for the Chancellor', () => {
        expect(rowWarbandOwner(action({ type: ActionType.ResolveCitizenshipOffer, playerId: 'p2', granted: true }), own)).toBe('p2')
        expect(rowWarbandOwner(action({ type: ActionType.TransferOathkeeper, source: 'system', toPlayerId: 'p1' }), own)).toBeUndefined()
    })
})
