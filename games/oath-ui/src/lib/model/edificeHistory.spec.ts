import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction, type Visibility } from '@tabletop/common'
import {
    ActionType,
    Banner,
    CampaignTargetKind,
    MachineState,
    OathVisibility,
    PowerQuestionKind,
    RecoverTargetKind,
    Suit
} from '@tabletop/oath'
import { describeAction, type HistoryNames } from './actionDescription.js'

// The edifices' History rows. Dana (p1) is the Chancellor, Rhys (p2) and
// Ann (p3) are Exiles.
const SITES: Record<string, string> = { c1: 'Plains', c2: 'Mountain', p1: 'Standing Stones' }
const names: HistoryNames = {
    player: (playerId) => ({ p1: 'Dana', p2: 'Rhys', p3: 'Ann' })[playerId] ?? playerId,
    site: (slotId) => SITES[slotId] ?? slotId,
    seats: ['p1', 'p2', 'p3']
}

const FORGE = 'edifice.nomad.ancient-forge'
const SPIRE = 'edifice.arcane.great-spire'
const DISTRICT = 'edifice.discord.festival-district'
const RAMPART = 'edifice.order.sprawling-rampart'
const INTACT = 0
const RUINED = 1

function action(fields: { type: ActionType; playerId: string } & Record<string, unknown>) {
    return { id: 'a1', gameId: 'g1', source: ActionSource.User, ...fields } as GameAction
}

const row = (fields: { type: ActionType; playerId: string } & Record<string, unknown>) =>
    describeAction(action(fields), names)

describe('the Forges', () => {
    it('Broken Forge names the side used and what it became', () => {
        expect(
            row({
                type: ActionType.UseActionPower,
                playerId: 'p2',
                cardId: FORGE,
                powerIndex: RUINED,
                metadata: { summary: 'Broken Forge: flipped it to Ancient Forge' }
            })
        ).toBe(
            'used Broken Forge, placing 2 favor and 2 secrets on it: flipped it to Ancient Forge'
        )
    })

    it('Ancient Forge reads as Dowsing Sticks does', () => {
        expect(
            row({
                type: ActionType.UseActionPower,
                playerId: 'p3',
                cardId: FORGE,
                powerIndex: INTACT,
                metadata: {
                    summary: 'Ancient Forge: drew a relic — take it, or put it on the bottom'
                }
            })
        ).toBe(
            'used Ancient Forge, placing 2 favor on it and burning a secret: drew a relic — take it, or put it on the bottom'
        )
    })

    it('the side used is named, whichever side is up now (from the power’s index)', () => {
        // A row recorded before the flip still says Broken Forge.
        const used = action({
            type: ActionType.UseActionPower,
            playerId: 'p2',
            cardId: FORGE,
            powerIndex: RUINED,
            metadata: { summary: 'Broken Forge: flipped it to Ancient Forge' }
        })
        expect(describeAction(used, names)).toMatch(/^used Broken Forge,/)
    })
})

