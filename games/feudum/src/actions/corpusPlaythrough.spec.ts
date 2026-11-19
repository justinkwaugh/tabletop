import { describe, expect, it } from 'vitest'
import { ActionCards, ActionCardKinds } from '../data/cards.js'
import { VesselTypes, type Good } from '../data/components.js'
import { Mandates } from '../data/writs.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { conservationBreaks } from '../model/canonicalValidator.js'
import { giveTile, returnAllGoods, tableInWindow } from '../testing/atWill.js'
import { meetCharter } from '../testing/charters.js'
import {
    answer,
    Battlefield,
    commit,
    conquer,
    holdWrit,
    PawnOf,
    tableAtCombat
} from '../testing/combat.js'
import {
    arrange,
    AtWill,
    CardCases,
    caseNamed,
    CharterCases,
    fillersBeside,
    forfeit,
    play,
    Replays,
    replayRecord,
    roundTo,
    setStars,
    tableHolding,
    tableToReplay,
    WeaponBonuses
} from '../testing/corpus.js'
import { cardKey, corpusGames, writKey, type CorpusGame } from '../testing/corpusWalk.js'
import { rowOf, scoredIn } from '../testing/gameEnd.js'
import { giveGood, giveSeal, setUp } from '../testing/improving.js'
import { showOnStacks } from '../testing/roundEnd.js'
import { giveFood, starve, tableAtStarve } from '../testing/starve.js'
import { canonicalOf } from '../testing/state.js'
import type { Table } from '../testing/table.js'
import { answerOf, replayWalk, undoAction, withoutClock, withoutRowId } from '../testing/walk.js'
import { cardOf, cardPlayOffers } from './cardPlay.js'
import { commitAttackOffer } from './commitAttack.js'
import { isPlayMandate, type TakenReward } from './playMandate.js'
import type { ScoreGameMetadata } from './scoreGame.js'

/** R-4.11.2 One stack gone in the fourth epoch: this round's end is the dawn of the fifth. */
const LastRoundTops = ['V', 4, 4, 4, 4, 4] as const
const LastButOneEpoch = 4

/** R-4.4.2 What a reward says it gave, from the registry's row. */
function receivedFrom(reward: TakenReward) {
    switch (reward.kind) {
        case 'goods':
            return { kind: 'goods', goods: expect.any(Array) }
        case 'bead':
            return { kind: 'bead', sealIds: expect.any(Array) }
        case 'vessel':
            return { kind: 'vessel', vessel: reward.vessel }
        default:
            return { kind: reward.kind, amount: reward.amount }
    }
}

/** R-X.2 The effect is undone by its own record, back to the state it fired on, and totals hold. */
function fires(table: Table, effect: () => void): void {
    const before = table.state
    const from = table.processed.length
    effect()
    expect(table.processed.length).toBeGreaterThan(from)
    expect(conservationBreaks(canonicalOf(table.hydrated()))).toEqual([])
    const undone = table.processed
        .slice(from)
        .reduceRight((state, action) => undoAction(action, state), table.state)
    expect(undone).toEqual(before)
}

/**
 * R-3.2, R-4.11.2, R-6.1, R-6.2 Whatever the effect left, the game goes on: stacks at the last
 * trigger, every card given up, every other ask answered, through the dawn to `ScoreGame`.
 */
function playToTheEnd(table: Table): ScoreGameMetadata {
    table.moveTo((state) => {
        showOnStacks(state, LastRoundTops)
        state.epoch = LastButOneEpoch
        return state.machineState
    })
    const from = table.processed.length
    while (table.state.machineState !== MachineState.EndOfGame) {
        const { asked } = table
        const state = table.hydrated()
        if (state.machineState === MachineState.PlayingCards) {
            forfeit(table, asked, table.seat(asked).requireHand()[0])
        } else {
            table.send(asked, answerOf(state, asked))
        }
    }
    expect(table.hydrated().winningPlayerIds.length).toBeGreaterThan(0)
    expect(conservationBreaks(canonicalOf(table.hydrated()))).toEqual([])
    return scoredIn(table.processed.slice(from))
}

/** One line of the sweep: the component, the way it is used and the rule that proves. */
interface SweepEntry {
    readonly componentId: string
    readonly mode: string
    readonly rule: string
}

