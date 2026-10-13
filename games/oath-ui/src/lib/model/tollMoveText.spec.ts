import { describe, expect, it } from 'vitest'
import {
    ActionType,
    AnswerQuestion,
    CampaignResolveVictory,
    CampaignTargetKind,
    HydratedAnswerQuestion,
    HydratedCampaignResolveVictory,
    HydratedTravel,
    HydratedUseActionPower,
    OathRevision,
    PlayerStatus,
    PowerChoiceKind,
    PowerQuestionKind,
    PowerTiming,
    Travel,
    UseActionPower,
    powerIndexOf,
    type HydratedOathGameState,
    type PowerChoice,
    type QuestionAnswer
} from '@tabletop/oath'
import { ActionSource, Color, type GameAction } from '@tabletop/common'
import { buildAction, campaignRecords, openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { describeAction, rowActorOf } from './actionDescription.js'

const TOLL_ROADS = 'denizen.order.toll-roads'
const FORCED_LABOR = 'denizen.order.forced-labor'
const WHISTLE = 'relic.whistle'
const PALANQUIN = 'denizen.order.palanquin'
const ORACLE = 'denizen.nomad.oracle'
const HORSE = 'relic.brass-horse'
const SLANDER = 'denizen.discord.slander'

const NAMES: Record<string, string> = { p1: 'Rhys', p2: 'Dana', p3: 'Anna' }
const SITES: Record<string, string> = { c1: 'Great Slum', c2: 'River', p1: 'Plains', h1: 'Mountain', 'slot.provinces.1': 'Great Slum' }
const names = {
    player: (playerId: string) => NAMES[playerId] ?? playerId,
    site: (slotId: string) => SITES[slotId] ?? slotId,
    seats: ['p1', 'p2', 'p3']
}

/** The History row as a seat reads it: the row's actor, then what the row says. */
function row(action: GameAction, viewer?: string): string {
    const actor = rowActorOf(action)
    const name = actor === undefined ? '' : actor === viewer ? 'You' : names.player(actor)
    return `${name} ${describeAction(action, names, viewer)}`
}

/** Rhys (p1) rules the Great Slum (c1), which holds Toll Roads; Dana (p2) is at the River (c2). */
function table(over: Record<string, Record<string, unknown>> = {}, state: Record<string, unknown> = {}): HydratedOathGameState {
    const s = testState(
        [
            testPlayer({ playerId: 'p1', color: Color.Red, siteId: 'c1', favor: 3, secrets: 3, relicIds: [WHISTLE], ...over['p1'] }),
            testPlayer({ playerId: 'p2', color: Color.Blue, siteId: 'c2', favor: 4, secrets: 1, ...over['p2'] }),
            testPlayer({ playerId: 'p3', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'h1' })
        ],
        {
            oathRevision: OathRevision.UiBatch1,
            chancellorPlayerId: 'p3',
            denizensBySite: { c1: [TOLL_ROADS], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { p1: 2 }, c2: { p2: 1 } },
            ...state
        }
    )
    openTurn(s, 'p1')
    return s
}

function use(s: HydratedOathGameState, playerId: string, cardId: string, choices: PowerChoice[]) {
    const a = new HydratedUseActionPower(buildAction(UseActionPower, { playerId, cardId, powerIndex: powerIndexOf(cardId, PowerTiming.Action), choices }))
    a.apply(s)
    return a
}

function answer(s: HydratedOathGameState, playerId: string, given: QuestionAnswer) {
    const a = new HydratedAnswerQuestion(buildAction(AnswerQuestion, { playerId, answer: given }))
    a.apply(s)
    return a
}

const dana: PowerChoice = { kind: PowerChoiceKind.Player, playerId: 'p2' }

function record(fields: { type: ActionType; playerId: string } & Record<string, unknown>): GameAction {
    return { id: 'a1', gameId: 'g1', source: ActionSource.User, ...fields }
}

describe('Toll Roads on a power’s move: the History tells the whole story', () => {
    it('the Whistle’s own row is short while Dana is asked', () => {
        const s = table()
        expect(row(use(s, 'p1', WHISTLE, [dana]))).toBe('Rhys used the Whistle on Dana, placing a secret on it')
    })

    it('paid: the answer carries the whole story, from the mover', () => {
        const s = table()
        use(s, 'p1', WHISTLE, [dana])
        const paid = answer(s, 'p2', { kind: PowerQuestionKind.PayTravelToll, pay: true })
        expect(row(paid)).toBe("Rhys used the Whistle on Dana; Dana paid Rhys 1 favor (Toll Roads) and went to Great Slum, taking the Whistle's 1 secret")
        expect(row(paid, 'p2')).toBe("Rhys used the Whistle on you; you paid Rhys 1 favor (Toll Roads) and went to Great Slum, taking the Whistle's 1 secret")
        expect(row(paid, 'p1')).toBe("You used the Whistle on Dana; Dana paid you 1 favor (Toll Roads) and went to Great Slum, taking the Whistle's 1 secret")
    })

    it('refused', () => {
        const s = table()
        use(s, 'p1', WHISTLE, [dana])
        expect(row(answer(s, 'p2', { kind: PowerQuestionKind.PayTravelToll, pay: false }))).toBe('Rhys used the Whistle on Dana; Dana refused Toll Roads and stayed at River')
    })

    it('no favor: one row says so', () => {
        const s = table({ p2: { favor: 0 } })
        expect(row(use(s, 'p1', WHISTLE, [dana]))).toBe('Rhys used the Whistle on Dana; Dana had no favor for Toll Roads and stayed at River')
    })

    it('a banish paid, with and without the burn that waited on it', () => {
        for (const [burnFavor, line] of [
            [true, 'Rhys banished Dana; Dana paid Rhys 1 favor (Toll Roads) and went to Great Slum; Rhys burned 1 favor'],
            [false, 'Rhys banished Dana; Dana paid Rhys 1 favor (Toll Roads) and went to Great Slum']
        ] as const) {
            const s = table({ p1: { siteId: 'c2' } }, {
                campaign: {
                    attackerPlayerId: 'p1',
                    defenderPlayerId: 'p2',
                    nonImperialPlayerIds: [],
                    allyPlayerIds: [],
                    targets: [{ kind: CampaignTargetKind.Site, siteId: 'c2' }, { kind: CampaignTargetKind.PawnAndFavor }],
                    attackPool: 4,
                    defensePool: 1,
                    attackRoll: [],
                    defenseRoll: [],
                    defense: 2,
                    swords: 5,
                    defendingForce: [],
                    defendingBandits: 0,
                    ...campaignRecords(),
                    attackerVictorious: true
                }
            })
            const spoils = new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: 'p1', placements: [], banishToSiteId: 'c1', burnFavor }))
            spoils.apply(s)
            expect(row(spoils)).toBe('Rhys took the spoils')
            expect(row(answer(s, 'p2', { kind: PowerQuestionKind.PayTravelToll, pay: true }))).toBe(line)
        }
    })

    it("a banish under Slander: the plan's burn follows the answer, in the answer's row (R-5.5.7.III, R-5.5.8)", () => {
        const won = (state: Record<string, unknown> = {}, over: Record<string, Record<string, unknown>> = {}) =>
            table({ p1: { siteId: 'c2' }, ...over }, {
                campaign: {
                    attackerPlayerId: 'p1',
                    defenderPlayerId: 'p2',
                    nonImperialPlayerIds: [],
                    allyPlayerIds: [],
                    targets: [{ kind: CampaignTargetKind.PawnAndFavor }],
                    attackPool: 4,
                    defensePool: 1,
                    attackRoll: [],
                    defenseRoll: [],
                    defense: 2,
                    swords: 5,
                    defendingForce: [],
                    defendingBandits: 0,
                    ...campaignRecords(),
                    plansUsed: [SLANDER],
                    plansUsedBy: { p1: [SLANDER] },
                    attackerVictorious: true
                },
                ...state
            })
        const spoils = (s: HydratedOathGameState, fields: Record<string, unknown>) => {
            const action = new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: 'p1', placements: [], burnFavor: true, ...fields }))
            action.apply(s)
            return action
        }

        const s = won()
        expect(row(spoils(s, { banishToSiteId: 'c1' }))).toBe('Rhys took the spoils')
        expect(row(answer(s, 'p2', { kind: PowerQuestionKind.PayTravelToll, pay: true }))).toBe(
            'Rhys banished Dana; Dana paid Rhys 1 favor (Toll Roads) and went to Great Slum; Rhys burned 1 favor; Dana burned all 2 of their favor (Slander)'
        )

        // Out of Rhys's Shrouded Wood (c2), Rhys picks the Mountain, where no toll is asked.
        const wood = won({ siteCards: { c1: 'site.plains', c2: 'site.shrouded-wood', p1: 'site.marshes', h1: 'site.mountain' }, warbandsBySite: { c1: { p1: 2 }, c2: { p1: 1 } } }, { p1: { siteId: 'c1' } })
        expect(row(spoils(wood, { banish: true }))).toBe('Rhys took the spoils')
        // The fixture's site ids are not slot ids, so the pick's own words keep "h1"; the notes are the point.
        expect(row(answer(wood, 'p1', { kind: PowerQuestionKind.ShroudedWoodDestination, siteId: 'h1' }))).toBe(
            'Rhys Shrouded Wood: sent Dana to h1; Rhys burned 2 favor; Dana burned all 2 of their favor (Slander)'
        )
    })

    it('Palanquin refused: neither moved', () => {
        const s = table({ p1: { siteId: 'c2', advisers: [{ cardId: PALANQUIN, faceUp: true }] } })
        expect(row(use(s, 'p1', PALANQUIN, [dana, { kind: PowerChoiceKind.Site, siteId: 'c1' }]))).toBe('Rhys used Palanquin on Dana, placing a favor on it')
        expect(row(answer(s, 'p2', { kind: PowerQuestionKind.PayTravelToll, pay: false }))).toBe('Rhys used Palanquin on Dana; Dana refused Toll Roads, and neither moved')
    })

    it("the Shrouded Wood ruler's pick, after a power moves the pawn", () => {
        for (const [pay, line] of [
            [true, 'Rhys sent Dana from Shrouded Wood; Dana paid Rhys 1 favor (Toll Roads) and went to Great Slum'],
            [false, 'Rhys sent Dana from Shrouded Wood; Dana refused Toll Roads and stayed at Shrouded Wood']
        ] as const) {
            // Rhys's Palanquin carries Dana out of Rhys's Shrouded Wood (c2); Rhys picks the Great Slum.
            const s = table({ p1: { siteId: 'c2', advisers: [{ cardId: PALANQUIN, faceUp: true }] } }, { siteCards: { c1: 'site.plains', c2: 'site.shrouded-wood', p1: 'site.marshes', h1: 'site.mountain' }, warbandsBySite: { c1: { p1: 2 }, c2: { p1: 1 } } })
            use(s, 'p1', PALANQUIN, [dana, { kind: PowerChoiceKind.Site, siteId: 'p1' }])
            const woodNames = { ...names, site: (slotId: string) => (slotId === 'c2' ? 'Shrouded Wood' : names.site(slotId)) }
            const pick = answer(s, 'p1', { kind: PowerQuestionKind.ShroudedWoodDestination, siteId: 'c1' })
            expect(`Rhys ${describeAction(pick, woodNames)}`).toBe('Rhys sent Dana from Shrouded Wood')
            const answered = answer(s, 'p2', { kind: PowerQuestionKind.PayTravelToll, pay })
            expect(`${names.player(rowActorOf(answered) ?? '')} ${describeAction(answered, woodNames)}`).toBe(line)
        }
    })

    it('a site whose name prints its own article keeps it: "The Hidden Place", never "the The Hidden Place"', () => {
        const s = table()
        use(s, 'p1', WHISTLE, [dana])
        const hidden = { ...names, site: (slotId: string) => (slotId === 'c1' ? 'The Hidden Place' : names.site(slotId)) }
        const paid = answer(s, 'p2', { kind: PowerQuestionKind.PayTravelToll, pay: true })
        expect(`Rhys ${describeAction(paid, hidden)}`).toBe("Rhys used the Whistle on Dana; Dana paid Rhys 1 favor (Toll Roads) and went to The Hidden Place, taking the Whistle's 1 secret")
    })

    it("the Shrouded Wood ruler's pick on Dana's own Travel: the toll first, then the Travel's row with its Supply", () => {
        const wood = { siteCards: { c1: 'site.plains', c2: 'site.shrouded-wood', p1: 'site.marshes', h1: 'site.mountain' }, warbandsBySite: { c1: { p1: 2 }, c2: { p1: 1 } } }
        const woodNames = { ...names, site: (slotId: string) => (slotId === 'c2' ? 'Shrouded Wood' : names.site(slotId)) }
        const woodRow = (action: GameAction) => `${names.player(rowActorOf(action) ?? '')} ${describeAction(action, woodNames)}`
        for (const [pay, line] of [
            [true, "Dana traveled from Shrouded Wood to Great Slum (Rhys's pick), spending 2 Supply; paid Rhys 1 favor (Toll Roads)"],
            [false, 'Rhys sent Dana from Shrouded Wood; Dana refused Toll Roads and stayed at Shrouded Wood']
        ] as const) {
            const s = table({}, wood)
            openTurn(s, 'p2')
            new HydratedTravel(buildAction(Travel, { playerId: 'p2' })).apply(s)
            expect(woodRow(answer(s, 'p1', { kind: PowerQuestionKind.ShroudedWoodDestination, siteId: 'c1' }))).toBe('Rhys sent Dana from Shrouded Wood')
            expect(woodRow(answer(s, 'p2', { kind: PowerQuestionKind.PayTravelToll, pay }))).toBe(line)
        }
    })

    it('Brass Horse: its user pays as they travel', () => {
        const horse = record({ type: ActionType.AnswerQuestion, playerId: 'p2', answer: { kind: PowerQuestionKind.TravelFreeTo, siteId: 'slot.provinces.1' }, metadata: { cardId: HORSE, kind: PowerQuestionKind.TravelFreeTo, summary: `travelled to slot.provinces.1 for no Supply; paid p1 1 favor (${TOLL_ROADS})`, resumeMachineState: 'actPhase', last: true } })
        expect(row(horse)).toBe('Dana Brass Horse: traveled to Great Slum for no Supply; paid Rhys 1 favor (Toll Roads)')
    })

    it('Oracle names the Forced Labor toll it paid, to its ruler or burned', () => {
        const oracle = (payeeId?: string) =>
            record({ type: ActionType.UseActionPower, playerId: 'p2', cardId: ORACLE, powerIndex: powerIndexOf(ORACLE, PowerTiming.Action), metadata: { summary: 'Oracle: drew the next Vision; keep it or discard it as if p2 had searched', tollsGiven: [{ cardId: FORCED_LABOR, payeeId }] } })
        expect(row(oracle('p1'))).toBe('Dana used Oracle, placing 2 secrets on it: drew the next Vision; keep it or discard it as if Dana had searched; paid Rhys 1 favor (Forced Labor)')
        expect(row(oracle())).toBe('Dana used Oracle, placing 2 secrets on it: drew the next Vision; keep it or discard it as if Dana had searched; burned 1 favor (Forced Labor)')
    })
})
