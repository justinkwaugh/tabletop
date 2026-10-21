import { describe, expect, it } from 'vitest'
import { Color, assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import type { WarbandOwner } from '../model/warbandCounts.js'
import { openTurn, testPlayer, testState } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { adviser } from '../testing/tables.js'
import { ongoingCampaign } from '../testing/required.js'
import { boardWarbands, site, siteTarget, siteWarbands } from '../testing/choices.js'
import { HydratedCampaign, Campaign } from '../actions/campaign.js'
import { choiceSpecsAt, legalChoices, type PowerChoice } from '../util/powerChoice.js'
import { BattlePlanSide, cardPowers, PowerTiming, powerIndexOf, type CardPower } from '../data/cardPowers.js'
import { partiesOf } from '../util/campaignRoll.js'
import { effectFor } from './registry.js'
import { applyWarningSignals } from './searchPlacementPowers.js'
import { applyMessengerMoves } from './actionCards.js'
import '../powers/index.js'

const WARNING = 'denizen.nomad.warning-signals'
const MESSENGER = 'denizen.order.messenger'
const BANDIT_CROWN = 'relic.bandit-crown'

function powerOf(cardId: string, timing: PowerTiming): CardPower {
    const power = cardPowers(cardId)[powerIndexOf(cardId, timing)]
    assertExists(power, `${cardId} prints a ${timing} power`)
    return power
}

const WARNING_POWER = () => powerOf(WARNING, PowerTiming.BattlePlan)
const MESSENGER_POWER = () => powerOf(MESSENGER, PowerTiming.Action)

function where(s: HydratedOathGameState, playerId: string) {
    return { board: { ...s.getPlayerState(playerId).warbandsOnBoard }, sites: structuredClone(s.warbandsBySite) }
}

interface Answer {
    reason: string | undefined
    after: ReturnType<typeof where>
    offers: PowerChoice[][]
}

/** What `power`'s choice domains offer: the sequential ones read on `after`, the others on `s`. */
function offersOn(s: HydratedOathGameState, after: HydratedOathGameState, playerId: string, power: CardPower): PowerChoice[][] {
    return choiceSpecsAt(s, power).map((spec) => {
        assertExists(spec.domain, `${power.cardId} names each choice's domain`)
        return spec.domain(spec.sequential ? after : s, playerId, power)
    })
}

type Moves = (state: HydratedOathGameState, playerId: string, choices: readonly PowerChoice[]) => string | undefined

/** The check as it ran before: the moves made on a whole-state copy. */
function onWholeCopy(s: HydratedOathGameState, playerId: string, power: CardPower, choices: PowerChoice[], moves: Moves): Answer {
    const copy = new HydratedOathGameState(s.dehydrate())
    const reason = moves(copy, playerId, choices)
    return { reason, after: where(copy, playerId), offers: offersOn(s, copy, playerId, power) }
}

/** The check as the card registers it now: its own hooks, and the editor's offers through `legalChoices`. */
function asRegistered(s: HydratedOathGameState, playerId: string, power: CardPower, choices: PowerChoice[], reasonOf: (ctx: { state: HydratedOathGameState; playerId: string; power: CardPower; choices: PowerChoice[] }) => string | undefined): Answer {
    const stateAfter = effectFor(power)?.stateAfter
    assertExists(stateAfter, `${power.cardId} reads its moves on the state they leave`)
    const ctx = { state: s, playerId, power, choices }
    const after = stateAfter(ctx)
    return { reason: reasonOf(ctx), after: where(after, playerId), offers: legalChoices(s, playerId, power, choices).map((c) => c.options) }
}

const warningMoves: Moves = (state, playerId, choices) => applyWarningSignals(state, playerId, choices, true).reason
const messengerMoves: Moves = (state, playerId, choices) => applyMessengerMoves(state, playerId, choices).reason

function warningAnswer(s: HydratedOathGameState, choices: PowerChoice[]): Answer {
    const hooks = effectFor(WARNING_POWER())?.battlePlan
    assertExists(hooks, 'Warning Signals is a battle plan')
    const campaign = ongoingCampaign(s)
    return asRegistered(s, 'bea', WARNING_POWER(), choices, (ctx) =>
        hooks.reasonCannotUse?.({ ...ctx, campaign: { parties: partiesOf(s, campaign), side: BattlePlanSide.Defender, pools: { attackPool: 0, defensePool: 0 } } })
    )
}

function messengerAnswer(s: HydratedOathGameState, choices: PowerChoice[]): Answer {
    const reasonCannotResolve = effectFor(MESSENGER_POWER())?.reasonCannotResolve
    assertExists(reasonCannotResolve, 'Messenger checks its moves')
    return asRegistered(s, 'rhys', MESSENGER_POWER(), choices, reasonCannotResolve)
}

/** Both answers, the server state left as it was. */
function compare(s: HydratedOathGameState, choices: PowerChoice[], card: 'warning' | 'messenger') {
    const playerId = card === 'warning' ? 'bea' : 'rhys'
    const before = where(s, playerId)
    const old = card === 'warning' ? onWholeCopy(s, playerId, WARNING_POWER(), choices, warningMoves) : onWholeCopy(s, playerId, MESSENGER_POWER(), choices, messengerMoves)
    const now = card === 'warning' ? warningAnswer(s, choices) : messengerAnswer(s, choices)
    expect(where(s, playerId)).toEqual(before)
    return { old, now }
}

/**
 * Dana campaigns against Bea at c1. Bea rules c1 (2), p1 (3) and h1 (1) and holds 2 on their board
 * and Warning Signals; with `crown` Bea also holds the Bandit Crown, so the bandits hold the sites
 * Bea rules alone and every empty site.
 */
function defending(crown = false): HydratedOathGameState {
    const s = testState(
        [
            testPlayer({ playerId: 'dana', color: Color.Red, siteId: 'c1', favor: 4, secrets: 3, supply: 6, warbandsOnBoard: { dana: 3 } }),
            testPlayer({ playerId: 'bea', color: Color.Blue, siteId: 'c1', favor: 3, warbandsOnBoard: { bea: 2 }, advisers: [adviser(WARNING)], relicIds: crown ? [BANDIT_CROWN] : [] })
        ],
        { warbandsBySite: { c1: { bea: 2 }, p1: { bea: 3 }, h1: { bea: 1 }, c2: { dana: 2 } } }
    )
    openTurn(s, 'dana')
    new HydratedCampaign(buildAction(Campaign, { playerId: 'dana', defender: { kind: 'player', playerId: 'bea' }, targets: [siteTarget('c1')], attackDice: 2 })).apply(s)
    return s
}

/** Rhys rules c1 (1) and c2 (3, beside Ann's 3), holds 2 on their board, and has Messenger at c1. */
function messengerTable(): HydratedOathGameState {
    const s = testState(
        [
            testPlayer({ playerId: 'rhys', color: Color.Red, siteId: 'c1', favor: 3, secrets: 2, supply: 3, warbandsOnBoard: { rhys: 2 }, warbandsInPersonalBank: { rhys: 5 } }),
            testPlayer({ playerId: 'ann', color: Color.Blue, siteId: 'c1', favor: 2, secrets: 2, warbandsOnBoard: { ann: 2 }, warbandsInPersonalBank: { ann: 5 } })
        ],
        {
            denizensBySite: { c1: [MESSENGER], c2: [], h1: [] },
            warbandsBySite: { c1: { rhys: 1 }, c2: { ann: 3, rhys: 3 } },
            siteCards: { c1: 'site.mine', c2: 'site.river', p1: 'site.plains', h1: 'site.wastes' }
        }
    )
    openTurn(s, 'rhys')
    return s
}

const WARNING_CASES: { name: string; crown?: boolean; choices: PowerChoice[]; reason: string | undefined }[] = [
    { name: 'no moves', choices: [], reason: undefined },
    { name: 'a chain: off p1 to the board, then the board to h1', choices: [siteWarbands('p1', 'bea', 2), boardWarbands('bea', 'bea', 4), site('h1')], reason: undefined },
    { name: 'more warbands than p1 holds', choices: [siteWarbands('p1', 'bea', 3), site('c1')], reason: 'only 2 of those warbands may leave p1 (the last must stay)' },
    { name: "h1's last warband", choices: [siteWarbands('h1', 'bea', 1), site('c1')], reason: 'only 0 of those warbands may leave h1 (the last must stay)' },
    { name: "the board's last warband, after the board was emptied", choices: [boardWarbands('bea', 'bea', 2), site('c1'), boardWarbands('bea', 'bea', 1), site('p1')], reason: 'only 0 of those warbands on your board to move' },
    { name: 'board warbands with no site', choices: [boardWarbands('bea', 'bea', 1)], reason: 'warbands on your board need a site you rule to move to' },
    { name: 'a site Bea does not rule', choices: [siteWarbands('p1', 'bea', 1), site('c2')], reason: 'you do not rule c2' },
    { name: 'h1 filled by an earlier move lets more leave it', choices: [siteWarbands('p1', 'bea', 2), site('h1'), siteWarbands('h1', 'bea', 2), site('c1')], reason: undefined },
    { name: 'with the Crown, h1 emptied by an earlier move is still a site Bea rules', crown: true, choices: [siteWarbands('h1', 'bea', 1), site('c1'), siteWarbands('c1', 'bea', 1), site('h1')], reason: undefined },
    { name: 'without the Crown, h1 cannot be emptied', choices: [siteWarbands('h1', 'bea', 1), site('c1'), siteWarbands('c1', 'bea', 1), site('h1')], reason: 'only 0 of those warbands may leave h1 (the last must stay)' }
]

/** Sixteen moves, the cap: one off the board to c1, back to the board, eight times. */
const SIXTEEN = Array.from({ length: 8 }, () => [boardWarbands('rhys', 'rhys', 1), site('c1'), siteWarbands('c1', 'rhys', 1)]).flat()

const MESSENGER_CASES: { name: string; choices: PowerChoice[]; reason: string | undefined }[] = [
    { name: 'a chain: off c2 to the board, then the board to c1', choices: [siteWarbands('c2', 'rhys', 2), boardWarbands('rhys', 'rhys', 2), site('c1')], reason: undefined },
    { name: 'sixteen chained moves', choices: SIXTEEN, reason: undefined },
    { name: 'more warbands than c1 holds after an earlier move', choices: [siteWarbands('c2', 'rhys', 2), site('c1'), siteWarbands('c1', 'rhys', 3), site('c2')], reason: 'only 2 of those warbands may leave c1 (the last must stay)' },
    { name: "c1's last warband", choices: [siteWarbands('c1', 'rhys', 1), site('c2')], reason: 'only 0 of those warbands may leave c1 (the last must stay)' },
    { name: "the board's last warband", choices: [boardWarbands('rhys', 'rhys', 2), site('c1'), boardWarbands('rhys', 'rhys', 1), site('c2')], reason: 'only 0 of those warbands on your board to move' },
    { name: 'a site Rhys does not rule', choices: [siteWarbands('c2', 'rhys', 1), site('h1')], reason: 'you do not rule h1' }
]

/** A seeded run of numbers, so a failing list can be read again. */
function numbers(seed: number): () => number {
    let x = seed
    return () => {
        x = (x * 1103515245 + 12345) % 2147483648
        return x / 2147483648
    }
}

/**
 * Lists of up to 16 moves, each mostly picked from what the editor offers after the moves before it,
 * sometimes from `sources` and `sites` whatever the rules allow, a move's site sometimes left out.
 */
function randomLists(s: HydratedOathGameState, playerId: string, power: CardPower, seed: number, sources: PowerChoice[], sites: string[], count: number): PowerChoice[][] {
    const next = numbers(seed)
    const pick = <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)]
    return Array.from({ length: count }, () => {
        const choices: PowerChoice[] = []
        const moves = 1 + Math.floor(next() * 16)
        for (let i = 0; i < moves; i += 1) {
            const [offeredGroups, offeredSites] = legalChoices(s, playerId, power, choices).map((c) => c.options)
            choices.push(offeredGroups.length > 0 && next() < 0.85 ? pick(offeredGroups) : pick(sources))
            if (next() < 0.25) continue
            choices.push(offeredSites.length > 0 && next() < 0.85 ? pick(offeredSites) : site(pick(sites)))
        }
        return choices
    })
}