/** R-3.5 What each card's plays are called in the sweep's names. */
const CardEntries = CardCases.map((row) => ({
    row,
    componentId: cardOf(row.kind).id,
    mode: row.use === 'special' ? `special: ${row.name}` : `regular: ${row.name}`,
    rule: row.rule
}))

const ReplayEntries = Replays.map((row) => ({
    row,
    componentId: cardOf('repeat').id,
    mode: `${row.mode}: ${row.name}`,
    rule: row.mode === 'repeat' ? 'R-3.15.1' : 'R-3.15.2'
}))

const ForfeitEntries = ActionCardKinds.map((kind) => ({
    kind,
    componentId: cardOf(kind).id,
    mode: 'forfeited',
    rule: 'R-3.2'
}))

const MandateEntries = AtWill.map((row) => ({
    ...row,
    componentId: row.writId,
    mode: row.rewardGuild
        ? `for ${row.rewardGuild}${row.vessel ? `, ${row.vessel}` : ''}`
        : `alternative ${row.input.alternative}`,
    rule: 'R-4.4.2'
}))

const WeaponEntries = WeaponBonuses.map((row) => ({
    ...row,
    componentId: row.writId,
    mode: `alternative ${row.alternative}`,
    rule: 'R-4.4-H1, R-4.8.2'
}))

const CharterEntries = CharterCases.map((row) => ({
    ...row,
    componentId: row.writId,
    mode: 'at final scoring',
    rule: 'R-4.4.3, R-6.2'
}))

/** What has no play of its own in the sweep above, with what the rules say instead. */
const WhyNot = [
    {
        componentId: cardOf('conquer').id,
        mode: 'replayed',
        rule: 'R-3.15.2',
        why: "The card's crossed x2: Conquer is refused by both Repeat and Déjà Vu."
    },
    {
        componentId: cardOf('defend').id,
        mode: 'replayed',
        rule: 'R-3.15.2',
        why: "The card's crossed x2: Defend is refused by both Repeat and Déjà Vu."
    },
    {
        componentId: cardOf('defend').id,
        mode: 'special in turn',
        rule: 'R-3.14.2',
        why: 'Royal Immunity answers a Starve the People and is never played on its owner’s turn.'
    },
    {
        componentId: cardOf('repeat').id,
        mode: 'with nothing played',
        rule: 'R-3.15.1',
        why: 'Repeat has no action of its own: with nothing to replay it can only be forfeited.'
    }
] as const

describe('corpus playthrough: the sweep is whole', () => {
    const swept: readonly SweepEntry[] = [
        ...CardEntries,
        ...ReplayEntries,
        ...ForfeitEntries,
        ...MandateEntries,
        ...WeaponEntries,
        ...CharterEntries,
        ...WhyNot
    ]

    it('R-3.5 every card has a regular and a special line, or says why not', () => {
        for (const { id, kind } of ActionCards) {
            const modes = swept.filter(({ componentId }) => componentId === id)
            expect(
                modes.some(({ mode }) => /^(regular|repeat|flipped)/.test(mode)),
                kind
            ).toBe(true)
            expect(
                modes.some(({ mode }) => /^(special|deja-vu)/.test(mode)),
                kind
            ).toBe(true)
        }
    })

    it('R-4.4.2 every alternative of every mandate (R-4.4-H4 any vessel once per vessel), R-4.4.3 every charter', () => {
        const alternatives = Mandates.flatMap((mandate) =>
            (mandate.kind === 'turn-in' ? mandate.alternatives : mandate.guildRewards).map(
                ({ reward }) => reward
            )
        ).reduce((sum, reward) => sum + (reward.kind === 'any-vessel' ? VesselTypes.length : 1), 0)
        expect(MandateEntries.length + WeaponEntries.length).toBe(alternatives)
        expect(CharterEntries).toHaveLength(8)
    })

    it.each(swept)('$componentId $mode names $rule', ({ componentId, rule }) => {
        expect(componentId).toMatch(/^(card\.action|writ\.(mandate|charter))\./)
        expect(rule).toMatch(/^R-\d/)
    })
})

