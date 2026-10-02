import { describe, expect, it } from 'vitest'
import { ActionType, IMPERIAL_WARBANDS, SearchPlay, SearchSource } from '@tabletop/oath'
import { UNDESCRIBED, describeAction } from './actionDescription.js'
import { ActionSource, Color, type GameAction } from '@tabletop/common'
import { testPlayer, testState } from '@tabletop/oath/testing'
import { siteName, slotLabel } from './names.js'

const nameOf = { player: (playerId: string) => ({ p1: 'Alice', p2: 'Bob' })[playerId] ?? playerId, site: slotLabel }

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
        const names = { player: nameOf.player, site: (slotId: string) => printed[slotId] }
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
        const names = { player: nameOf.player, site: (slotId: string) => (slotId === 'slot.cradle.0' ? 'Plains' : slotId) }
        const line = describeAction(
            action({ type: ActionType.UseRestPower, playerId: 'p1', cardId: 'x', powerIndex: 0, choices: [], metadata: { summary: 'moved to slot.cradle.0' } }),
            names
        )
        expect(line).toBe('rested: moved to Plains')
    })
})

describe('the history tab describes every action', () => {
    it('has a sentence for all 31 action types, and reaches no fallback', () => {
        const types = Object.values(ActionType)
        // Pinned rather than read off the enum, so adding an action type fails here.
        expect(types).toHaveLength(31)

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
