import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import { engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { testPlayer, testState, testVaultWithRelics } from '../testing/fixture.js'
import { served } from '../testing/projection.js'
import { MachineState } from './states.js'
import { cardDefinition, cardIdsOfKind } from '../data/cardRegistry.js'
import { BattlePlanSide, cardPowers, PowerTiming } from '../data/cardPowers.js'
import { CardKind, PlayerStatus } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { CURRENT_OATH_REVISION } from '../util/revision.js'
import { hasEffect } from '../powers/registry.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { legalPowers } from '../util/powerDoorway.js'
import { legalChoices, PowerChoiceKind, type PowerChoice } from '../util/powerChoice.js'
import { HydratedUseActionPower } from '../actions/useActionPower.js'
import { Campaign, HydratedCampaign } from '../actions/campaign.js'
import { HydratedCampaignDefend } from '../actions/campaignDefend.js'
import { buildAction } from '../testing/actions.js'
import { siteTarget } from '../testing/choices.js'
import { OathVisibility } from './runtime.js'
import { required } from '../testing/required.js'
import '../powers/index.js'

const SEATS = ['me', 'foe', 'chan']
const game = { ...testGame(SEATS), hotseat: false, protectedInformation: true as const }

/**
 * Me to act, with the card held or at my site, and enough favor and secrets for any card's cost (the
 * dearest takes two secrets); the foe holds a facedown adviser and the vault holds facedown relics, so
 * each view lacks something the server has.
 */
function table(machineState: MachineState, cardId: string, at: 'held' | 'site') {
    const held =
        at === 'site'
            ? {}
            : cardId.startsWith('relic.')
              ? { relicIds: ['relic.cup-of-plenty', cardId] }
              : { advisers: [{ cardId, faceUp: true }] }
    const s = testState(
        [
            testPlayer({ playerId: 'me', color: Color.Red, siteId: 'c1', favor: 6, secrets: 3, supply: 6, warbandsOnBoard: { me: 3 }, warbandsInPersonalBank: { me: 6 }, relicIds: ['relic.cup-of-plenty'], ...held }),
            testPlayer({ playerId: 'foe', color: Color.Blue, siteId: 'c1', favor: 3, secrets: 3, supply: 4, warbandsOnBoard: { foe: 2 }, warbandsInPersonalBank: { foe: 5 }, advisers: [{ cardId: 'denizen.nomad.tents', faceUp: false }], relicIds: ['relic.map'] }),
            testPlayer({ playerId: 'chan', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'p1', favor: 3, secrets: 3, supply: 4, warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 5 } })
        ],
        {
            oathRevision: CURRENT_OATH_REVISION,
            machineState,
            chancellorPlayerId: 'chan',
            denizensBySite: { c1: at === 'site' ? [cardId] : ['denizen.hearth.storyteller'], c2: ['denizen.beast.wolves'], p1: ['denizen.arcane.tutor'], h1: [] },
            warbandsBySite: { c1: { me: 2, foe: 1 }, c2: { me: 2 }, p1: { [IMPERIAL_WARBANDS]: 2 } },
            siteCards: { c1: 'site.plains', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' },
            relicsBySite: { c1: [{ slotId: 'c1-r1' }] },
            reliquary: [{ slotId: 'reliquary.0' }, { slotId: 'reliquary.1' }],
            vault: testVaultWithRelics({ 'c1-r1': 'relic.bandit-crown', 'reliquary.0': 'relic.book-of-records', 'reliquary.1': 'relic.cracked-horn' })
        }
    )
    const d = s.dehydrate()
    d.turnManager = { series: [{ type: 'turn', playerId: 'me', start: 0 }], turnOrder: SEATS, turnCounts: { me: 1, foe: 0, chan: 0 } }
    d.activePlayerIds = ['me']
    return d
}

const ACTED: readonly PowerTiming[] = [PowerTiming.Action, PowerTiming.Rest]
const CARDS = [...cardIdsOfKind(CardKind.Denizen), ...cardIdsOfKind(CardKind.Relic)].filter((cardId) =>
    cardPowers(cardId).some((power) => hasEffect(power) && ACTED.includes(power.timing))
)

// The table asks for each seat's actions on that seat's own view, where host-only values and others'
// hidden values cannot be read; an availability check that reads one empties the seat's whole list.
describe("every Action and Rest power leaves each seat's offer the same on its own view as on the server", () => {
    it('walks every built card with such a power, the two that judge a Campaign before it is declared among them', () => {
        expect(CARDS.length).toBeGreaterThan(50)
        expect(CARDS).toEqual(expect.arrayContaining(['denizen.beast.wild-allies', 'denizen.order.captains']))
    })

    for (const cardId of CARDS) {
        const name = cardDefinition(cardId)?.name ?? cardId
        const places = cardId.startsWith('relic.') ? (['held'] as const) : (['held', 'site'] as const)
        for (const at of places) {
            it(`${name} (${at})`, () => {
                for (const phase of [MachineState.ActPhase, MachineState.RestPhase]) {
                    const state = table(phase, cardId, at)
                    // A power the server skips (unaffordable, out of reach) never runs its checks,
                    // so each must be offered there before the views are compared.
                    const timing = phase === MachineState.ActPhase ? PowerTiming.Action : PowerTiming.Rest
                    const offered = legalPowers(new HydratedOathGameState(state), 'me', timing)
                    for (const power of cardPowers(cardId)) {
                        if (!hasEffect(power) || power.timing !== timing) continue
                        expect(
                            offered.some((use) => use.cardId === cardId && use.powerIndex === power.powerIndex),
                            `${phase}: power ${power.powerIndex} offered on the server`
                        ).toBe(true)
                    }
                    for (const playerId of SEATS) {
                        const view: Visibility.Perspective = { kind: 'player', playerId }
                        const server = engine.getValidActionTypesForPlayer(game, state, playerId)
                        const own = engine.getValidActionTypesForPlayer(game, served(state, view), playerId, { perspective: view })
                        expect(own, `${phase}, ${playerId}`).toEqual(server)
                    }
                }
            })
        }
    }
})

// R-7.2.2 — a power that moves its own card reads that card's lock, here Ancient Bloodline held by another seat
// who rules the site: the refusal must read the same on each seat's own view.
describe("Roving Terror at a site another seat rules with Ancient Bloodline is refused the same on each seat's own view", () => {
    const ROVING = 'denizen.beast.roving-terror'
    const BLOODLINE = 'denizen.nomad.ancient-bloodline'
    const WOLVES = 'denizen.beast.wolves'
    const power = required(cardPowers(ROVING).find((p) => p.timing === PowerTiming.Action), 'Roving Terror Action')
    const toWolves = [{ kind: PowerChoiceKind.Card as const, cardId: WOLVES }]

    /** As the sweep's table with Roving Terror at c1, but the foe rules c1 and holds Ancient Bloodline faceup. */
    function lockedTable() {
        const d = table(MachineState.ActPhase, ROVING, 'site')
        d.warbandsBySite = { ...d.warbandsBySite, c1: { me: 1, foe: 2 } }
        d.players = d.players.map((p) =>
            p.playerId === 'foe' ? { ...p, advisers: [...p.advisers, { cardId: BLOODLINE, faceUp: true }] } : p
        )
        return d
    }

    it("the server refuses me the move to Wolves at c2, and so does my own view; every seat's offer is the same", () => {
        const state = lockedTable()
        const server = new HydratedOathGameState(state)
        const view: Visibility.Perspective = { kind: 'player', playerId: 'me' }
        const own = OathVisibility.state.guardForExecution(new HydratedOathGameState(served(state, view)), view)
        const use = (s: HydratedOathGameState) =>
            HydratedUseActionPower.reasonCannotUse(s, 'me', ROVING, power.powerIndex, toWolves)
        expect(use(server)).toBeDefined()
        expect(use(own)).toBe(use(server))
        expect(legalChoices(own, 'me', power)).toEqual(legalChoices(server, 'me', power))
        expect(legalChoices(server, 'me', power)[0].options).toEqual([])
        for (const playerId of SEATS) {
            const seat: Visibility.Perspective = { kind: 'player', playerId }
            const serverTypes = engine.getValidActionTypesForPlayer(game, state, playerId)
            const ownTypes = engine.getValidActionTypesForPlayer(game, served(state, seat), playerId, { perspective: seat })
            expect(ownTypes, playerId).toEqual(serverTypes)
        }
    })

    it('without the lock (I rule c1) the server allows the same move, so the refusal above is the lock', () => {
        const state = new HydratedOathGameState(table(MachineState.ActPhase, ROVING, 'site'))
        expect(HydratedUseActionPower.reasonCannotUse(state, 'me', ROVING, power.powerIndex, toWolves)).toBeUndefined()
    })
})

const DEFENDER_PLANS = [...cardIdsOfKind(CardKind.Denizen), ...cardIdsOfKind(CardKind.Relic)].filter((cardId) =>
    cardPowers(cardId).some(
        (power) =>
            hasEffect(power) &&
            power.timing === PowerTiming.BattlePlan &&
            (power.battlePlanSide === BattlePlanSide.Defender || power.battlePlanSide === BattlePlanSide.Either)
    )
)

/** The sweep's table with the foe holding `cardId` faceup, and me campaigning against the foe at c1. */
function defendingTable(cardId: string) {
    const d = table(MachineState.ActPhase, 'denizen.hearth.storyteller', 'site')
    d.players = d.players.map((p) => (p.playerId === 'foe' ? { ...p, advisers: [...p.advisers, { cardId, faceUp: true }] } : p))
    const s = new HydratedOathGameState(d)
    new HydratedCampaign(buildAction(Campaign, { playerId: 'me', defender: { kind: 'player', playerId: 'foe' }, targets: [siteTarget('c1')], attackDice: 1 })).apply(s)
    return s.dehydrate()
}

// The defender judges each plan it ticks, and each move or pick a plan's editor offers, on its own view.
describe("every battle plan the defender can tick is judged the same on the defender's own view as on the server", () => {
    it('walks every built card with a defending plan, Warning Signals among them', () => {
        expect(DEFENDER_PLANS.length).toBeGreaterThan(20)
        expect(DEFENDER_PLANS).toContain('denizen.nomad.warning-signals')
    })

    for (const cardId of DEFENDER_PLANS) {
        it(cardDefinition(cardId)?.name ?? cardId, () => {
            const state = defendingTable(cardId)
            const server = new HydratedOathGameState(state)
            const view: Visibility.Perspective = { kind: 'player', playerId: 'foe' }
            const own = OathVisibility.state.guardForExecution(new HydratedOathGameState(served(state, view)), view)
            expect(HydratedCampaignDefend.reasonCannotDefend(server, 'foe', []), 'the foe answers').toBeUndefined()
            for (const power of cardPowers(cardId)) {
                if (!hasEffect(power) || power.timing !== PowerTiming.BattlePlan) continue
                const ticked = (choices: PowerChoice[]) => [{ cardId, powerIndex: power.powerIndex, choices }]
                const first = legalChoices(server, 'foe', power).find((c) => c.options.length > 0)?.options[0]
                const earlier = first ? [first] : []
                expect(legalChoices(own, 'foe', power, earlier)).toEqual(legalChoices(server, 'foe', power, earlier))
                for (const choices of [[], earlier]) {
                    expect(HydratedCampaignDefend.reasonCannotDefend(own, 'foe', ticked(choices))).toBe(
                        HydratedCampaignDefend.reasonCannotDefend(server, 'foe', ticked(choices))
                    )
                }
            }
            expect(HydratedCampaignDefend.usablePlans(own, 'foe')).toEqual(HydratedCampaignDefend.usablePlans(server, 'foe'))
        })
    }
})