describe('corpus playthrough: the cards', () => {
    it.each(CardEntries)('$componentId $mode, $rule', ({ row }) => {
        const held = tableHolding([row.kind, ...fillersBeside(row.kind)])
        arrange(row, held)
        fires(held.table, () => play(row, held, {}, { kind: row.kind, use: row.use }))
        playToTheEnd(held.table)
    })

    it.each(ReplayEntries)('$componentId $mode, $rule', ({ row }) => {
        const held = tableToReplay(row)
        fires(held.table, () => play(row, held, { asRepeat: row.mode }, replayRecord(row)))
        expect(held.table.seat(held.seat).repeatUsed).toBe(true)
        playToTheEnd(held.table)
    })

    it.each(ForfeitEntries)('$componentId $mode, $rule', ({ kind }) => {
        const { table, seat } = tableHolding([kind, ...fillersBeside(kind)])
        fires(table, () => forfeit(table, seat, kind))
        expect(table.seat(seat).played.at(-1)).toMatchObject({ kind })
        playToTheEnd(table)
    })

    it('card.action.defend flipped: R-3.14.1 when its owner is conquered', () => {
        const combat = tableAtCombat(['defend', 'tax'])
        const { table, defenderId } = combat
        conquer(combat, PawnOf(defenderId))
        fires(table, () => answer(combat, true))
        expect(table.seat(defenderId).played).toEqual([{ kind: 'defend', use: 'defend-flip' }])
        playToTheEnd(table)
    })

    it('card.action.defend special: Royal Immunity, R-3.14.2 answers a Starve', () => {
        const combat = tableAtStarve('serf')
        const { table, defenderId } = combat
        setUp(table, (state) => giveFood(state, defenderId))
        starve(combat)
        expect(table.state.machineState).toBe(MachineState.AwaitingImmunity)
        fires(table, () =>
            table.send(defenderId, {
                type: ActionType.AnswerStarve,
                revealsInfo: true,
                royalImmunity: true
            })
        )
        expect(table.seat(defenderId).played).toEqual([{ kind: 'defend', use: 'special' }])
        expect(table.state.spaces[Battlefield].serf).toMatchObject({
            playerId: defenderId,
            immune: true
        })
        playToTheEnd(table)
    })
})

describe('corpus playthrough: the cards that do not fire, and why', () => {
    it.each(['Conquer', 'Defend, in turn'])('R-3.15.2 %s is refused a replay', (name) => {
        const row = caseNamed(name)
        const [filler] = fillersBeside(row.kind)
        const held = tableHolding(['repeat', row.kind, filler])
        forfeit(held.table, held.seat, row.kind)
        roundTo(held.table, held.seat)
        arrange(row, held)
        const state = held.table.hydrated()
        for (const asRepeat of ['repeat', 'deja-vu'] as const) {
            expect(() =>
                held.table.send(held.seat, {
                    ...row.move(state, held.seat, held.rival),
                    asRepeat
                })
            ).toThrow(`${cardOf(row.kind).printedName} can't be replayed.`)
        }
    })

    it('R-3.14.2 Royal Immunity is not offered on its owner’s turn', () => {
        const { table, seat } = tableHolding(['defend', 'tax'])
        setUp(table, (state) => giveFood(state, seat))
        expect(cardPlayOffers(table.hydrated(), seat).cards[0].special).toBe(false)
        expect(table.offered(seat)).not.toContain(ActionType.AnswerStarve)
    })

    it('R-3.15.1 Repeat with nothing played is refused, and forfeits instead', () => {
        const row = caseNamed('Move')
        const held = tableHolding(['repeat', 'move', 'tax'])
        arrange(row, held)
        expect(() =>
            held.table.send(held.seat, {
                ...row.move(held.table.hydrated(), held.seat, held.rival),
                asRepeat: 'repeat'
            })
        ).toThrow(`You haven't played ${cardOf('move').printedName} this round.`)
    })
})

