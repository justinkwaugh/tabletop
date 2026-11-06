import { describe, expect, it } from 'vitest'
import type { Good, GuildId } from '../data/components.js'
import { Mandates, type MandateId, type MandateReward } from '../data/writs.js'
import { commitAttackOffer, commitAttackPreview } from '../actions/commitAttack.js'
import { playMandateOffers, reasonPlayMandateRefused } from '../actions/playMandate.js'
import { ActionType } from '../definition/actions.js'
import { conservationBreaks } from '../model/canonicalValidator.js'
import { giveTile, returnAllGoods, tableInWindow } from '../testing/atWill.js'
import {
    addPawn,
    answer,
    commit,
    conquer,
    holdWrit,
    PawnOf,
    tableAtCombat,
    type CombatTable
} from '../testing/combat.js'
import { setPawns } from '../testing/guilds.js'
import { giveGood, setUp } from '../testing/improving.js'
import { canonicalOf } from '../testing/state.js'
import { writRegistry } from './writRegistry.js'

const Bow: MandateId = 'writ.mandate.1'
const Sword: MandateId = 'writ.mandate.3'
const GoodsOrCoin: MandateId = 'writ.mandate.6'
const InfluenceOrSeal: MandateId = 'writ.mandate.8'

/** A seat holding this writ, with exactly these goods, before a card. */
function holding(writId: MandateId, goods: readonly Good[] = []) {
    return tableInWindow('before a card', (state, seat) => {
        returnAllGoods(state, seat)
        holdWrit(state, seat, writId)
        for (const good of goods) {
            giveGood(state, seat, good)
        }
    })
}

/** A seat holding this writ, with 3 status stars in this guild. */
function holdingWithStars(writId: MandateId, guild: GuildId, stars = 3) {
    return tableInWindow('before a card', (state, seat) => {
        holdWrit(state, seat, writId)
        setPawns(
            state,
            seat,
            Array.from({ length: stars }, () => guild)
        )
    })
}

describe('R-4.4 the mandates in the registry', () => {
    const mandateRegistrations = () =>
        writRegistry.registrations().filter((registration) => registration.timing !== 'end-scoring')

    it('registers all eight once, each with its printed text', () => {
        const registered = mandateRegistrations()
        expect(registered.map(({ writId }) => writId).toSorted()).toEqual(
            Mandates.map(({ id }) => id).toSorted()
        )
        expect(
            Object.fromEntries(registered.map(({ writId, printedText }) => [writId, printedText]))
        ).toEqual({
            'writ.mandate.1': 'Use bow for free: +1 attack / Turn in wood: +2 attack',
            'writ.mandate.2': 'Turn in food: flying machine* / Turn in wood: ship*',
            'writ.mandate.3': 'Use sword for free: +1 attack / Turn in iron: +2 attack',
            'writ.mandate.4': 'Turn in wood: ship* / Turn in iron: submersible*',
            'writ.mandate.5': 'Turn in food: 3s / Turn in wood & food: 7s',
            'writ.mandate.6': 'Reach 3★ in 1 guild to earn 3 goods, 3s or any vessel*',
            'writ.mandate.7':
                'Turn in iron, wood & food: 9s / Turn in sulfur, iron, wood & food: 13s',
            'writ.mandate.8': 'Reach 3★ in 1 guild to earn 3 influence*, 1 seal* or 1 bead*'
        })
    })

    it('R-4.4-H1 only the two weapons apply in an attack; the rest at will', () => {
        const timing = Object.fromEntries(
            mandateRegistrations().map(({ writId, timing }) => [writId, timing])
        )
        expect(timing).toMatchObject({
            [Bow]: 'attack',
            [Sword]: 'attack',
            'writ.mandate.2': 'at-will',
            'writ.mandate.4': 'at-will',
            'writ.mandate.5': 'at-will',
            [GoodsOrCoin]: 'at-will',
            'writ.mandate.7': 'at-will',
            [InfluenceOrSeal]: 'at-will'
        })
    })
})