describe('Great Spire’s swap: its own row, per seat (R-9.4)', () => {
    const swap = action({
        type: ActionType.SearchSwap,
        playerId: 'p3',
        revealsInfo: true,
        swappedCardIds: ['denizen.order.bear-traps', 'denizen.hearth.a-round-of-ale'],
        metadata: {
            count: 2,
            incomingCardIds: ['denizen.discord.assassin', 'denizen.nomad.elders']
        }
    })
    const seen = (record: GameAction, perspective: Visibility.Perspective) =>
        describeAction(OathVisibility.actions.project(record, perspective), names)

    it('the searcher sees what went and what came in', () => {
        expect(seen(swap, { kind: 'player', playerId: 'p3' })).toBe(
            'swapped Bear Traps and A Round of Ale for Assassin and Elders from the Dispossessed (Great Spire)'
        )
    })

    it('every other seat and a spectator see how many', () => {
        for (const perspective of [
            { kind: 'player', playerId: 'p1' },
            { kind: 'player', playerId: 'p2' },
            { kind: 'spectator' }
        ] as Visibility.Perspective[]) {
            const text = seen(swap, perspective)
            expect(text).toBe('swapped 2 cards with the Dispossessed (Great Spire)')
        }
    })

    it('with Truthful Harp the others saw the drawn cards go, never what came in', () => {
        const harp = action({
            ...(swap as unknown as Record<string, unknown>),
            type: ActionType.SearchSwap,
            playerId: 'p3',
            metadata: {
                count: 2,
                incomingCardIds: ['denizen.discord.assassin', 'denizen.nomad.elders'],
                revealedSwappedCardIds: [
                    'denizen.order.bear-traps',
                    'denizen.hearth.a-round-of-ale'
                ]
            }
        })
        for (const perspective of [
            { kind: 'player', playerId: 'p1' },
            { kind: 'spectator' }
        ] as Visibility.Perspective[]) {
            const text = seen(harp, perspective)
            expect(text).toBe(
                'swapped Bear Traps and A Round of Ale with the Dispossessed (Great Spire)'
            )
            expect(text).not.toMatch(/Assassin|Elders/)
        }
    })

    it('one card is one card', () => {
        const one = action({
            type: ActionType.SearchSwap,
            playerId: 'p3',
            revealsInfo: true,
            swappedCardIds: ['denizen.order.bear-traps'],
            metadata: { count: 1, incomingCardIds: ['denizen.nomad.elders'] }
        })
        expect(seen(one, { kind: 'player', playerId: 'p1' })).toBe(
            'swapped 1 card with the Dispossessed (Great Spire)'
        )
        expect(seen(one, { kind: 'player', playerId: 'p3' })).toBe(
            'swapped Bear Traps for Elders from the Dispossessed (Great Spire)'
        )
    })

    it('the Search row is today’s, naming Great Spire as any modifier', () => {
        expect(
            row({
                type: ActionType.Search,
                playerId: 'p3',
                drawFrom: 'worldDeck',
                revealsInfo: true,
                modifiers: [{ cardId: SPIRE, powerIndex: INTACT }],
                metadata: { supplySpent: 2, modifiers: [SPIRE] }
            })
        ).toBe('searched the world deck, spending 2 Supply (Great Spire)')
    })
})

describe('Fallen Spire', () => {
    it('names no card: how many, and which pile', () => {
        expect(
            row({
                type: ActionType.UseActionPower,
                playerId: 'p3',
                cardId: SPIRE,
                powerIndex: RUINED,
                metadata: {
                    summary:
                        'Fallen Spire: swapped 3 denizens in the Hinterland discard pile with the Dispossessed'
                }
            })
        ).toBe(
            'used Fallen Spire, placing a secret on it and burning a secret: swapped 3 denizens in the Hinterland discard pile with the Dispossessed'
        )
    })
})

describe('Squalid District’s answer', () => {
    const answer = (by: number, summary: string) =>
        row({
            type: ActionType.AnswerQuestion,
            playerId: 'p2',
            answer: { kind: PowerQuestionKind.AdjustEndDie, by },
            metadata: {
                cardId: DISTRICT,
                kind: PowerQuestionKind.AdjustEndDie,
                summary,
                resumeMachineState: MachineState.WakePhase,
                last: true,
                endDie: { rolled: 5, roll: 5 + by, round: 6, threshold: 5 }
            }
        })

    it('lowered, raised or left, naming Squalid District', () => {
        expect(answer(-1, 'lowered the end die to 4')).toBe(
            'lowered the end die to 4 (Squalid District)'
        )
        expect(answer(1, 'raised the end die to 6')).toBe(
            'raised the end die to 6 (Squalid District)'
        )
        expect(answer(0, 'left the end die at 5')).toBe('left the end die at 5 (Squalid District)')
    })

    it('the roll before it is today’s row', () => {
        expect(
            row({
                type: ActionType.RollEndDie,
                playerId: 'p1',
                metadata: { roll: 5, round: 6, threshold: 5, adjustedBy: 'p2' }
            })
        ).toBe('rolled the end die: 5')
    })
})