describe('corpus playthrough: the mandates', () => {
    it.each(MandateEntries)(
        '$componentId $mode, $rule',
        ({ writId, input, turnedIn, reward, rewardGuild }) => {
            const { table, playerId } = tableInWindow('before a card', (state, seat) => {
                returnAllGoods(state, seat)
                holdWrit(state, seat, writId)
                setStars(state, seat, rewardGuild)
                for (const good of turnedIn) {
                    giveGood(state, seat, good)
                }
            })
            fires(table, () =>
                table.send(playerId, { type: ActionType.PlayMandate, writId, ...input })
            )
            const action = table.processed.find((processed) => isPlayMandate(processed))
            expect(action).toMatchObject({ writId })
            expect(action?.metadata).toMatchObject({
                received: receivedFrom(reward)
            })
            playToTheEnd(table)
        }
    )

    it.each(WeaponEntries)(
        '$componentId $mode, $rule',
        ({ writId, alternative, turnedIn, attack }) => {
            const combat = tableAtCombat()
            const { table, attackerId, defenderId } = combat
            setUp(table, (state) => {
                returnAllGoods(state, attackerId)
                holdWrit(state, attackerId, writId)
                for (const good of turnedIn) {
                    giveGood(state, attackerId, good)
                }
            })
            conquer(combat, PawnOf(defenderId))
            answer(combat)
            fires(table, () => {
                const [action] = commit(combat, { weapons: [{ writId, alternative }] })
                expect(action).toMatchObject({
                    metadata: { weaponStrengths: [{ writId, attack }] }
                })
            })
            playToTheEnd(table)
        }
    )

    it.each(WeaponEntries.filter(({ turnedIn }) => turnedIn.length > 0))(
        '$componentId $mode, R-4.3.3 a tile covers its good',
        ({ writId, alternative, turnedIn, attack }) => {
            const combat = tableAtCombat()
            const { table, attackerId, defenderId } = combat
            setUp(table, (state) => {
                returnAllGoods(state, attackerId)
                holdWrit(state, attackerId, writId)
                for (const _good of turnedIn) {
                    giveTile(state, attackerId)
                }
            })
            conquer(combat, PawnOf(defenderId))
            answer(combat)
            const tiles = table.seat(attackerId).regionTiles
            const wildTiles = turnedIn.map((good: Good, index) => ({ tileId: tiles[index], good }))
            fires(table, () => {
                const [action] = commit(combat, {
                    weapons: [{ writId, alternative }],
                    wildTiles
                })
                expect(action).toMatchObject({
                    metadata: { weaponStrengths: [{ writId, attack }] }
                })
            })
            playToTheEnd(table)
        }
    )
})

describe('corpus playthrough: the charters', () => {
    it.each(CharterEntries)('$componentId $mode, $rule', ({ writId, vp }) => {
        const { table, playerId } = tableInWindow('before a card', (state, seat) => {
            holdWrit(state, seat, writId)
            giveSeal(state, seat)
            meetCharter(state, seat, writId)
        })

        const row = rowOf(playToTheEnd(table), playerId)

        expect(row.charters).toEqual([{ writId, vp }])
        expect(row.total).toBe(row.voyage.vp + row.largeEmpire.vp + row.shillings.vp + vp)
    })

    it.each(CharterEntries)(
        '$componentId held, not sealed: R-4.4.3 scores nothing',
        ({ writId }) => {
            const { table, playerId } = tableInWindow('before a card', (state, seat) => {
                holdWrit(state, seat, writId)
                meetCharter(state, seat, writId)
            })
            expect(rowOf(playToTheEnd(table), playerId).charters).toEqual([])
        }
    )
})

/**
 * Real games, nothing edited, each seat wanting what no earlier game has fired. A change to the
 * rules or to the seats can move a first firing to another seed: a line below then fails by name,
 * and the list is re-pinned, not weakened.
 */
const RealGames: readonly CorpusGame[] = [
    [1, 4],
    [1, 3],
    [1, 5],
    [2, 3],
    [2, 5],
    [3, 4],
    [3, 5],
    [11, 5],
    [12, 4]
].map(([n, numPlayers]) => ({ seed: n.toString(16).padStart(32, '0'), numPlayers }))

const { fired, walks } = corpusGames(RealGames)

/** Every way to play a card that a real game can reach, R-3.14.2 and R-3.15 included. */
const RealCardPlays = [
    ...CardEntries.map(({ row, componentId, mode, rule }) => ({
        componentId,
        mode,
        rule,
        key: cardKey(row.kind, row.use)
    })),
    {
        componentId: cardOf('defend').id,
        mode: 'flipped',
        rule: 'R-3.14.1',
        key: cardKey('defend', 'defend-flip')
    },
    {
        componentId: cardOf('defend').id,
        mode: 'special: Royal Immunity',
        rule: 'R-3.14.2',
        key: cardKey('defend', 'special')
    },
    {
        componentId: cardOf('repeat').id,
        mode: 'regular: a replay at x2',
        rule: 'R-3.15.1',
        key: cardKey('repeat', 'regular')
    },
    {
        componentId: cardOf('repeat').id,
        mode: 'special: Déjà Vu',
        rule: 'R-3.15.2',
        key: cardKey('repeat', 'special')
    }
]