describe('R-4.8.2 mandates 1 and 3 in CommitAttack (S36)', () => {
    /** A Conquer answered "no", the attacker holding this writ, its goods set by `edit`. */
    function atCommit(
        writId: MandateId,
        edit: (combat: CombatTable) => void = () => {}
    ): CombatTable {
        const combat = tableAtCombat()
        setUp(combat.table, (state) => {
            returnAllGoods(state, combat.attackerId)
            holdWrit(state, combat.attackerId, writId)
        })
        edit(combat)
        conquer(combat, PawnOf(combat.defenderId))
        answer(combat)
        return combat
    }

    const Weapons: readonly (readonly [string, MandateId, Good])[] = [
        ['mandate 1', Bow, 'wood'],
        ['mandate 3', Sword, 'iron']
    ]

    it.each(Weapons)('%s is free for +1 attack', (_name, writId) => {
        const combat = atCommit(writId)
        const { table, attackerId } = combat
        const [action] = commit(combat, { weapons: [{ writId, alternative: 0 }] })
        expect(action).toMatchObject({
            metadata: { attack: { weapons: 1 }, weaponStrengths: [{ writId, attack: 1 }] }
        })
        expect(table.state.publicDeckWrits.map((known) => known.writId)).toContain(writId)
        expect(table.seat(attackerId).writCount).toBe(0)
    })

    it.each(Weapons)(
        '%s takes its good, to the haversack, for +2 attack',
        (_name, writId, good) => {
            const combat = atCommit(writId, ({ table, attackerId }) =>
                setUp(table, (state) => giveGood(state, attackerId, good))
            )
            const { table, attackerId } = combat
            const haversack = table.state.supply.haversack[good]
            const [action] = commit(combat, { weapons: [{ writId, alternative: 1 }] })
            expect(action).toMatchObject({
                metadata: { attack: { weapons: 2 }, weaponStrengths: [{ writId, attack: 2 }] }
            })
            expect(table.seat(attackerId).goods[good]).toBe(0)
            expect(table.state.supply.haversack[good]).toBe(haversack + 1)
        }
    )

    it.each(Weapons)('%s offers both alternatives', (_name, writId, good) => {
        const combat = atCommit(writId, ({ table, attackerId }) =>
            setUp(table, (state) => giveGood(state, attackerId, good))
        )
        expect(commitAttackOffer(combat.table.hydrated(), combat.attackerId)?.weapons).toEqual([
            { writId, alternative: 0, attack: 1, turnedIn: [] },
            { writId, alternative: 1, attack: 2, turnedIn: [good] }
        ])
    })

    it.each(Weapons)('%s refuses its turn-in with no good to pay', (_name, writId) => {
        const combat = atCommit(writId)
        expect(() => commit(combat, { weapons: [{ writId, alternative: 1 }] })).toThrow(
            "You can't pay for that."
        )
    })

    it('S36 a saltpeter and the free sword raise three pawns to 5', () => {
        const combat = atCommit(Sword, ({ table, attackerId }) =>
            setUp(table, (state) => {
                addPawn(state, attackerId)
                addPawn(state, attackerId)
                giveGood(state, attackerId, 'saltpeter')
            })
        )
        const state = combat.table.hydrated()
        const total = (input: Parameters<typeof commitAttackPreview>[2]) =>
            commitAttackPreview(state, combat.attackerId, input)?.strength.attack.total
        expect(total({})).toBe(3)
        expect(total({ saltpeter: 1 })).toBe(4)
        expect(total({ saltpeter: 1, weapons: [{ writId: Sword, alternative: 0 }] })).toBe(5)
    })
})