function groups(at: (owner: WarbandOwner, count: number) => PowerChoice, owner: WarbandOwner): PowerChoice[] {
    return [1, 2, 3, 4].map((count) => at(owner, count))
}

describe('Warning Signals checks its moves without a whole-state copy, and answers as the copy did', () => {
    for (const { name, crown, choices, reason } of WARNING_CASES) {
        it(name, () => {
            const { old, now } = compare(defending(crown), choices, 'warning')
            expect(old.reason).toBe(reason)
            expect(now).toEqual(old)
        })
    }

    it('on 400 seeded lists of up to 16 moves, with and without the Crown', () => {
        const sources = [
            ...groups((owner, n) => boardWarbands('bea', owner, n), 'bea'),
            ...['c1', 'p1', 'h1', 'c2', 'p2'].flatMap((siteId) => groups((owner, n) => siteWarbands(siteId, owner, n), 'bea'))
        ]
        let accepted = 0
        for (const crown of [false, true]) {
            const table = defending(crown)
            for (const choices of randomLists(table, 'bea', WARNING_POWER(), crown ? 7 : 5, sources, ['c1', 'p1', 'h1', 'c2', 'p2'], 200)) {
                const { old, now } = compare(table, choices, 'warning')
                expect(now, JSON.stringify(choices)).toEqual(old)
                if (old.reason === undefined) accepted += 1
            }
        }
        expect(accepted).toBeGreaterThan(25)
    })
})

describe('Messenger checks its moves without a whole-state copy, and answers as the copy did', () => {
    for (const { name, choices, reason } of MESSENGER_CASES) {
        it(name, () => {
            const { old, now } = compare(messengerTable(), choices, 'messenger')
            expect(old.reason).toBe(reason)
            expect(now).toEqual(old)
        })
    }

    it('on 200 seeded lists of up to 16 moves', () => {
        const sources = [
            ...groups((owner, n) => boardWarbands('rhys', owner, n), 'rhys'),
            ...['c1', 'c2', 'h1'].flatMap((siteId) => groups((owner, n) => siteWarbands(siteId, owner, n), 'rhys')),
            ...groups((owner, n) => siteWarbands('c2', owner, n), 'ann')
        ]
        let accepted = 0
        const table = messengerTable()
        for (const choices of randomLists(table, 'rhys', MESSENGER_POWER(), 11, sources, ['c1', 'c2', 'h1', 'p1'], 200)) {
            const { old, now } = compare(table, choices, 'messenger')
            expect(now, JSON.stringify(choices)).toEqual(old)
            if (old.reason === undefined) accepted += 1
        }
        expect(accepted).toBeGreaterThan(25)
    })
})