/** The walk records a guild's reward by its guild, whichever vessel an any-vessel reward took. */
const MandateKeys = new Map(
    MandateEntries.map(({ componentId, rule, writId, rewardGuild, input }) => {
        const key = writKey(writId, rewardGuild ?? input.alternative)
        const mode = rewardGuild ? `for ${rewardGuild}` : `alternative ${input.alternative}`
        return [key, { componentId, mode, rule, key }]
    })
)

const RealWrits = [
    ...MandateKeys.values(),
    ...WeaponEntries.map(({ componentId, mode, rule, writId, alternative }) => ({
        componentId,
        mode,
        rule,
        key: writKey(writId, alternative)
    })),
    ...CharterEntries.map(({ componentId, mode, rule, writId }) => ({
        componentId,
        mode,
        rule,
        key: writId
    }))
]

const NoWeaponAtAnAttack = 'These games never bring this weapon to its holder’s attack.'
const NoCharterScored =
    'Scores only when sealed and met; the seats seal what they can and build to no charter.'

/** What these games do not reach, and why: the fixtures above fire each through the engine. */
const NotReached: ReadonlyMap<string, string> = new Map([
    [writKey('writ.mandate.1', 0), NoWeaponAtAnAttack],
    [writKey('writ.mandate.1', 1), NoWeaponAtAnAttack],
    [writKey('writ.mandate.3', 0), NoWeaponAtAnAttack],
    [writKey('writ.mandate.3', 1), NoWeaponAtAnAttack],
    [writKey('writ.mandate.6', 'alchemist'), 'No holder of this writ reaches 3 Alchemist stars.'],
    [writKey('writ.mandate.7', 1), 'No holder of this writ has all four goods at once.'],
    ...CharterCases.map(({ writId }): [string, string] => [writId, NoCharterScored])
])

describe('corpus playthrough: real games, nothing edited', () => {
    it.each(RealCardPlays)('$componentId $mode, $rule', ({ key }) => {
        expect(fired.has(key), key).toBe(true)
    })

    it.each(RealWrits)('$componentId $mode, $rule, or names why not', ({ key }) => {
        expect(fired.has(key), NotReached.get(key) ?? key).toBe(!NotReached.has(key))
    })

    it('every name in the why-not list is a real line of the sweep', () => {
        const keys = RealWrits.map(({ key }) => key)
        expect(keys.filter((key) => NotReached.has(key))).toHaveLength(NotReached.size)
    })

    it.each(RealGames.map((game, index) => ({ ...game, walk: walks[index] })))(
        'seed $seed at $numPlayers seats: R-6.2 scores, R-X.2 replays alike and undoes whole',
        ({ seed, walk }) => {
            expect(walk.final.machineState).toBe(MachineState.EndOfGame)
            expect(scoredIn(walk.steps.flatMap(({ processed }) => processed)).winners).not.toEqual(
                []
            )

            const replayed = replayWalk(seed, walk)
            expect(replayed.steps.flatMap(({ processed }) => processed).map(withoutClock)).toEqual(
                walk.steps.flatMap(({ processed }) => processed).map(withoutClock)
            )
            expect(withoutRowId(replayed.final)).toEqual(withoutRowId(walk.final))

            const undone = walk.steps
                .flatMap(({ processed }) => processed)
                .reduceRight((state, action) => undoAction(action, state), walk.final)
            expect(undone).toEqual(walk.initial)
        }
    )

    it('R-4.3.3 a seat with a tile and no saltpeter commits none: the most counts tiles', () => {
        const combat = tableAtCombat()
        const { table, attackerId, defenderId } = combat
        setUp(table, (state) => {
            returnAllGoods(state, attackerId)
            giveTile(state, attackerId)
        })
        conquer(combat, PawnOf(defenderId))
        answer(combat)
        expect(commitAttackOffer(table.hydrated(), attackerId)?.saltpeterMost).toBeGreaterThan(0)
        const move = answerOf(table.hydrated(), attackerId)
        expect(move).toMatchObject({ type: ActionType.CommitAttack, saltpeter: 0 })
    })
})