describe('R-4.4.2, R-7 mandates 2, 4, 5 and 7 turn in goods', () => {
    const Rows: readonly (readonly [string, MandateId, number, readonly Good[], MandateReward])[] =
        [
            ['2 A', 'writ.mandate.2', 0, ['food'], { kind: 'vessel', vessel: 'flying-machine' }],
            ['2 B', 'writ.mandate.2', 1, ['wood'], { kind: 'vessel', vessel: 'ship' }],
            ['4 A', 'writ.mandate.4', 0, ['wood'], { kind: 'vessel', vessel: 'ship' }],
            ['4 B', 'writ.mandate.4', 1, ['iron'], { kind: 'vessel', vessel: 'submersible' }],
            ['5 A', 'writ.mandate.5', 0, ['food'], { kind: 'shillings', amount: 3 }],
            ['5 B', 'writ.mandate.5', 1, ['wood', 'food'], { kind: 'shillings', amount: 7 }],
            [
                '7 A',
                'writ.mandate.7',
                0,
                ['iron', 'wood', 'food'],
                { kind: 'shillings', amount: 9 }
            ],
            [
                '7 B',
                'writ.mandate.7',
                1,
                ['sulfur', 'iron', 'wood', 'food'],
                { kind: 'shillings', amount: 13 }
            ]
        ]

    it.each(Rows)(
        'mandate %s pays its reward for the goods, which go to the haversack; no barrier',
        (_name, writId, alternative, goods, reward) => {
            const { table, playerId } = holding(writId, goods)
            const before = table.hydrated()
            const seatBefore = before.getPlayerState(playerId)
            const haversack = { ...before.supply.haversack }
            const shillings = seatBefore.shillings
            const supplyShillings = before.supply.shillings
            const vessels = { ...seatBefore.vessels }
            const supplyVessels = { ...before.supply.vessels }
            const slot = before.writDeck.nextBottom

            const [action] = table.send(playerId, {
                type: ActionType.PlayMandate,
                writId,
                alternative
            })

            const state = table.hydrated()
            const seat = state.getPlayerState(playerId)
            for (const good of goods) {
                expect(seat.goods[good]).toBe(0)
                expect(state.supply.haversack[good]).toBe(haversack[good] + 1)
            }
            if (reward.kind === 'vessel') {
                expect(seat.vessels[reward.vessel]).toBe(vessels[reward.vessel] + 1)
                expect(state.supply.vessels[reward.vessel]).toBe(supplyVessels[reward.vessel] - 1)
                expect(action).toMatchObject({ metadata: { received: reward } })
            } else if (reward.kind === 'shillings') {
                expect(seat.shillings).toBe(shillings + reward.amount)
                expect(state.supply.shillings).toBe(supplyShillings - reward.amount)
                expect(action).toMatchObject({ metadata: { received: reward } })
            }
            expect(action.revealsInfo).toBeFalsy()
            expect(state.publicDeckWrits).toContainEqual({ slot, writId })
            expect(conservationBreaks(canonicalOf(state))).toEqual([])
        }
    )

    it.each(Rows)('mandate %s is refused one good short', (_name, writId, alternative, goods) => {
        const { table, playerId } = holding(writId, goods.slice(1))
        expect(reasonPlayMandateRefused(table.hydrated(), playerId, { writId, alternative })).toBe(
            `You can't turn in ${goods.join(', ')}.`
        )
    })

    it('S50 mandate 5 offers A, 1 food for 3s, and B stays out of reach with food alone', () => {
        const writId: MandateId = 'writ.mandate.5'
        const { table, playerId } = holding(writId, ['food'])
        expect(playMandateOffers(table.hydrated(), playerId)).toEqual([
            {
                writId,
                alternative: 0,
                turnedIn: ['food'],
                reward: { kind: 'shillings', amount: 3 },
                revealsInfo: false,
                wildTileNeeded: false
            },
            {
                writId,
                alternative: 1,
                turnedIn: ['wood', 'food'],
                reward: { kind: 'shillings', amount: 7 },
                revealsInfo: false,
                wildTileNeeded: false,
                refused: "You can't turn in wood, food."
            }
        ])
    })

    it('R-4.3.3 a tile covers each good a turn-in falls short by', () => {
        const writId: MandateId = 'writ.mandate.7'
        const { table, playerId } = tableInWindow('before a card', (state, seat) => {
            returnAllGoods(state, seat)
            holdWrit(state, seat, writId)
            giveGood(state, seat, 'iron')
            giveGood(state, seat, 'wood')
            giveTile(state, seat)
        })
        const [tileId] = table.seat(playerId).regionTiles
        const [action] = table.send(playerId, {
            type: ActionType.PlayMandate,
            writId,
            alternative: 0,
            wildTiles: [{ tileId, good: 'food' }]
        })
        expect(action).toMatchObject({ metadata: { received: { kind: 'shillings', amount: 9 } } })
        expect(table.hydrated().tilesOutOfGame).toContain(tileId)
    })
})

