import { describe, expect, it } from 'vitest'
import {
    ActionType,
    Banner,
    CampaignTargetKind,
    MachineState,
    PowerChoiceKind,
    PowerMoveKind,
    PowerMoveTollOutcome,
    PowerQuestionKind,
    SearchPlay,
    SearchSource
} from '@tabletop/oath'
import { ActionSource, type GameAction } from '@tabletop/common'
import { describeAction, type HistoryNames } from './actionDescription.js'
import { seatsById } from './names.js'
import { tokenParts } from './tokenText.js'

// Dana (p1) acts in most rows; Rhys (p2) is the other seat a row names; Ann (p3) a third seat.
const SITES: Record<string, string> = {
    'slot.cradle.0': 'Great Slum',
    'slot.cradle.1': 'The Hidden Place',
    'slot.provinces.0': 'Plains',
    'slot.provinces.1': 'Salt Flats',
    'slot.hinterland.0': 'Mine'
}
const names: HistoryNames = {
    player: (playerId) => ({ p1: 'Dana', p2: 'Rhys', p3: 'Ann' })[playerId] ?? playerId,
    site: (slotId) => SITES[slotId] ?? slotId,
    seats: ['p1', 'p2', 'p3']
}

function action(fields: { type: ActionType; playerId?: string } & Record<string, unknown>): GameAction {
    return { id: 'a1', gameId: 'g1', source: ActionSource.User, ...fields }
}

const row = (fields: { type: ActionType; playerId?: string } & Record<string, unknown>, viewerId?: string) =>
    describeAction(action({ playerId: 'p1', ...fields }), names, viewerId)

/** The row as the History draws it for a seat: each seat its chip ("<you>"), each count its piece. */
function drawn(fields: { type: ActionType; playerId?: string } & Record<string, unknown>, viewerId: string): string {
    const text = describeAction(action({ playerId: 'p1', ...fields }), seatsById(names), viewerId)
    return tokenParts(text, { warbands: true, seats: { names, viewerId } })
        .map((part) => {
            switch (part.kind) {
                case 'text':
                    return part.text
                case 'seat':
                    return part.playerId === viewerId ? `<you${part.possessive ? 'r' : ''}>` : `<${names.player(part.playerId)}${part.possessive ? "'s" : ''}>`
                case 'warband':
                    return `${part.count}[warband]`
                case 'suit':
                    return `[${part.suit}]`
                default:
                    return `${part.count ?? ''}[${part.kind}]`
            }
        })
        .join('')
}

const TOLL_ROADS = 'denizen.order.toll-roads'
const FORCED_LABOR = 'denizen.order.forced-labor'
const DRUM = 'relic.dragonskin-drum'
const TAVERN_SONGS = 'denizen.hearth.tavern-songs'
const COUNCIL_SEAT = 'denizen.order.council-seat'
const CARELESS = 'reliquary.careless'
const FIELD_PROMOTION = 'denizen.order.field-promotion'
const PLAINS = 'slot.provinces.0'