describe('Festival District', () => {
    it('reads as today’s exchange rows, naming Festival District', () => {
        const text = row({
            type: ActionType.UseActionPower,
            playerId: 'p3',
            cardId: DISTRICT,
            powerIndex: INTACT,
            choices: [
                {
                    kind: 'exchange',
                    withPlayerId: 'p2',
                    terms: { fromProposer: { favor: 2 }, fromCounterparty: { secrets: 1 } }
                }
            ],
            metadata: { summary: 'Festival District: offered an exchange' }
        })
        expect(text).toMatch(/^used Festival District: offered Rhys 2 favor for 1 secret/)
    })
})

describe('the Ramparts', () => {
    const campaign = (battle: Record<string, unknown>, defender: Record<string, unknown>) =>
        action({
            type: ActionType.Campaign,
            playerId: 'p2',
            defender,
            targets: [{ kind: CampaignTargetKind.Site, siteId: 'p1' }],
            attackDice: 3,
            metadata: {
                supplySpent: 2,
                battle: {
                    attackPool: 1,
                    defensePool: 0,
                    defense: 2,
                    swords: 1,
                    skullsKilled: 0,
                    ...battle
                }
            }
        })

    it('the bandits’ use is a note on the Campaign row', () => {
        const text = describeAction(
            campaign(
                { planNotes: ['Bandit Rampart: the bandits took 2 attack dice'] },
                { kind: 'bandits' }
            ),
            names
        )
        expect(text).toBe(
            'campaigned against the bandits for Standing Stones, spending 2 Supply; 1 sword against 2 defense; the bandits took 2 attack dice (Bandit Rampart)'
        )
    })

    it('a player defender’s row names the plan by its side', () => {
        const defend = action({
            type: ActionType.CampaignDefend,
            playerId: 'p2',
            plans: [{ cardId: RAMPART, powerIndex: RUINED }],
            metadata: {
                attackPool: 1,
                defensePool: 2,
                defense: 2,
                swords: 1,
                skullsKilled: 0,
                plansUsed: [RAMPART]
            }
        })
        expect(describeAction(defend, names)).toBe('used Bandit Rampart; 1 sword against 2 defense')
    })

    it('Sprawling Rampart: one clause naming every site it added a die to', () => {
        expect(
            describeAction(
                campaign({ defenseBonusSites: ['c1'] }, { kind: 'player', playerId: 'p1' }),
                names
            )
        ).toMatch(
            /; 1 sword against 2 defense; 1 more defense die for Plains \(Sprawling Rampart\)$/
        )
        expect(
            describeAction(
                campaign({ defenseBonusSites: ['c1', 'c2'] }, { kind: 'player', playerId: 'p1' }),
                names
            )
        ).toMatch(/1 more defense die for Plains, Mountain \(Sprawling Rampart\)$/)
    })

    it('Sprawling Rampart on a defender’s row, read from the Campaign it answers', () => {
        const opened = campaign(
            { defenseBonusSites: ['c1'], awaitingDefender: true },
            { kind: 'player', playerId: 'p1' }
        )
        const defend = action({
            type: ActionType.CampaignDefend,
            playerId: 'p1',
            plans: [],
            metadata: {
                attackPool: 3,
                defensePool: 2,
                defense: 2,
                swords: 1,
                skullsKilled: 0,
                plansUsed: []
            }
        })
        expect(describeAction(defend, names, undefined, opened as unknown as never)).toBe(
            'used no battle plans; 1 sword against 2 defense; 1 more defense die for Plains (Sprawling Rampart)'
        )
    })
})

describe('Hall of Mockery', () => {
    const recover = (mobSideBefore: boolean) =>
        row({
            type: ActionType.Recover,
            playerId: 'p2',
            target: { kind: RecoverTargetKind.Banner, banner: Banner.PeoplesFavor },
            amountPaid: 2,
            redistributeFrom: Suit.Hearth,
            metadata: {
                supplySpent: 1,
                amountPaid: 2,
                favorRedistributedTo: [Suit.Hearth],
                flippedToMob: true,
                mobSideBefore
            }
        })

    it('stays on its Mob side, or goes to it', () => {
        expect(recover(true)).toBe(
            'recovered the People’s Favor for 2 favor; it stays on its Mob side (Hall of Mockery)'
        )
        expect(recover(false)).toBe(
            'recovered the People’s Favor for 2 favor; it goes to its Mob side (Hall of Mockery)'
        )
    })
})