describe('R-4.4.2, R-7 mandates 6 and 8 by a guild at 3 stars', () => {
    const Rows: readonly (readonly [MandateId, GuildId, object, boolean])[] = [
        [GoodsOrCoin, 'farmer', { kind: 'goods', goods: expect.any(Array) }, true],
        [GoodsOrCoin, 'merchant', { kind: 'shillings', amount: 3 }, false],
        [GoodsOrCoin, 'alchemist', { kind: 'vessel', vessel: 'ship' }, false],
        [InfluenceOrSeal, 'knight', { kind: 'influence', amount: 3 }, false],
        [InfluenceOrSeal, 'noble', { kind: 'seal', amount: 1 }, false],
        [InfluenceOrSeal, 'monk', { kind: 'bead', sealIds: [expect.any(String)] }, true]
    ]

    const sendReward = (
        table: ReturnType<typeof holdingWithStars>['table'],
        playerId: string,
        writId: MandateId,
        rewardGuild: GuildId
    ) =>
        table.send(playerId, {
            type: ActionType.PlayMandate,
            writId,
            alternative: 0,
            rewardGuild
        })

    it.each(Rows)(
        '%s %s: its reward, and a barrier only if it shows',
        (writId, guild, received, barrier) => {
            const { table, playerId } = holdingWithStars(writId, guild)
            const [offer] = playMandateOffers(table.hydrated(), playerId).filter(
                ({ rewardGuild }) => rewardGuild === guild
            )
            expect(offer.refused).toBeUndefined()
            expect(offer.revealsInfo).toBe(barrier)

            const [action] = sendReward(table, playerId, writId, guild)

            expect(action).toMatchObject({ metadata: { received } })
            expect(Boolean(action.revealsInfo)).toBe(barrier)
            expect(conservationBreaks(canonicalOf(table.hydrated()))).toEqual([])
        }
    )

    it('R-4.4.2 mandate 6 for a farmer draws 3 goods from the haversack', () => {
        const { table, playerId } = holdingWithStars(GoodsOrCoin, 'farmer')
        const count = (goods: Readonly<Record<Good, number>>) =>
            Object.values(goods).reduce((sum, amount) => sum + amount, 0)
        const seatGoods = count(table.seat(playerId).goods)
        const haversack = count(table.state.supply.haversack)

        sendReward(table, playerId, GoodsOrCoin, 'farmer')

        expect(count(table.seat(playerId).goods)).toBe(seatGoods + 3)
        expect(count(table.state.supply.haversack)).toBe(haversack - 3)
    })

    it('R-4.4-H4 mandate 6 for an alchemist is the ship the card prints', () => {
        const { table, playerId } = holdingWithStars(GoodsOrCoin, 'alchemist')
        const { ship, 'flying-machine': flyingMachine } = table.seat(playerId).vessels

        sendReward(table, playerId, GoodsOrCoin, 'alchemist')

        expect(table.seat(playerId).vessels).toMatchObject({
            ship: ship + 1,
            'flying-machine': flyingMachine
        })
    })

    it('R-4.4.2 mandate 8 for a noble moves one seal off the pile, unseen', () => {
        const { table, playerId } = holdingWithStars(InfluenceOrSeal, 'noble')
        const { sealCount } = table.seat(playerId)
        const pile = table.state.supply.sealPileCount

        sendReward(table, playerId, InfluenceOrSeal, 'noble')

        expect(table.seat(playerId).sealCount).toBe(sealCount + 1)
        expect(table.state.supply.sealPileCount).toBe(pile - 1)
    })

    it('R-4.4.2 mandate 8 for a monk flips one seal to a bead', () => {
        const { table, playerId } = holdingWithStars(InfluenceOrSeal, 'monk')
        sendReward(table, playerId, InfluenceOrSeal, 'monk')
        expect(table.seat(playerId).beads).toHaveLength(1)
    })

    it.each(Rows)('%s %s is refused at 2 stars', (writId, guild) => {
        const { table, playerId } = holdingWithStars(writId, guild, 2)
        expect(() => sendReward(table, playerId, writId, guild)).toThrow(
            'You need 3 status stars in that guild.'
        )
    })

    it('R-4.4.2 a guild the card does not picture is refused, even at 3 stars', () => {
        const { table, playerId } = holdingWithStars(GoodsOrCoin, 'knight')
        expect(() => sendReward(table, playerId, GoodsOrCoin, 'knight')).toThrow(
            `${GoodsOrCoin} has no such alternative: knight`
        )
    })

    it('R-4.4.2 one reward per card: it is gone once played', () => {
        const { table, playerId } = holdingWithStars(GoodsOrCoin, 'merchant')
        sendReward(table, playerId, GoodsOrCoin, 'merchant')
        expect(playMandateOffers(table.hydrated(), playerId)).toEqual([])
        expect(() => sendReward(table, playerId, GoodsOrCoin, 'merchant')).toThrow(
            "You don't hold that writ."
        )
    })
})