describe('the History words: each row as the record says it, older records too', () => {
    it('381 Setup: "started at", a card kept facedown, the discards’ pile, and a short bank’s split', () => {
        const setup = { type: ActionType.SetupChoice, siteId: 'slot.provinces.1', adviserCardId: 'x', discardOrder: [], metadata: { discardPileRegion: 'cradle' } }
        const split = [{ siteCardId: 'site.salt-flats', favor: 2 }, { siteCardId: 'site.mine', favor: 2 }]
        expect(row({ ...setup, siteFavor: split })).toBe('started at Salt Flats and kept a card facedown, discarding 2 to the Cradle pile; placed 4 favor: Salt Flats 2, Mine 2')
        expect(row(setup)).toBe('started at Salt Flats and kept a card facedown, discarding 2 to the Cradle pile')
    })

    describe('382 Travel', () => {
        const travel = (metadata: Record<string, unknown>) => row({ type: ActionType.Travel, siteId: 'slot.cradle.0', metadata: { supplySpent: 2, supplyRemaining: 3, ...metadata } })

        it('"traveled"; the toll paid, then the card; the Drum’s gain, what happened then the card', () => {
            expect(travel({ tollsPaid: [`${TOLL_ROADS}: gave a favor to p2`], modifiers: [DRUM], modifierNotes: ['Dragonskin Drum: gained 1 warband'] })).toBe(
                'traveled to Great Slum, spending 2 Supply; paid Rhys 1 favor (Toll Roads); gained 1 warband (Dragonskin Drum)'
            )
            expect(travel({ tollsPaid: [`${TOLL_ROADS}: burned a favor for the bandits`] })).toBe('traveled to Great Slum, spending 2 Supply; burned 1 favor (Toll Roads)')
        })

        it('Special Envoy in brackets after the cost; Tyrant’s kill by the site’s name; the reveal and the flip as clauses', () => {
            expect(travel({ supplySpent: 0, modifiers: ['denizen.nomad.special-envoy'], modifierNotes: ["Special Envoy ends p1's Act Phase"], endsActPhase: true })).toBe(
                'traveled to Great Slum, spending 0 Supply (Special Envoy)'
            )
            expect(travel({ modifiers: ['denizen.order.tyrant (must)'], modifierNotes: ['Tyrant killed a warband at slot.cradle.0'] })).toBe(
                'traveled to Great Slum, spending 2 Supply; killed 1 warband at Great Slum (Tyrant)'
            )
            expect(travel({ secretFlipped: true, revealedSiteCardId: 'site.mine', relicsRevealed: 1 })).toBe(
                'traveled to Great Slum, spending 2 Supply; flipped 1 secret; revealed Mine and 1 facedown relic'
            )
        })
    })

    describe('383 the Shrouded Wood', () => {
        it('the Travel out: no added "the", ";", and the ruler’s chip picks', () => {
            const out = (metadata: Record<string, unknown>) => ({ type: ActionType.Travel, metadata: { supplySpent: 2, supplyRemaining: 3, destinationChooser: 'p2', ...metadata } })
            expect(row(out({ paysAtPick: true, supplySpent: 0 }))).toBe('set out from Shrouded Wood; Rhys picks where')
            expect(row(out({}))).toBe('left Shrouded Wood, spending 2 Supply; Rhys picks where')
            expect(drawn(out({}), 'p3')).toBe('left Shrouded Wood, spending 2 Supply; <Rhys> picks where')
            expect(drawn(out({}), 'p2')).toBe('left Shrouded Wood, spending 2 Supply; <you> pick where')
        })

        it('the ruler’s pick is the traveller’s Travel: "traveled from Shrouded Wood to …"', () => {
            const pick = (siteId: string, notes?: string[], viewerId = 'p3', chips = false) =>
                (chips ? drawn : row)({ type: ActionType.AnswerQuestion, playerId: 'p2', answer: { kind: PowerQuestionKind.ShroudedWoodDestination, siteId }, metadata: { cardId: 'site.shrouded-wood', kind: PowerQuestionKind.ShroudedWoodDestination, summary: `sent p1 to ${siteId}`, resumeMachineState: MachineState.ActPhase, last: true, woodPick: { travelerPlayerId: 'p1', siteId, supplySpent: 2, supplyRemaining: 3, notes } } }, viewerId)
            expect(pick('slot.cradle.1')).toBe("traveled from Shrouded Wood to The Hidden Place (Rhys's pick), spending 2 Supply")
            expect(pick('slot.cradle.1', [], 'p2', true)).toBe('traveled from Shrouded Wood to The Hidden Place (<your> pick), spending 2 Supply')
            expect(pick('slot.cradle.0', ['Tyrant killed a warband at slot.cradle.0'])).toBe("traveled from Shrouded Wood to Great Slum (Rhys's pick), spending 2 Supply; killed 1 warband at Great Slum (Tyrant)")
        })
    })

    it('384 Muster: what it gained first, then the card; a card that did nothing the row shows, in brackets after the cost', () => {
        const muster = (metadata: Record<string, unknown>) => row({ type: ActionType.Muster, cardId: COUNCIL_SEAT, metadata: { warbandsGained: 2, supplySpent: 1, warbandOwner: 'p1', ...metadata } })
        expect(muster({})).toBe('mustered 2 warbands at Council Seat, spending 1 Supply')
        expect(muster({ modifiers: ['denizen.order.knights-errant'] })).toBe('mustered 2 warbands at Council Seat, spending 1 Supply (Knights Errant)')
    })

    describe('385 Trade', () => {
        const trade = (option: string, metadata: Record<string, unknown>) => row({ type: ActionType.Trade, cardId: TAVERN_SONGS, option, metadata: { supplySpent: 1, matchingAdvisers: 0, favorGained: 0, secretsGained: 0, ...metadata } })

        it('the token it traded for, by the option, even at 0: never "for 0 secrets" for a favor trade', () => {
            expect(trade('forFavor', {})).toBe('traded at Tavern Songs for 0 favor, spending 1 Supply')
            expect(trade('forFavor', { favorGained: 2 })).toBe('traded at Tavern Songs for 2 favor, spending 1 Supply')
        })

        it('Careless’s favor beside a Trade for secrets, the explicit 0 when the bank had none or Vow of Poverty withheld it', () => {
            const careless = (note: string) => trade('forSecrets', { favorGained: note.includes('gained 1') ? 1 : 0, modifiers: [CARELESS], modifierNotes: [note] })
            expect(careless('Careless: gained 1 favor')).toBe('traded at Tavern Songs for 0 secrets, spending 1 Supply; gained 1 favor (Careless)')
            expect(careless('Careless: the bank had no favor to give')).toBe('traded at Tavern Songs for 0 secrets, spending 1 Supply; gained 0 favor (Careless)')
            expect(careless('Careless: you cannot gain favor from Trade (Vow of Poverty)')).toBe('traded at Tavern Songs for 0 secrets, spending 1 Supply; gained 0 favor (Careless)')
        })

        it('Awaited Return’s sacrifice with no "your"; a Curfew toll as the Travel’s', () => {
            expect(trade('forSecrets', { secretsGained: 2, modifiers: ['denizen.hearth.awaited-return'], modifierNotes: ['sacrificed a warband from your board (Awaited Return)'] })).toBe(
                'traded at Tavern Songs for 2 secrets, spending 1 Supply; sacrificed 1 warband (Awaited Return)'
            )
            expect(trade('forFavor', { favorGained: 1, tollsPaid: ['denizen.order.curfew: gave a favor to p3'] })).toBe('traded at Tavern Songs for 1 favor, spending 1 Supply; paid Ann 1 favor (Curfew)')
        })
    })

    it('386 Search: the toll, then the shown draw, as clauses; "their region’s discard pile"', () => {
        const search = (drawFrom: SearchSource, metadata: Record<string, unknown>) => row({ type: ActionType.Search, drawFrom, metadata: { supplySpent: 2, cardsDrawn: 3, visionsDrawn: 0, ...metadata } })
        expect(search(SearchSource.WorldDeck, { tollsPaid: [`${FORCED_LABOR}: gave a favor to p2`], revealedDraw: ['denizen.beast.wolves', 'denizen.hearth.herald'], modifiers: ['relic.truthful-harp'] })).toBe(
            'searched the world deck, spending 2 Supply; paid Rhys 1 favor (Forced Labor); showed Wolves, Herald (Truthful Harp)'
        )
        expect(search(SearchSource.Discard, {})).toBe('searched their region’s discard pile, spending 2 Supply')
    })

    describe('387 the kept card', () => {
        const kept = (fields: Record<string, unknown>, metadata: Record<string, unknown> = {}) =>
            row({ type: ActionType.SearchResolve, keptCardId: 'denizen.beast.wolves', discardOrder: [], play: SearchPlay.Adviser, ...fields, metadata: { discardedCardIds: [], discardedCount: 0, discardPileRegion: 'cradle', favorGained: 0, ...metadata } })

        it('a facedown adviser says so', () => {
            expect(kept({ faceUp: false })).toBe('kept a card and played it as an adviser, facedown')
            expect(kept({})).toBe('kept a card and played it as an adviser, facedown')
            expect(kept({ faceUp: true }, { playedCardId: 'denizen.beast.wolves' })).toBe('kept Wolves and played it as an adviser')
        })

        it('what it gained, favor too', () => {
            expect(kept({ play: SearchPlay.Site }, { playedCardId: 'denizen.beast.wolves', favorGained: 2 })).toBe('kept Wolves and played it to their site, gaining 2 favor')
            expect(kept({ play: SearchPlay.Site }, { playedCardId: 'denizen.beast.wolves', secretsGained: 1 })).toBe('kept Wolves and played it to their site, gaining 1 secret')
        })
    })

    it('388 Recover: the banner’s price with its token; the relic by name; an older record as it was', () => {
        const banner = (which: Banner, amountPaid: number) => row({ type: ActionType.Recover, target: { kind: 'banner', banner: which }, amountPaid, metadata: { supplySpent: 1, amountPaid } })
        expect(banner(Banner.PeoplesFavor, 3)).toBe('recovered the People’s Favor for 3 favor')
        expect(banner(Banner.DarkestSecret, 2)).toBe('recovered the Darkest Secret for 2 secrets')
        const relic = (metadata: Record<string, unknown>) => row({ type: ActionType.Recover, target: { kind: 'relic', slotId: 's1' }, metadata: { supplySpent: 1, ...metadata } })
        expect(relic({ relicCardId: 'relic.cup-of-plenty', modifierNotes: ['Relic Worship: gained 1 Supply'] })).toBe('recovered Cup of Plenty, spending 1 Supply; gained 1 Supply (Relic Worship)')
        expect(relic({})).toBe('recovered a relic at their site, spending 1 Supply')
    })

    describe('389 Campaign', () => {
        const targets = [{ kind: CampaignTargetKind.Site, siteId: PLAINS }, { kind: CampaignTargetKind.Banner, banner: Banner.PeoplesFavor }, { kind: CampaignTargetKind.PawnAndFavor }]
        const declared = (metadata: Record<string, unknown>, plans: unknown[] = [{ cardId: FIELD_PROMOTION, powerIndex: 0 }]) =>
            row({ type: ActionType.Campaign, defender: { kind: 'player', playerId: 'p2' }, targets, attackDice: 6, plans, metadata: { supplySpent: 2, ...metadata } })
        const battle = { attackPool: 6, defensePool: 4, defense: 4, swords: 5, skullsKilled: 0 }

        it('its Supply, the attacker’s plans, and the dice while the defender still chooses', () => {
            expect(declared({ battle: { ...battle, defense: 0, swords: 0, awaitingDefender: true } })).toBe(
                'campaigned against Rhys for Plains, the People’s Favor and their pawn and favor, spending 2 Supply, using Field Promotion; 6 attack dice against 4 defense dice'
            )
        })

        it('the roll and the skulls’ losses; the Citizens asked', () => {
            expect(declared({ battle: { ...battle, skullsKilled: 1 } }, [])).toBe(
                'campaigned against Rhys for Plains, the People’s Favor and their pawn and favor, spending 2 Supply; 5 swords against 4 defense; lost 1 warband to skulls'
            )
            expect(declared({ awaitingAllies: true }, [])).toBe('campaigned against Rhys for Plains, the People’s Favor and their pawn and favor, spending 2 Supply; Citizens may join the defense')
        })
    })

    it('390 the attacker’s plans row: "used …;"', () => {
        const battle = { attackPool: 6, defensePool: 4, defense: 4, swords: 5, skullsKilled: 0 }
        expect(row({ type: ActionType.CampaignAttackPlans, plans: [{ cardId: FIELD_PROMOTION, powerIndex: 0 }], metadata: { battle } })).toBe('used Field Promotion; 5 swords against 4 defense')
        expect(row({ type: ActionType.CampaignAttackPlans, plans: [], metadata: { battle } })).toBe('used no battle plans; 5 swords against 4 defense')
    })

    it('392 the defense: no "and rolled"', () => {
        const defend = (plansUsed: string[]) => row({ type: ActionType.CampaignDefend, playerId: 'p2', plans: [], metadata: { plansUsed, attackPool: 6, defensePool: 4, defense: 4, swords: 5, skullsKilled: 0 } })
        expect(defend([])).toBe('used no battle plans; 5 swords against 4 defense')
        expect(defend(['denizen.order.bear-traps'])).toBe('used Bear Traps; 5 swords against 4 defense')
    })

    it('393 the sacrifice: the defense’s losses picked by a chip; Military Parade names who gained', () => {
        const fields = (metadata: Record<string, unknown>) => ({ type: ActionType.CampaignSacrifice, sacrifice: 1, metadata: { attack: 6, defense: 4, sacrificed: 1, ...metadata } })
        const sacrifice = (metadata: Record<string, unknown>) => row(fields(metadata))
        expect(sacrifice({ attackerVictorious: true, awaitingLossesOf: 'p2' })).toBe("sacrificed 1 warband and won the battle; Rhys picks the defense's losses")
        expect(drawn(fields({ attackerVictorious: true, awaitingLossesOf: 'p2' }), 'p2')).toBe("sacrificed 1[warband] and won the battle; <you> pick the defense's losses")
        expect(drawn(fields({ attackerVictorious: false, sacrificed: 0, planNotes: ['Military Parade: p2 gained 3 favor'] }), 'p3')).toBe('sacrificed 0[warband] and lost the battle; <Rhys> gained 3[favor] (Military Parade)')
        expect(sacrifice({ attackerVictorious: false, sacrificed: 0, planNotes: ['Military Parade: p2 gained 3 favor'] })).toBe('sacrificed 0 warbands and lost the battle; Rhys gained 3 favor (Military Parade)')
    })

    it('394 the losses: "picked the defense’s losses:"', () => {
        expect(row({ type: ActionType.CampaignDefeatKills, playerId: 'p2', kills: [], metadata: { defeatKilled: 2 } })).toBe("picked the defense's losses: 2 warbands killed")
    })

    describe('395 the spoils', () => {
        const spoils = (metadata: Record<string, unknown>, placements: unknown[] = [{ siteId: PLAINS, owner: 'p1', count: 2 }]) =>
            row({ type: ActionType.CampaignResolveVictory, placements, burnFavor: true, banishToSiteId: 'slot.provinces.1', metadata: { warbandsPlaced: 2, relicsTaken: [], bannersSeized: [], seizeBurned: 0, favorBurned: 0, ...metadata } })

        it('the placements, the banner and its burn, the banish and the defender’s burn, the victor’s plan', () => {
            expect(
                spoils({ bannersSeized: [Banner.PeoplesFavor], seizeBurned: 2, banishedToSiteId: 'slot.provinces.1', favorBurned: 3, defenderPlayerId: 'p2', triggered: ['Field Promotion: p1 gained 3 warbands'] })
            ).toBe("took the spoils: placed 2 warbands at Plains; seized the People’s Favor, burning 2 favor from it; banished Rhys to Salt Flats; burned 3 favor from Rhys; gained 3 warbands (Field Promotion)")
        })

        it('a relic taken; the Darkest Secret’s burn in secrets; a record without the defender', () => {
            expect(spoils({ relicsTaken: ['relic.cup-of-plenty'], bannersSeized: [Banner.DarkestSecret], seizeBurned: 2 }, [])).toBe('took the spoils: took Cup of Plenty; seized the Darkest Secret, burning 2 secrets from it')
            expect(spoils({ banishedToSiteId: 'slot.provinces.1', favorBurned: 3 }, [])).toBe('took the spoils: banished the defender to Salt Flats; burned 3 favor from the defender')
        })
    })

    it('396 a facedown adviser played: a modifier’s gain as a clause, a modifier with nothing to show in brackets', () => {
        const played = (metadata: Record<string, unknown>) => row({ type: ActionType.PlayFacedownAdviser, cardId: 'denizen.beast.animal-host', play: SearchPlay.Adviser, metadata: { playedCardId: 'denizen.beast.animal-host', discardedCardIds: [], discardPileRegion: 'cradle', favorGained: 0, ...metadata } })
        expect(played({ modifiers: ['denizen.beast.wild-cry'], modifierNotes: ['Wild Cry: gained 1 Supply and 2 warbands'] })).toBe('turned Animal Host faceup as an adviser; gained 1 Supply and 2 warbands (Wild Cry)')
        expect(played({ modifiers: ['denizen.beast.wild-cry'] })).toBe('turned Animal Host faceup as an adviser (Wild Cry)')
    })

    it('402 the Citizenship offer: its terms from its own record', () => {
        const offer = (terms?: unknown) => row({ type: ActionType.OfferCitizenship, exilePlayerId: 'p2', reliquarySlotId: 'reliquary.1', terms })
        expect(offer({ fromScepterHolder: { favor: 2 }, fromExile: { secrets: 1 } })).toBe('offered Rhys Citizenship, the relic on Reliquary space 2 and 2 favor, for 1 secret')
        expect(offer()).toBe('offered Rhys Citizenship, the relic on Reliquary space 2')
    })

    it('404 False Prophet: the warband that died, and the play in words', () => {
        const prophet = (play: SearchPlay, summary: string) =>
            row({ type: ActionType.AnswerQuestion, answer: { kind: PowerQuestionKind.PlayOrDiscardVision, play }, metadata: { cardId: 'denizen.discord.false-prophet', kind: PowerQuestionKind.PlayOrDiscardVision, summary, resumeMachineState: MachineState.ActPhase, last: true } })
        expect(prophet(SearchPlay.Adviser, 'played vision.faith (adviser)')).toBe('False Prophet: 1 warband on Vision of Faith died; played it as an adviser, facedown')
        expect(prophet(SearchPlay.Discard, 'discarded vision.faith')).toBe('False Prophet: 1 warband on Vision of Faith died; discarded it')
    })

    it('407 the Wake and 410 the Rest: ";" for "—"', () => {
        expect(row({ type: ActionType.ResolveWake, favorSteps: [], metadata: { flippedToUsurper: true, flippedToMob: true } })).toBe('began the turn; the Oathkeeper title flipped to Usurper; the People’s Favor flipped to Mob')
        expect(row({ type: ActionType.CompleteRest, metadata: { endDieRoll: 5, endedRound: true } })).toBe('rested, rolling 5 on the end die; the round ended')
    })

    it('419, 420 a consent answer’s battle: "defense", ";"', () => {
        const battle = { attackPool: 3, defensePool: 1, defense: 1, swords: 2, skullsKilled: 0 }
        const answer = (kind: string, granted: boolean) => row({ type: ActionType.AnswerConsent, playerId: 'p3', granted, metadata: { kind, askingPlayerId: 'p2', battle } })
        expect(answer('joinDefence', true)).toBe('asked to join the defense; 2 swords against 1 defense')
        expect(answer('admitAlly', false)).toBe('kept Rhys out of the defense; 2 swords against 1 defense')
    })

    describe('the deals’ terms on the offer’s row', () => {
        it('Deed Writer: "offered <chip> … for …", the site’s warbands those who move in', () => {
            const deed = (terms: unknown) =>
                row({ type: ActionType.UseActionPower, cardId: 'denizen.hearth.deed-writer', powerIndex: 0, choices: [{ kind: PowerChoiceKind.Exchange, withPlayerId: 'p2', terms }], metadata: { summary: 'Deed Writer: proposed a binding exchange to p2' } })
            expect(deed({ fromProposer: { favor: 2 }, fromCounterparty: { sites: [{ siteId: PLAINS, warbands: 2 }] } })).toBe('used Deed Writer: offered Rhys 2 favor for Plains (2 warbands move in)')
            expect(deed({ fromProposer: { sites: [{ siteId: PLAINS, warbands: 1 }] } })).toBe("used Deed Writer: offered Rhys Plains (1 of Rhys's warbands move in) for nothing")
        })

        it('The Gathering’s floor: the proposal’s terms, adviser rows as "an adviser"; nothing proposed', () => {
            const floor = (proposal?: unknown) =>
                row({ type: ActionType.AnswerQuestion, answer: { kind: PowerQuestionKind.GatheringFloor, proposal }, metadata: { cardId: 'denizen.nomad.the-gathering', kind: PowerQuestionKind.GatheringFloor, summary: proposal ? 'proposed an exchange to p2' : 'proposed nothing', resumeMachineState: MachineState.ActPhase, last: true } })
            expect(floor({ withPlayerId: 'p2', terms: { fromProposer: { secrets: 1 }, fromCounterparty: { relicCardIds: ['relic.cup-of-plenty'], adviserRows: [0] } } })).toBe(
                'The Gathering: offered Rhys 1 secret for Cup of Plenty and an adviser'
            )
            expect(floor()).toBe('The Gathering: proposed nothing')
        })
    })

    it('the Toll Roads story: site names as printed, no added "the"', () => {
        const toll = { cardId: TOLL_ROADS, payeeId: 'p3' }
        const answered = (outcome: PowerMoveTollOutcome) =>
            row({ type: ActionType.AnswerQuestion, playerId: 'p2', answer: { kind: PowerQuestionKind.PayTravelToll, pay: true }, metadata: { cardId: TOLL_ROADS, kind: PowerQuestionKind.PayTravelToll, summary: '', resumeMachineState: MachineState.ActPhase, last: true, tollMove: { move: PowerMoveKind.Whistle, powerCardId: 'relic.whistle', moverPlayerId: 'p1', movedPlayerId: 'p2', fromSiteId: 'slot.cradle.1', toSiteId: 'slot.cradle.0', toll, outcome } } })
        expect(answered(PowerMoveTollOutcome.Paid)).toBe('used the Whistle on Rhys; Rhys paid Ann 1 favor (Toll Roads) and went to Great Slum')
        expect(answered(PowerMoveTollOutcome.Refused)).toBe('used the Whistle on Rhys; Rhys refused Toll Roads and stayed at The Hidden Place')
    })

    describe('what every row shares', () => {
        it('a battle plan’s note names its user, dropped when it is the row’s player; an older note reads as recorded', () => {
            const sacrifice = (planNotes: string[]) => row({ type: ActionType.CampaignSacrifice, sacrifice: 0, metadata: { attack: 2, defense: 4, sacrificed: 0, attackerVictorious: false, planNotes } })
            expect(sacrifice(['Field Promotion: p2 gained 3 warbands'])).toBe('sacrificed 0 warbands and lost the battle; Rhys gained 3 warbands (Field Promotion)')
            expect(sacrifice(['Field Promotion: p1 gained 3 warbands'])).toBe('sacrificed 0 warbands and lost the battle; gained 3 warbands (Field Promotion)')
            expect(sacrifice(['Field Promotion: gained 3 warbands'])).toBe('sacrificed 0 warbands and lost the battle; gained 3 warbands (Field Promotion)')
        })

        it('an older stored note that says "you" or "your" is not shown', () => {
            const sacrifice = (planNotes: string[]) => row({ type: ActionType.CampaignSacrifice, sacrifice: 0, metadata: { attack: 2, defense: 4, sacrificed: 0, attackerVictorious: false, planNotes } }, 'p3')
            expect(sacrifice(["Military Parade: gained 3 favor from the banks matching your enemy's advisers", 'Sneak Attack: p3 cannot campaign against p1 (Vow of Peace: you cannot campaign)'])).toBe('sacrificed 0 warbands and lost the battle')
            expect(sacrifice(['Sneak Attack: p3 cannot campaign against p1'])).toBe('sacrificed 0 warbands and lost the battle; you cannot campaign against Dana (Sneak Attack)')
        })

        it('Herald’s older "gains" agrees with "you"', () => {
            const victory = (triggered: string[]) => row({ type: ActionType.CampaignResolveVictory, placements: [], burnFavor: false, metadata: { warbandsPlaced: 0, relicsTaken: [], bannersSeized: [], seizeBurned: 0, favorBurned: 0, triggered } }, 'p3')
            expect(victory(['Herald: p3 gains a favor from a bank of their choice'])).toBe('took the spoils; you gain a favor from a bank of their choice (Herald)')
            expect(victory(['Herald: p3 may gain 1 favor from a bank of their choice'])).toBe('took the spoils; you may gain 1 favor from a bank of their choice (Herald)')
        })

        it('one is singular: "1 warband", "1 card", in an engine summary too; "traveled"', () => {
            const power = (cardId: string, summary: string) => row({ type: ActionType.UseActionPower, cardId, powerIndex: 0, metadata: { summary } })
            expect(power('denizen.hearth.tavern-songs', 'Tavern Songs: peeked at the top 1 cards of the cradle discard pile')).toBe('used Tavern Songs: peeked at the top 1 card of the cradle discard pile')
            expect(power('relic.whistle', 'Whistle: p2 travelled to slot.cradle.0, gaining 1 secrets')).toBe('used Whistle, placing a secret on it: Rhys traveled to Great Slum, gaining 1 secret')
            expect(row({ type: ActionType.UseRestPower, cardId: 'denizen.beast.wild-cry', powerIndex: 0, metadata: { summary: 'gained 1 warbands' } })).toBe('rested with Wild Cry: gained 1 warband')
        })

        it('a counted warband’s piece reads its words in the singular at 1', () => {
            const words = tokenParts('gained 1 warbands and 1 Imperial warbands', { warbands: true }).flatMap((part) => (part.kind === 'warband' ? [part.words] : []))
            expect(words).toEqual(['warband', 'Imperial warband'])
        })

        it('never "—" between clauses, nor "defence" or "travelled", in any row it writes', () => {
            const rows = [
                row({ type: ActionType.Travel, siteId: 'slot.cradle.0', metadata: { supplySpent: 1, supplyRemaining: 3, revealedSiteCardId: 'site.mine', relicsRevealed: 0 } }),
                row({ type: ActionType.Travel, metadata: { supplySpent: 1, supplyRemaining: 3, destinationChooser: 'p2' } }),
                row({ type: ActionType.CampaignSacrifice, sacrifice: 0, metadata: { attack: 6, defense: 4, sacrificed: 0, attackerVictorious: true, awaitingLossesOf: 'p2' } }),
                row({ type: ActionType.ResolveWake, favorSteps: [], metadata: { flippedToUsurper: true } }),
                row({ type: ActionType.CompleteRest, metadata: { endedRound: true } })
            ]
            for (const line of rows) expect(line).not.toMatch(/—|defence|travelled/)
        })
    })
})

describe('R-7.4 — what each card in use did, after the gain it changed', () => {
    const ROWDY_PUB = 'denizen.hearth.rowdy-pub'
    const OLD_OAK = 'denizen.beast.the-old-oak'
    const muster = (metadata: Record<string, unknown>) => row({ type: ActionType.Muster, cardId: ROWDY_PUB, metadata })
    const trade = (cardId: string, option: string, metadata: Record<string, unknown>) =>
        row({ type: ActionType.Trade, cardId, option, metadata: { supplySpent: 1, matchingAdvisers: 0, favorGained: 0, secretsGained: 0, ...metadata } })

    it('Rowdy Pub and Downtrodden follow the warbands they added, before the cost', () => {
        expect(muster({ warbandsGained: 3, supplySpent: 1, warbandOwner: 'p1', modifiers: [ROWDY_PUB] })).toBe(
            'mustered 3 warbands (Rowdy Pub) at Rowdy Pub, spending 1 Supply'
        )
        expect(muster({ warbandsGained: 6, supplySpent: 0, warbandOwner: 'p1', modifiers: [ROWDY_PUB, 'denizen.discord.downtrodden', 'denizen.beast.animal-playmates'] })).toBe(
            'mustered 6 warbands (Rowdy Pub, Downtrodden) at Rowdy Pub, spending 0 Supply (Animal Playmates)'
        )
        expect(muster({ warbandsGained: 4, supplySpent: 1, warbandOwner: 'p1', modifiers: [ROWDY_PUB, 'denizen.beast.vow-of-beastkin (must)'] })).toBe(
            'mustered 4 warbands (Rowdy Pub, Vow of Beastkin) at Rowdy Pub, spending 1 Supply'
        )
    })

    it('an older Muster record, with no warband owner, reads the same', () => {
        expect(muster({ warbandsGained: 3, supplySpent: 1, modifiers: [ROWDY_PUB] })).toBe(
            'mustered 3 warbands (Rowdy Pub) at Rowdy Pub, spending 1 Supply'
        )
    })

    it('Secret Signal, Careless and The Old Oak follow the token they added; Birdsong the Supply it waived', () => {
        expect(trade(TAVERN_SONGS, 'forFavor', { favorGained: 2, modifiers: ['denizen.arcane.secret-signal'] })).toBe(
            'traded at Tavern Songs for 2 favor (Secret Signal), spending 1 Supply'
        )
        expect(trade(TAVERN_SONGS, 'forFavor', { favorGained: 2, modifiers: [`${CARELESS} (must)`] })).toBe(
            'traded at Tavern Songs for 2 favor (Careless), spending 1 Supply'
        )
        expect(trade(OLD_OAK, 'forSecrets', { secretsGained: 2, modifiers: [OLD_OAK] })).toBe(
            'traded at The Old Oak for 2 secrets (The Old Oak), spending 1 Supply'
        )
        expect(trade('denizen.beast.wolves', 'forFavor', { favorGained: 1, supplySpent: 0, modifiers: ['denizen.beast.birdsong'] })).toBe(
            'traded at Wolves for 1 favor, spending 0 Supply (Birdsong)'
        )
    })

    it('Secret Signal on a Trade for secrets keeps its note, which names it once', () => {
        expect(trade(TAVERN_SONGS, 'forSecrets', { secretsGained: 1, modifiers: ['denizen.arcane.secret-signal'], modifierNotes: ['Secret Signal: gained 1 more favor'] })).toBe(
            'traded at Tavern Songs for 1 secret, spending 1 Supply; gained 1 more favor (Secret Signal)'
        )
    })

    it('the Drum keeps the clause its note gives', () => {
        expect(row({ type: ActionType.Travel, siteId: 'slot.cradle.0', metadata: { supplySpent: 2, modifiers: [DRUM], modifierNotes: ['Dragonskin Drum: gained 1 warband'] } })).toBe(
            'traveled to Great Slum, spending 2 Supply; gained 1 warband (Dragonskin Drum)'
        )
    })
})
