import { flushSync } from 'svelte'
import {
    ActionSource,
    assertExists,
    Color,
    type GameAction,
    type Visibility
} from '@tabletop/common'
import {
    ActionType,
    RoyalWrits,
    type AdvanceTurn,
    type AnswerAttack,
    type AnswerStarve,
    type BeginDawn,
    type ChooseFavours,
    type ChooseStartingGoods,
    type CollectLandscapes,
    type CommitAttack,
    type Conquer,
    type DiscardWrit,
    type EndRound,
    type Explore,
    type Feast,
    type FinaliseHand,
    type ForfeitCard,
    type GuildAction,
    type Harvest,
    type Improve,
    type Influence,
    type KeepWrits,
    type Migrate,
    type Move,
    type Nourish,
    type NourishPawns,
    type PlaceDisc,
    type PlaceStartingPawn,
    type PlaceVessel,
    type PlayDefend,
    type PlayMandate,
    type ActionCardKind,
    type RankChange,
    type ReclaimImmunitySeal,
    type ReplenishGuilds,
    type ReplenishMap,
    type RollProgressDie,
    type ScoreGame,
    type SealCharter,
    type SpendRegionTile,
    type StarveThePeople,
    type StartRound,
    type Tax,
    type TendLandscape
} from '@tabletop/feudum'
import {
    perspectivesOf,
    processedOf,
    realGames,
    recordFor,
    Spectator,
    writsNamedIn
} from '@tabletop/feudum/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { describeAction, type ActionLineView } from '$lib/model/actionDescription.js'
import actionDescriptionSource from '$lib/model/actionDescription.ts?raw'
import { linesOf, primaryNamed } from '$lib/testing/actionPanelView.js'
import { askedToDefend, askedToStarve, type AskTable } from '$lib/testing/askTable.js'
import { holdWrit } from '$lib/testing/followUpTable.js'
import { playOutRound } from '$lib/testing/roundEndTable.js'
import { FeudumHost, settled } from '$lib/testing/sessionHarness.js'
import { atPlayingCards, giveSeal } from '$lib/testing/turnTable.js'

const Names: Readonly<Record<string, string>> = { p1: 'Ana', p2: 'Ben', p3: 'Cy' }

function viewOf(viewerId: string | undefined, hostView = false): ActionLineView {
    return { viewerId, hostView, nameOf: (id) => Names[id] ?? id }
}

const Base = { id: 'a', gameId: 'g', source: ActionSource.User, playerId: 'p1' }
const SystemSource: ActionSource.System = ActionSource.System
const System = { id: 'a', gameId: 'g', source: SystemSource }

function sample<T extends GameAction>(action: T): GameAction {
    return action
}

function line(action: GameAction, viewerId: string | undefined, hostView = false): string {
    return describeAction(action, viewOf(viewerId, hostView)) ?? 'no line'
}

const NoRanks = { rankChanges: [] }

const EmptyGoods = { saltpeter: 0, sulfur: 0, iron: 0, wood: 0, food: 0 }

const MerchantRanks: { rankChanges: RankChange[] } = {
    rankChanges: [
        { guildId: 'merchant', playerId: 'p1', from: 'journeyman', to: 'master' },
        { guildId: 'merchant', playerId: 'p2', from: 'master', to: 'journeyman' }
    ]
}

const Outcome = {
    points: 0,
    reevePoints: 0,
    reeveOffered: false,
    drawnWritIds: [],
    rankChanges: []
}

/** The contract's list: each type's line for its actor and for another seat, stated here. */
const Lines: Readonly<
    Record<
        ActionType,
        { readonly action: GameAction; readonly actor: string; readonly other: string }
    >
> = {
    [ActionType.ChooseStartingGoods]: {
        action: sample<ChooseStartingGoods>({
            ...Base,
            type: ActionType.ChooseStartingGoods,
            goods: ['wood', 'wood', 'sulfur'],
            sulfurToBarrel: true
        }),
        actor: 'You chose 2 wood, 1 sulfur · sulfur to the barrel',
        other: 'Ana chose 2 wood, 1 sulfur · sulfur to the barrel'
    },
    [ActionType.PlaceStartingPawn]: {
        action: sample<PlaceStartingPawn>({
            ...Base,
            type: ActionType.PlaceStartingPawn,
            character: 'merchant',
            spaceId: 'space.desert.3',
            metadata: {
                rankChanges: [{ guildId: 'merchant', playerId: 'p1', to: 'journeyman' }]
            }
        }),
        actor: 'You placed a merchant at Desert 3 · You became Merchant journeyman',
        other: 'Ana placed a merchant at Desert 3 · Ana became Merchant journeyman'
    },
    [ActionType.FinaliseHand]: {
        action: sample<FinaliseHand>({
            ...Base,
            type: ActionType.FinaliseHand,
            revealsInfo: true,
            cards: ['move', 'tax'],
            pouchGood: 'sulfur'
        }),
        actor: 'You finalised · pouch sulfur · Move, Tax',
        other: 'Ana finalised · pouch sulfur'
    },
    [ActionType.ForfeitCard]: {
        action: sample<ForfeitCard>({
            ...Base,
            type: ActionType.ForfeitCard,
            kind: 'conquer',
            secondCard: true
        }),
        actor: 'You forfeited Conquer · second card declared',
        other: 'Ana forfeited Conquer · second card declared'
    },
    [ActionType.PlayDefend]: {
        action: sample<PlayDefend>({
            ...Base,
            type: ActionType.PlayDefend,
            metadata: { vp: 2 }
        }),
        actor: 'You played Defend · +2 vp',
        other: 'Ana played Defend · +2 vp'
    },
    [ActionType.PlaceDisc]: {
        action: sample<PlaceDisc>({
            ...Base,
            type: ActionType.PlaceDisc,
            place: true,
            metadata: { disc: 'reeve', guildId: 'monk', reevePoints: 2 }
        }),
        actor: 'You placed a reeve on the Monk guild · +2 vp',
        other: 'Ana placed a reeve on the Monk guild · +2 vp'
    },
    [ActionType.Move]: {
        action: sample<Move>({
            ...Base,
            type: ActionType.Move,
            steps: [
                {
                    piece: { kind: 'pawn', playerId: 'p1', n: 1 },
                    to: 'space.island.1',
                    medium: 'ship',
                    ferry: true
                },
                {
                    piece: { kind: 'pawn', playerId: 'p1', n: 1 },
                    to: 'space.island.2',
                    medium: 'road'
                }
            ],
            pilfer: {
                piece: { kind: 'pawn', playerId: 'p1', n: 1 },
                from: 'farm',
                resource: 'iron'
            },
            metadata: {
                steps: [
                    {
                        routeId: 'route.road.forest-1--forest-2',
                        from: 'space.forest.2',
                        character: 'monk',
                        fare: 2
                    },
                    {
                        routeId: 'route.road.forest-2--forest-3',
                        from: 'space.island.1',
                        character: 'monk'
                    }
                ],
                pilfer: { spaceId: 'space.island.2' }
            }
        }),
        actor: 'You moved monk Forest 2 → Island 1 by ferry (2s) → Island 2 by road · pilfered iron from the farm at Island 2',
        other: 'Ana moved monk Forest 2 → Island 1 by ferry (2s) → Island 2 by road · pilfered iron from the farm at Island 2'
    },
    [ActionType.Migrate]: {
        action: sample<Migrate>({
            ...Base,
            type: ActionType.Migrate,
            pawn: 2,
            onto: { character: 'knight', spaceId: 'space.desert.1' },
            distantKin: true,
            metadata: {
                left: { spaceId: 'space.forest.1', character: 'monk', vessel: 'ship', wine: true },
                ...NoRanks
            }
        }),
        actor: 'You migrated the monk off Forest 1 and a knight onto Desert 1 · ship left at Forest 1 · its sulfur to the haversack · Distant Kin',
        other: 'Ana migrated the monk off Forest 1 and a knight onto Desert 1 · ship left at Forest 1 · its sulfur to the haversack · Distant Kin'
    },
    [ActionType.Influence]: {
        action: sample<Influence>({
            ...Base,
            type: ActionType.Influence,
            moneyIsInfluence: 'space.desert.2',
            metadata: {
                placements: [
                    { spaceId: 'space.forest.2', role: 'ruler' },
                    { spaceId: 'space.desert.2', role: 'serf', displacedPlayerId: 'p2' }
                ],
                ...NoRanks
            }
        }),
        actor: 'You placed 2 markers: ruler of Forest 2, serf of Desert 2 (displacing Ben) · Money is Influence at Desert 2',
        other: 'Ana placed 2 markers: ruler of Forest 2, serf of Desert 2 (displacing Ben) · Money is Influence at Desert 2'
    },
    [ActionType.Tax]: {
        action: sample<Tax>({
            ...Base,
            type: ActionType.Tax,
            metadata: { shillings: 5, reinforcements: 'knight-row', ...MerchantRanks }
        }),
        actor: 'You taxed 5s · Reinforcements marker from the Knight row · You became Merchant master; Ben dropped to journeyman',
        other: 'Ana taxed 5s · Reinforcements marker from the Knight row · Ana became Merchant master; Ben dropped to journeyman'
    },
    [ActionType.GuildAction]: {
        action: sample<GuildAction>({
            ...Base,
            type: ActionType.GuildAction,
            guildId: 'merchant',
            fn: 'pull',
            params: { goods: ['iron'] },
            metadata: {
                ...Outcome,
                details: {
                    kind: 'merchant-pull',
                    spaces: ['guild.merchant.space.iron-2'],
                    rows: 1,
                    columns: 2
                },
                completions: 2,
                points: 3,
                reevePoints: 1,
                drawnCount: 2,
                keep: 1,
                drawnWritIds: ['writ.mandate.1', 'writ.mandate.2'],
                payment: {
                    members: [{ playerId: 'p2', amount: 1 }],
                    charity: { id: 'guild.merchant', amount: 1 },
                    generalSupply: 1
                },
                rankChanges: []
            }
        }),
        actor: 'You used Merchant pull: filled iron 2 on the market · 1 row, 2 columns · 2 completions · +3 vp · paid Ben 1s, charity 1s, general supply 1s · reeve +1 vp · drew 2 writs, to keep 1: Mandate 1, Mandate 2',
        other: 'Ana used Merchant pull: filled iron 2 on the market · 1 row, 2 columns · 2 completions · +3 vp · paid Ben 1s, charity 1s, general supply 1s · reeve +1 vp · drew 2 writs, to keep 1'
    },
    [ActionType.Feast]: {
        action: sample<Feast>({
            ...Base,
            type: ActionType.Feast,
            spaceId: 'space.desert.2',
            opponentId: 'p2',
            guildId: 'monk',
            params: {},
            metadata: {
                ...Outcome,
                fn: 'pull',
                feastPoints: 2,
                details: { kind: 'monk-pull', sealIds: ['seal.1'], rosaryTotal: 9 },
                points: 1
            }
        }),
        actor: 'You feasted with Ben at Desert 2, using Monk pull: flipped a seal to bead +2 · rosary now 9 · +1 vp · feast +2 vp',
        other: 'Ana feasted with Ben at Desert 2, using Monk pull: flipped a seal to bead +2 · rosary now 9 · +1 vp · feast +2 vp'
    },
    [ActionType.Explore]: {
        action: sample<Explore>({
            ...Base,
            type: ActionType.Explore,
            revealsInfo: true,
            metadata: {
                drawnCount: 3,
                keep: 1,
                drawnWritIds: ['writ.mandate.1', 'writ.mandate.2', 'writ.mandate.3']
            }
        }),
        actor: 'You drew 3 writs, to keep 1: Mandate 1, Mandate 2, Mandate 3',
        other: 'Ana drew 3 writs, to keep 1'
    },
    [ActionType.KeepWrits]: {
        action: sample<KeepWrits>({
            ...Base,
            type: ActionType.KeepWrits,
            keep: ['writ.mandate.1'],
            metadata: {
                keptCount: 1,
                returnedCount: 2,
                returned: [
                    { slot: 0, writId: 'writ.mandate.2' },
                    { slot: 1, writId: 'writ.mandate.3' }
                ]
            }
        }),
        actor: 'You drew 3, kept 1: Mandate 1; 2 under the deck: Mandate 2, Mandate 3',
        other: 'Ana drew 3, kept 1, 2 under the deck'
    },
    [ActionType.DiscardWrit]: {
        action: sample<DiscardWrit>({
            ...Base,
            type: ActionType.DiscardWrit,
            writId: 'writ.mandate.7',
            metadata: { slot: 2 }
        }),
        actor: 'You discarded Mandate 7 under the deck',
        other: 'Ana discarded a writ under the deck'
    },
    [ActionType.Improve]: {
        action: sample<Improve>({
            ...Base,
            type: ActionType.Improve,
            spaceId: 'space.forest.2',
            metadata: {
                from: 'outpost',
                to: 'farm',
                discId: 'disc.double.9',
                tile: { tileId: 'tile.forest.ii', landscape: 'sulfur-mine', vp: 3 },
                ...NoRanks
            }
        }),
        actor: 'You improved Forest 2 from outpost to farm · disc outpost/farm · took Forest II (sulfur mine) · +3 vp',
        other: 'Ana improved Forest 2 from outpost to farm · disc outpost/farm · took Forest II (sulfur mine) · +3 vp'
    },
    [ActionType.TendLandscape]: {
        action: sample<TendLandscape>({
            ...Base,
            type: ActionType.TendLandscape,
            tileId: 'tile.forest.ii',
            spaceId: 'space.forest.2',
            collect: true,
            metadata: {
                landscape: 'sulfur-mine',
                filled: 2,
                vp: 1,
                collected: { kept: 2, paid: 1, rulerId: 'p2' },
                ...NoRanks
            }
        }),
        actor: 'You tended the sulfur mine at Forest 2 · filled 2 · +1 vp · collected: kept 2, paid Ben 1',
        other: 'Ana tended the sulfur mine at Forest 2 · filled 2 · +1 vp · collected: kept 2, paid Ben 1'
    },
    [ActionType.Harvest]: {
        action: sample<Harvest>({
            ...Base,
            type: ActionType.Harvest,
            revealsInfo: true,
            spaceId: 'space.forest.2',
            mode: 'favours',
            metadata: {
                total: 3,
                drawn: { ...EmptyGoods, wood: 2, iron: 1 },
                vp: 1,
                favours: { ...EmptyGoods, wood: 1 },
                beadsFlipped: 1
            }
        }),
        actor: 'You harvested Forest 2 · drew 1 iron, 2 wood · +1 vp · favours 1 wood · 1 bead flipped',
        other: 'Ana harvested Forest 2 · drew 1 iron, 2 wood · +1 vp · favours 1 wood · 1 bead flipped'
    },
    [ActionType.Conquer]: {
        action: sample<Conquer>({
            ...Base,
            type: ActionType.Conquer,
            spaceId: 'space.desert.3',
            target: { kind: 'pawn', playerId: 'p2', n: 1 },
            metadata: { defenderId: 'p2', character: 'knight', asked: true }
        }),
        actor: "You attacked Ben's knight at Desert 3 and asked Ben to answer",
        other: "Ana attacked Ben's knight at Desert 3 and asked Ben to answer"
    },
    [ActionType.AnswerAttack]: {
        action: sample<AnswerAttack>({
            ...Base,
            playerId: 'p2',
            type: ActionType.AnswerAttack,
            revealsInfo: true,
            flipDefend: true,
            metadata: { vp: 2 }
        }),
        actor: 'Ben flipped Defend · +2 vp',
        other: 'Ben flipped Defend · +2 vp'
    },
    [ActionType.CommitAttack]: {
        action: sample<CommitAttack>({
            ...Base,
            type: ActionType.CommitAttack,
            saltpeter: 2,
            weapons: [{ writId: 'writ.mandate.1', alternative: 1 }],
            metadata: {
                defenderId: 'p2',
                spaceId: 'space.desert.3',
                target: { kind: 'pawn', playerId: 'p2', n: 1 },
                defendFlipped: true,
                attack: { pawns: 2, monsters: 0, saltpeter: 2, weapons: 2, serf: 0, total: 6 },
                defence: { pawns: 1, monsters: 0, feudum: 0, subject: 0, defend: 2, total: 3 },
                attackerWins: true,
                vp: 3,
                rankChanges: [{ guildId: 'knight', playerId: 'p2', from: 'master' }],
                conquered: { kind: 'pawn', n: 1, character: 'knight' },
                weaponStrengths: [{ writId: 'writ.mandate.1', attack: 2, slot: 0 }]
            }
        }),
        actor: "You added 2 saltpeter and Mandate 1 (+2 attack) · attack 6, defence 3: the attack won · +3 vp · Ben's knight went home · Ben left the Knight guild",
        other: "Ana added 2 saltpeter and Mandate 1 (+2 attack) · attack 6, defence 3: the attack won · +3 vp · Ben's knight went home · Ben left the Knight guild"
    },
    [ActionType.StarveThePeople]: {
        action: sample<StarveThePeople>({
            ...Base,
            type: ActionType.StarveThePeople,
            spaceId: 'space.desert.3',
            targetPlayerId: 'p2',
            role: 'serf',
            metadata: {
                asked: false,
                starved: { beads: ['seal.1', 'seal.2'], rankChanges: [] }
            }
        }),
        actor: "You starved Ben's serf at Desert 3 · 2 chicken beads returned",
        other: "Ana starved Ben's serf at Desert 3 · 2 chicken beads returned"
    },
    [ActionType.AnswerStarve]: {
        action: sample<AnswerStarve>({
            ...Base,
            playerId: 'p2',
            type: ActionType.AnswerStarve,
            revealsInfo: true,
            royalImmunity: true,
            metadata: { actorId: 'p1', spaceId: 'space.desert.3', role: 'serf', cancelled: true }
        }),
        actor: 'Ben played Royal Immunity at Desert 3',
        other: 'Ben played Royal Immunity at Desert 3'
    },
    [ActionType.ReclaimImmunitySeal]: {
        action: sample<ReclaimImmunitySeal>({
            ...Base,
            type: ActionType.ReclaimImmunitySeal,
            spaceId: 'space.desert.3',
            role: 'serf'
        }),
        actor: 'You took back the Royal Immunity seal from the serf at Desert 3',
        other: 'Ana took back the Royal Immunity seal from the serf at Desert 3'
    },
    [ActionType.ChooseFavours]: {
        action: sample<ChooseFavours>({
            ...Base,
            type: ActionType.ChooseFavours,
            favours: { ...EmptyGoods, food: 1 },
            metadata: {
                spaceId: 'space.forest.2',
                drawn: { ...EmptyGoods, food: 1, iron: 1 },
                favours: { ...EmptyGoods, food: 1 },
                beadsFlipped: 1
            }
        }),
        actor: 'You took favours 1 food · 1 bead flipped',
        other: 'Ana took favours 1 food · 1 bead flipped'
    },
    [ActionType.PlayMandate]: {
        action: sample<PlayMandate>({
            ...Base,
            type: ActionType.PlayMandate,
            writId: 'writ.mandate.7',
            alternative: 0,
            wildTiles: [{ tileId: 'tile.forest.ii', good: 'iron' }],
            metadata: { slot: 3, received: { kind: 'shillings', amount: 3 } }
        }),
        actor: 'You played Mandate 7 for 3s · used Forest II for iron',
        other: 'Ana played Mandate 7 for 3s · used Forest II for iron'
    },
    [ActionType.SealCharter]: {
        action: sample<SealCharter>({
            ...Base,
            type: ActionType.SealCharter,
            writId: 'writ.charter.sulfur-barrel'
        }),
        actor: 'You sealed End game with 2 or 3 sulfur in barrel: 5/7 vp as a charter',
        other: 'Ana sealed a charter'
    },
    [ActionType.SpendRegionTile]: {
        action: sample<SpendRegionTile>({
            ...Base,
            type: ActionType.SpendRegionTile,
            tileId: 'tile.forest.ii',
            good: 'iron'
        }),
        actor: 'You used Forest II for iron',
        other: 'Ana used Forest II for iron'
    },
    [ActionType.PlaceVessel]: {
        action: sample<PlaceVessel>({
            ...Base,
            type: ActionType.PlaceVessel,
            vesselType: 'flying-machine',
            pawn: 1,
            metadata: { spaceId: 'space.desert.3' }
        }),
        actor: 'You placed a flying machine at Desert 3',
        other: 'Ana placed a flying machine at Desert 3'
    },
    [ActionType.Nourish]: {
        action: sample<Nourish>({
            ...Base,
            type: ActionType.Nourish,
            wineFed: [2],
            unfed: [3],
            metadata: {
                foodFed: [1],
                returned: [{ n: 3, left: { spaceId: 'space.forest.2', character: 'monk' } }],
                ...NoRanks
            }
        }),
        actor: 'You fed 1 food, 1 wine · unfed: the monk from Forest 2 returned',
        other: 'Ana fed 1 food, 1 wine · unfed: the monk from Forest 2 returned'
    },
    [ActionType.CollectLandscapes]: {
        action: sample<CollectLandscapes>({
            ...Base,
            type: ActionType.CollectLandscapes,
            spaceIds: ['space.forest.2'],
            metadata: {
                collections: [
                    {
                        spaceId: 'space.forest.2',
                        landscape: 'archery-butt',
                        collected: {
                            kept: 2,
                            paid: 1,
                            rulerId: 'p2',
                            seatMarkers: 2,
                            rulerMarkers: 1
                        }
                    }
                ],
                ...NoRanks
            }
        }),
        actor: 'You collected the archery butt at Forest 2: kept 2, paid Ben 1, markers 2 and 1',
        other: 'Ana collected the archery butt at Forest 2: kept 2, paid Ben 1, markers 2 and 1'
    },
    [ActionType.StartRound]: {
        action: sample<StartRound>({
            ...System,
            type: ActionType.StartRound,
            metadata: { round: 3, drunk: [{ playerId: 'p1', n: 1 }] }
        }),
        actor: 'Round 3 began · 1 pawn drunk',
        other: 'Round 3 began · 1 pawn drunk'
    },
    [ActionType.AdvanceTurn]: {
        action: sample<AdvanceTurn>({
            ...System,
            type: ActionType.AdvanceTurn,
            metadata: { outcome: 'next-seat', turnPlayerId: 'p1' }
        }),
        actor: 'The turn passed to you',
        other: 'The turn passed to Ana'
    },
    [ActionType.NourishPawns]: {
        action: sample<NourishPawns>({
            ...System,
            type: ActionType.NourishPawns,
            metadata: {
                fed: [
                    {
                        playerId: 'p1',
                        wineFed: [2],
                        foodFed: [1],
                        returned: [],
                        rankChanges: []
                    }
                ]
            }
        }),
        actor: 'Pawns ate: You 1 food, 1 wine',
        other: 'Pawns ate: Ana 1 food, 1 wine'
    },
    [ActionType.RollProgressDie]: {
        action: sample<RollProgressDie>({
            ...System,
            type: ActionType.RollProgressDie,
            metadata: {
                faces: ['sea', 'forest'],
                removed: { region: 'forest', tileId: 'tile.forest.ii', landscape: 'orchard' },
                epochTriggered: 3
            }
        }),
        actor: 'The progress die rolled Sea, Forest · Forest II removed · Epoch III dawned',
        other: 'The progress die rolled Sea, Forest · Forest II removed · Epoch III dawned'
    },
    [ActionType.BeginDawn]: {
        action: sample<BeginDawn>({
            ...System,
            type: ActionType.BeginDawn,
            metadata: {
                epoch: 3,
                sheet: [
                    {
                        playerId: 'p1',
                        ranks: [{ guild: 'monk', rank: 'master', vp: 3 }],
                        landscapes: { empty: 1, filled: 1, vp: 2 },
                        activeRegions: { regions: ['forest'], vp: 1 },
                        disloyaltyVp: -1,
                        total: 5
                    }
                ],
                fills: [{ spaceId: 'space.forest.2', landscape: 'orchard', added: 1 }]
            }
        }),
        actor: 'Dawn of epoch III: You +5 vp (ranks 3, landscapes 2, regions 1, disloyalty -1) · Forest 2: orchard +1',
        other: 'Dawn of epoch III: Ana +5 vp (ranks 3, landscapes 2, regions 1, disloyalty -1) · Forest 2: orchard +1'
    },
    [ActionType.ReplenishMap]: {
        action: sample<ReplenishMap>({
            ...System,
            type: ActionType.ReplenishMap,
            revealsInfo: true,
            metadata: { goods: [{ spaceId: 'space.forest.2', good: 'wood' }] }
        }),
        actor: 'New goods: wood at Forest 2',
        other: 'New goods: wood at Forest 2'
    },
    [ActionType.ReplenishGuilds]: {
        action: sample<ReplenishGuilds>({
            ...System,
            type: ActionType.ReplenishGuilds,
            revealsInfo: true,
            metadata: {
                market: ['guild.merchant.space.iron-2'],
                carts: [],
                vessels: ['ship'],
                knightRows: [],
                scrolls: ['guild.noble.scroll.r1c1'],
                rosary: ['seal.1'],
                chickens: [],
                barn: ['wood']
            }
        }),
        actor: 'The guilds refilled: 1 market good, 1 vessel, 1 seal, 1 barn good · beads flipped: bead +2',
        other: 'The guilds refilled: 1 market good, 1 vessel, 1 seal, 1 barn good · beads flipped: bead +2'
    },
    [ActionType.EndRound]: {
        action: sample<EndRound>({
            ...System,
            type: ActionType.EndRound,
            metadata: {
                startingPlayerId: 'p2',
                pouchesPaid: [{ playerId: 'p1', good: 'sulfur' }],
                sobered: []
            }
        }),
        actor: 'The round ended · pouches paid: You sulfur · start player passed to Ben',
        other: 'The round ended · pouches paid: Ana sulfur · start player passed to Ben'
    },
    [ActionType.ScoreGame]: {
        action: sample<ScoreGame>({
            ...System,
            type: ActionType.ScoreGame,
            revealsInfo: true,
            metadata: {
                sheet: [
                    {
                        playerId: 'p1',
                        voyage: { space: 12, vp: 5 },
                        largeEmpire: {
                            outposts: 1,
                            farms: 1,
                            towns: 1,
                            feudums: 1,
                            sets: 1,
                            vp: 6
                        },
                        shillings: { held: 9, vp: 3 },
                        charters: [{ writId: 'writ.charter.sulfur-barrel', vp: 5 }],
                        total: 19,
                        score: 60
                    }
                ],
                winners: ['p1']
            }
        }),
        actor: 'Final scores: You 60 (voyage 5, empire 6, shillings 3, End game with 2 or 3 sulfur in barrel: 5/7 vp +5) · won by You',
        other: 'Final scores: Ana 60 (voyage 5, empire 6, shillings 3, End game with 2 or 3 sulfur in barrel: 5/7 vp +5) · won by Ana'
    }
}

/** A writ as a table reads it, stated from the printed writ and not from the UI's own label. */
function writWords(writId: string): string {
    const writ = RoyalWrits.find(({ id }) => id === writId)
    if (!writ) {
        throw new Error(`No writ ${writId}`)
    }
    return 'number' in writ ? `Mandate ${writ.number}` : writ.text
}

describe('R-X.1 Every action type has its line (contract: Game log and history)', () => {
    it('The logic package lists 40 types, and each has a line', () => {
        const types = Object.values(ActionType)

        expect(types).toHaveLength(40)
        for (const type of types) {
            expect(Lines[type], type).toBeDefined()
            expect(Lines[type].action.type, type).toBe(type)
            expect(describeAction(Lines[type].action, viewOf(undefined)), type).toBeDefined()
        }
    })

    it.each(Object.values(ActionType))(
        '%s reads as the contract lists it, for its actor',
        (type) => {
            const { action, actor } = Lines[type]
            const viewer = action.playerId ?? 'p1'
            expect(line(action, viewer)).toBe(
                action.type === ActionType.AnswerAttack || action.type === ActionType.AnswerStarve
                    ? actor.replace(/^Ben/, 'You')
                    : actor
            )
        }
    )

    it.each(Object.values(ActionType))(
        '%s reads as the contract lists it, for another seat',
        (type) => {
            expect(line(Lines[type].action, 'p3')).toBe(Lines[type].other)
        }
    )

    it.each(Object.values(ActionType))('%s reads for a spectator as for another seat', (type) => {
        expect(line(Lines[type].action, undefined)).toBe(Lines[type].other)
    })

    it('An unknown type has no line, so the shared fallback can take it', () => {
        expect(describeAction({ ...Base, type: 'callGame' }, viewOf('p1'))).toBeUndefined()
    })
})

describe("The contract's own wording", () => {
    it('R-3.1-H1 Ana finalised · pouch sulfur', () => {
        expect(line(Lines[ActionType.FinaliseHand].action, 'p3')).toBe(
            'Ana finalised · pouch sulfur'
        )
    })

    it('R-4.4.1 drew 3, kept 1, 2 under the deck', () => {
        expect(line(Lines[ActionType.KeepWrits].action, 'p2')).toBe(
            'Ana drew 3, kept 1, 2 under the deck'
        )
    })

    it('R-4.2.3 A path with its ways, the space as region and number', () => {
        expect(line(Lines[ActionType.Move].action, 'p2')).toContain(
            'monk Forest 2 → Island 1 by ferry (2s) → Island 2 by road'
        )
    })

    it('R-4.5.4 Ana became Merchant master; Ben dropped to journeyman', () => {
        expect(line(Lines[ActionType.Tax].action, 'p3')).toContain(
            'Ana became Merchant master; Ben dropped to journeyman'
        )
    })

    it('R-3.14.1 Ben flipped Defend, or Ben let it stand', () => {
        const answer = (flipDefend: boolean) =>
            sample<AnswerAttack>({
                ...Base,
                playerId: 'p2',
                type: ActionType.AnswerAttack,
                revealsInfo: true,
                flipDefend,
                metadata: { vp: flipDefend ? 2 : 0 }
            })
        expect(line(answer(true), 'p1')).toBe('Ben flipped Defend · +2 vp')
        expect(line(answer(false), 'p1')).toBe('Ben let it stand')
    })
})

const Protected: readonly {
    readonly name: string
    readonly action: GameAction
    readonly actorNames: readonly string[]
    readonly otherLine: string
}[] = [
    {
        name: 'R-3.1 FinaliseHand cards',
        action: Lines[ActionType.FinaliseHand].action,
        actorNames: ['Move', 'Tax'],
        otherLine: 'Ana finalised · pouch sulfur'
    },
    {
        name: 'R-3.10.1 Explore draw',
        action: Lines[ActionType.Explore].action,
        actorNames: ['Mandate 1', 'Mandate 2', 'Mandate 3'],
        otherLine: 'Ana drew 3 writs, to keep 1'
    },
    {
        name: 'R-4.4.1 KeepWrits kept and returned',
        action: Lines[ActionType.KeepWrits].action,
        actorNames: ['Mandate 1', 'Mandate 2', 'Mandate 3'],
        otherLine: 'Ana drew 3, kept 1, 2 under the deck'
    },
    {
        name: 'R-3.10.2 KeepWrits Shovels & Swords draw',
        action: sample<KeepWrits>({
            ...Base,
            type: ActionType.KeepWrits,
            keep: ['writ.mandate.1'],
            shovelsAndSwords: true,
            metadata: {
                keptCount: 1,
                returnedCount: 0,
                returned: [],
                drawnCount: 2,
                keepNext: 1,
                drawnWritIds: ['writ.mandate.4', 'writ.mandate.5']
            }
        }),
        actorNames: ['Mandate 1', 'Mandate 4', 'Mandate 5'],
        otherLine:
            'Ana drew 1, kept 1, 0 under the deck · Shovels & Swords: drew 2 writs, to keep 1'
    },
    {
        name: 'R-4.4.4 DiscardWrit writ',
        action: Lines[ActionType.DiscardWrit].action,
        actorNames: ['Mandate 7'],
        otherLine: 'Ana discarded a writ under the deck'
    },
    {
        name: 'R-4.4.3 SealCharter writ',
        action: Lines[ActionType.SealCharter].action,
        actorNames: ['End game with 2 or 3 sulfur in barrel'],
        otherLine: 'Ana sealed a charter'
    },
    {
        name: 'R-4.6.4 Threshold draw on a Guild card',
        action: Lines[ActionType.GuildAction].action,
        actorNames: ['Mandate 1', 'Mandate 2'],
        otherLine: Lines[ActionType.GuildAction].other
    },
    {
        name: 'R-3.7.5 A voyage draw',
        action: sample<PlaceDisc>({
            ...Base,
            type: ActionType.PlaceDisc,
            place: true,
            metadata: {
                disc: 'voyage',
                space: 7,
                drawnCount: 2,
                drawnWritIds: ['writ.mandate.7', 'writ.mandate.8']
            }
        }),
        actorNames: ['Mandate 7', 'Mandate 8'],
        otherLine: 'Ana took voyage space 7 · drew 2 writs'
    }
]

describe('R-X.2, R-4.4.1, R-4.4.3 A line reads the Action as this seat received it', () => {
    const table = realGames()[0]

    it.each(Protected)('$name: named to the actor, as a real projection gives it', (entry) => {
        const own = recordFor(entry.action, { kind: 'player', playerId: 'p1' }, table)
        const said = line(own, 'p1')
        for (const name of entry.actorNames) {
            expect(said).toContain(name)
        }
    })

    it.each(Protected)(
        '$name: named to no other seat or spectator, from a real projection',
        (entry) => {
            for (const perspective of [
                { kind: 'player', playerId: 'p3' },
                Spectator
            ] satisfies Visibility.Perspective[]) {
                const record = recordFor(entry.action, perspective, table)
                const viewer = perspective.kind === 'player' ? perspective.playerId : undefined
                expect(line(record, viewer)).toBe(entry.otherLine)
            }
        }
    )

    it.each(Protected)('$name: a Local game holds the field and still shows the back', (entry) => {
        expect(line(entry.action, 'p3')).toBe(entry.otherLine)
        expect(line(entry.action, undefined)).toBe(entry.otherLine)
    })

    it.each(Protected)('$name: S57 Host View names it', (entry) => {
        const said = line(entry.action, 'p3', true)
        for (const name of entry.actorNames) {
            expect(said).toContain(name)
        }
    })

    it('R-4.4.1 No hidden choice changes the line or its length for another seat', () => {
        const explore = (drawnWritIds: KeepWrits['keep'], other: string) =>
            line(
                sample<Explore>({
                    ...Base,
                    type: ActionType.Explore,
                    revealsInfo: true,
                    metadata: { drawnCount: 3, keep: 1, drawnWritIds }
                }),
                other
            )
        const charter = (writId: SealCharter['writId']) =>
            line(sample<SealCharter>({ ...Base, type: ActionType.SealCharter, writId }), 'p2')
        const hand = (cards: FinaliseHand['cards']) =>
            line(
                sample<FinaliseHand>({
                    ...Base,
                    type: ActionType.FinaliseHand,
                    revealsInfo: true,
                    cards
                }),
                'p2'
            )

        expect(explore(['writ.mandate.1', 'writ.mandate.2', 'writ.mandate.3'], 'p2')).toBe(
            explore(['writ.charter.sulfur-barrel', 'writ.mandate.7', 'writ.mandate.8'], 'p2')
        )
        expect(charter('writ.charter.sulfur-barrel')).toBe(charter('writ.mandate.1'))
        expect(hand(['move', 'tax', 'conquer'])).toBe(hand(['defend']))
    })

    it('R-3.1-H1 A pouch good is public once finalised; no pouch says none', () => {
        const hand = (pouchGood?: FinaliseHand['pouchGood']) =>
            sample<FinaliseHand>({
                ...Base,
                type: ActionType.FinaliseHand,
                revealsInfo: true,
                cards: ['move'],
                ...(pouchGood ? { pouchGood } : {})
            })
        for (const perspective of [
            { kind: 'player', playerId: 'p2' },
            Spectator
        ] satisfies Visibility.Perspective[]) {
            const viewer = perspective.kind === 'player' ? perspective.playerId : undefined
            expect(line(recordFor(hand('saltpeter'), perspective, table), viewer)).toBe(
                'Ana finalised · pouch saltpeter'
            )
            expect(line(recordFor(hand(), perspective, table), viewer)).toBe('Ana finalised')
        }
        expect(
            line(recordFor(hand('sulfur'), { kind: 'player', playerId: 'p1' }, table), 'p1')
        ).toBe('You finalised · pouch sulfur · Move')
    })

    it('R-4.6-H2 A hidden-bead draw names the drawn bead alone, to all; R-5-H1 a concealed seal never', () => {
        const pull = sample<GuildAction>({
            ...Base,
            type: ActionType.GuildAction,
            guildId: 'farmer',
            fn: 'pull',
            params: {},
            metadata: {
                ...Outcome,
                details: {
                    kind: 'farmer-pull',
                    high: 'seal.17',
                    low: 'seal.1',
                    bead: 'seal.1',
                    chicken: 2,
                    chickenSum: 5
                }
            }
        })
        const said = 'used Farmer pull: drew bead +2 for chicken 2, now 5'
        expect(line(recordFor(pull, Spectator, table), undefined)).toBe(`Ana ${said}`)
        expect(line(recordFor(pull, { kind: 'player', playerId: 'p2' }, table), 'p2')).toBe(
            `Ana ${said}`
        )
        expect(line(recordFor(pull, { kind: 'player', playerId: 'p1' }, table), 'p1')).toBe(
            `You ${said}`
        )

        const push = sample<GuildAction>({
            ...Base,
            type: ActionType.GuildAction,
            guildId: 'knight',
            fn: 'push',
            params: { scrollSpaces: ['guild.noble.scroll.r1c1'] },
            metadata: {
                ...Outcome,
                details: {
                    kind: 'knight-push',
                    markers: [{ colour: Color.Red, playerId: 'p2' }],
                    rows: 1,
                    columns: 0,
                    count: 'rows'
                }
            }
        })
        expect(line(push, 'p1')).not.toMatch(/bead|\+\d(?! vp)/)
    })

    it('R-4.4.3 A sealed charter is named to everyone at ScoreGame and at no line before it', () => {
        for (const viewer of ['p1', 'p2', undefined]) {
            expect(line(Lines[ActionType.ScoreGame].action, viewer)).toContain(
                'End game with 2 or 3 sulfur in barrel'
            )
        }
    })

    it('R-3.14-H1 An answer of no reads the same whichever hand let it stand', () => {
        const noAttack = sample<AnswerAttack>({
            ...Base,
            playerId: 'p2',
            type: ActionType.AnswerAttack,
            revealsInfo: true,
            flipDefend: false,
            metadata: { vp: 0 }
        })
        const noStarve = sample<AnswerStarve>({
            ...Base,
            playerId: 'p2',
            type: ActionType.AnswerStarve,
            revealsInfo: true,
            royalImmunity: false,
            metadata: { actorId: 'p1', spaceId: 'space.desert.3', role: 'serf', cancelled: false }
        })
        for (const viewer of ['p1', 'p3', undefined]) {
            expect(line(noAttack, viewer)).toBe('Ben let it stand')
            expect(line(noStarve, viewer)).toBe('Ben let it go')
        }
    })
})

describe('R-X.2 The description cannot fall back on the state', () => {
    // Walked here, not in the spec below: the corpus takes most of a spec's time limit alone.
    const game = realGames()[0]

    it('It takes the Action and who looks, and asks that look for nothing else', () => {
        const asked = new Set<string | symbol>()
        const view = new Proxy(viewOf('p2'), {
            get(target, key, receiver) {
                asked.add(key)
                return Reflect.get(target, key, receiver)
            }
        })
        for (const type of Object.values(ActionType)) {
            describeAction(Lines[type].action, view)
        }
        expect([...asked].toSorted()).toEqual(['hostView', 'nameOf', 'viewerId'])
    })

    it('Its source imports no session or state, and names none', () => {
        const imported = [...actionDescriptionSource.matchAll(/from '([^']+)'/g)].map(
            ([, from]) => from
        )

        expect(imported.filter((from) => /session|Context|testing/i.test(from))).toEqual([])
        expect(actionDescriptionSource).not.toMatch(
            /gameState|\.state\b|\bstate:|getPlayerState|FeudumGameState/
        )
    })

    it('R-4.4.4 The same record reads the same whatever this seat holds in its state', async () => {
        const host = new FeudumHost()
        await host.playStartingGoods()
        const record = recordFor(
            Lines[ActionType.SealCharter].action,
            { kind: 'player', playerId: 'p2' },
            game
        )
        const seat = await host.openSeat('p2')
        const before = seat.actionLine({ ...record, playerId: 'p1' })
        host.edit((state) => {
            state.getPlayerState('p1').writCount = 3
            state.getPlayerState('p1').sealedCharterCount = 1
        })
        await settled(seat)
        expect(seat.actionLine({ ...record, playerId: 'p1' })).toBe(before)
        expect(before).toBe('Player 1 sealed a charter')
        host.close()
    })
})

describe('R-4.5.4 A rank change is named on the Action that caused it', () => {
    const Named = 'Ana became Merchant master; Ben dropped to journeyman'
    const Caused: readonly { readonly name: string; readonly action: GameAction }[] = [
        {
            name: 'TendLandscape',
            action: sample<TendLandscape>({
                ...Base,
                type: ActionType.TendLandscape,
                tileId: 'tile.forest.ii',
                spaceId: 'space.forest.2',
                collect: false,
                metadata: { landscape: 'sulfur-mine', filled: 2, vp: 0, ...MerchantRanks }
            })
        },
        {
            name: 'StarveThePeople',
            action: sample<StarveThePeople>({
                ...Base,
                type: ActionType.StarveThePeople,
                spaceId: 'space.desert.3',
                targetPlayerId: 'p2',
                role: 'serf',
                metadata: { asked: false, starved: { beads: [], ...MerchantRanks } }
            })
        },
        {
            name: 'GuildAction',
            action: sample<GuildAction>({
                ...Base,
                type: ActionType.GuildAction,
                guildId: 'merchant',
                fn: 'pull',
                params: { goods: ['iron'] },
                metadata: {
                    ...Outcome,
                    ...MerchantRanks,
                    details: {
                        kind: 'merchant-pull',
                        spaces: ['guild.merchant.space.iron-2'],
                        rows: 0,
                        columns: 0
                    }
                }
            })
        },
        {
            name: 'PlayMandate',
            action: sample<PlayMandate>({
                ...Base,
                type: ActionType.PlayMandate,
                writId: 'writ.mandate.7',
                alternative: 0,
                metadata: {
                    slot: 3,
                    received: { kind: 'shillings', amount: 3 },
                    ...MerchantRanks
                }
            })
        },
        {
            name: 'CollectLandscapes',
            action: sample<CollectLandscapes>({
                ...Base,
                type: ActionType.CollectLandscapes,
                spaceIds: ['space.forest.2'],
                metadata: {
                    collections: [
                        {
                            spaceId: 'space.forest.2',
                            landscape: 'archery-butt',
                            collected: {
                                kept: 2,
                                paid: 0,
                                rulerId: 'p1',
                                seatMarkers: 2,
                                rulerMarkers: 0
                            }
                        }
                    ],
                    ...MerchantRanks
                }
            })
        }
    ]

    it.each(Caused)('$name', ({ action }) => {
        expect(line(action, 'p3')).toContain(Named)
    })
})

describe('R-4.8-H2 A feudum falls: the flip, the markers home, the serf now ruling', () => {
    const fell = sample<CommitAttack>({
        ...Base,
        type: ActionType.CommitAttack,
        saltpeter: 0,
        weapons: [],
        metadata: {
            defenderId: 'p2',
            spaceId: 'space.desert.3',
            target: { kind: 'feudum' },
            defendFlipped: false,
            attack: { pawns: 2, monsters: 0, saltpeter: 0, weapons: 0, serf: 1, total: 3 },
            defence: { pawns: 0, monsters: 0, feudum: 2, subject: 0, defend: 0, total: 2 },
            attackerWins: true,
            vp: 3,
            rankChanges: [],
            conquered: {
                kind: 'feudum',
                discId: 'disc.start.1',
                markersHome: [{ playerId: 'p2', count: 2 }],
                newRulerId: 'p1'
            },
            weaponStrengths: []
        }
    })

    it('S37 Each seat reads it', () => {
        expect(line(fell, 'p3')).toContain(
            'the feudum at Desert 3 fell to an outpost · markers home: Ben 2 · Ana became ruler of the outpost'
        )
        expect(line(fell, 'p1')).toContain('You became ruler of the outpost')
        expect(line(fell, 'p2')).toContain('markers home: you 2')
    })
})

describe('R-X.1 Another seat reads its own piece as its own', () => {
    it('"your" and "you" come from who looks', () => {
        const attacked = Lines[ActionType.Conquer].action

        expect(line(attacked, 'p2')).toBe(
            'Ana attacked your knight at Desert 3 and asked you to answer'
        )
        expect(line(attacked, 'p3')).toBe(
            "Ana attacked Ben's knight at Desert 3 and asked Ben to answer"
        )
    })
})

describe('R-X.1 "You" comes from who looks, not from the actor', () => {
    let host: FeudumHost
    afterEach(() => host.close())

    it("Each seat's own session reads its own line", async () => {
        host = new FeudumHost()
        await host.playStartingGoods()
        const chosen = host.actions.find(({ type }) => type === ActionType.ChooseStartingGoods)
        assertExists(chosen, 'A seat chose its starting goods')
        const actorId = chosen.playerId
        assertExists(actorId, 'A seat chose them')

        for (const seatId of host.order) {
            const session = await host.openSeat(seatId)
            const said = session.actionLine(chosen) ?? ''
            if (seatId === actorId) {
                expect(said).toMatch(/^You chose /)
            } else {
                expect(said.startsWith(`${session.getPlayerName(actorId)} chose `)).toBe(true)
                expect(said).not.toMatch(/You/)
            }
        }
    })

    it('S57 A session in Host View reads the hidden name; the same seat out of it does not', async () => {
        host = new FeudumHost()
        await host.playStartingGoods()
        const [seatId, otherId] = host.order
        const session = await host.openSeat(seatId)
        const hand = sample<FinaliseHand>({
            ...Base,
            playerId: otherId,
            type: ActionType.FinaliseHand,
            revealsInfo: true,
            cards: ['move', 'tax']
        })

        expect(session.actionLine(hand)).toBe(`${session.getPlayerName(otherId)} finalised`)
        vi.spyOn(session, 'isViewingHost', 'get').mockReturnValue(true)
        expect(session.actionLine(hand)).toBe(
            `${session.getPlayerName(otherId)} finalised · Move, Tax`
        )
    })

    it('A session passes its own seat: two sessions read one Action two ways', async () => {
        host = new FeudumHost()
        await host.playStartingGoods()
        const chosen = host.actions.find(({ type }) => type === ActionType.ChooseStartingGoods)
        assertExists(chosen?.playerId, 'A seat chose its starting goods')
        const other = host.order.find((id) => id !== chosen.playerId)
        assertExists(other, 'Another seat')
        const actor = await host.openSeat(chosen.playerId)
        const watcher = await host.openSeat(other)

        expect(actor.actionLine(chosen)).toMatch(/^You /)
        expect(watcher.actionLine(chosen)).not.toMatch(/^You /)
    })
})

describe('R-3.14-H1 A real answer reads the same whichever hand gave it', () => {
    const Held = ['defend', 'tax'] as const
    const NotHeld = ['tax', 'guild'] as const

    async function answered(build: () => Promise<AskTable>, answer: RegExp) {
        const table = await build()
        const { asked, session, third, host } = table
        try {
            await primaryNamed(asked.actionPanel, answer).send()
            await settled(asked)
            await settled(session)
            await settled(third)
            flushSync()
            const said = (seat: typeof asked) => {
                const last = seat.actions.findLast(({ source }) => source === ActionSource.User)
                assertExists(last, 'The seat answered')
                return seat.actionLine(last)
            }
            return { own: said(asked), attacker: said(session), third: said(third) }
        } finally {
            host.close()
        }
    }

    it('An attack let stand', async () => {
        const held = await answered(() => askedToDefend(Held), /^Let it stand/)
        const not = await answered(() => askedToDefend(NotHeld), /^Let it stand/)

        expect(held.own).toMatch(/^You let it stand/)
        expect(held.attacker).toMatch(/^Player \d let it stand/)
        expect(held.third).toMatch(/^Player \d let it stand/)
        expect(not).toEqual(held)
    })

    it('A starving let go', async () => {
        const held = await answered(() => askedToStarve(Held), /^Let it go/)
        const not = await answered(() => askedToStarve(NotHeld), /^Let it go/)

        expect(held.own).toMatch(/^You let it go/)
        expect(held.attacker).toMatch(/^Player \d let it go/)
        expect(held.third).toMatch(/^Player \d let it go/)
        expect(not).toEqual(held)
    })
})

describe('R-4.4.3 A real sealed charter, from each seat', () => {
    const Sealed = 'writ.charter.monster-defeat'
    const Words = 'If you defeat either monster'

    it('Named to its sealer alone when sealed, and to everyone at ScoreGame', async () => {
        const { host, seat, sessions } = await playOutRound(
            5,
            (state, table) => {
                giveSeal(state, table.seat)
                holdWrit(state, table.seat, Sealed)
            },
            undefined,
            async (table, seatId) => {
                await table.send(seatId, { type: ActionType.SealCharter, writId: Sealed })
            }
        )
        for (const session of sessions) {
            const sealing = session.actions.find(({ type }) => type === ActionType.SealCharter)
            const scoring = session.actions.find(({ type }) => type === ActionType.ScoreGame)
            assertExists(sealing, 'The charter was sealed')
            assertExists(scoring, 'The game was scored')
            const said = session.actionLine(sealing) ?? ''
            if (session.myPlayerId === seat) {
                expect(said).toContain(Words)
            } else {
                expect(said).toBe(`${session.getPlayerName(seat)} sealed a charter`)
            }
            expect(session.actionLine(scoring)).toContain(Words)
            for (const action of session.actions) {
                if (action.type !== ActionType.ScoreGame && session.myPlayerId !== seat) {
                    expect(session.actionLine(action) ?? '', action.type).not.toContain(Words)
                }
            }
        }
        const spectator = host
            .projected(Spectator)
            .actions.find(({ type }) => type === ActionType.SealCharter)
        assertExists(spectator, 'A spectator receives the record')
        expect(describeAction(spectator, { viewerId: undefined, nameOf: () => 'That seat' })).toBe(
            'That seat sealed a charter'
        )
        host.close()
    })
})

describe('R-X.1 The waiting view ends with what the previous seat just did', () => {
    const hosts: FeudumHost[] = []
    afterEach(() => {
        for (const host of hosts.splice(0)) {
            host.close()
        }
    })

    async function watching(otherCards: readonly ActionCardKind[]) {
        const table = await askedToDefend(otherCards)
        const { session, third, asked, host } = table
        hosts.push(host)
        await settled(third)
        flushSync()
        const last = third.actions.findLast(({ source }) => source === ActionSource.User)
        assertExists(last, 'The attacker has acted')
        return { session, third, asked, host, last }
    }

    it("From the same line this seat's log reads", async () => {
        const { third, asked, last } = await watching(['defend', 'tax'])
        const said = third.actionLine(last) ?? ''

        expect(said).toMatch(/^Player \d attacked /)
        expect(linesOf(third.actionPanel, 'previous')).toEqual([said])
        expect(linesOf(asked.actionPanel, 'previous')).toEqual([])
    })

    it('The same whichever hand the asked seat holds', async () => {
        const held = await watching(['defend', 'tax'])
        const heldLine = linesOf(held.third.actionPanel, 'previous')
        held.host.close()
        hosts.length = 0
        const notHeld = await watching(['tax', 'guild'])

        expect(linesOf(notHeld.third.actionPanel, 'previous')).toEqual(heldLine)
    })

    it('A System Action after it does not take its place', async () => {
        const { host, seat, other } = await atPlayingCards(['move'], { otherCards: ['move'] })
        hosts.push(host)
        const thirdId = host.order.find((id) => id !== seat && id !== other)
        assertExists(thirdId, 'A third seat')
        const third = await host.openSeat(thirdId)
        await host.send(seat, { type: ActionType.ForfeitCard, kind: 'move' })
        await settled(third)
        flushSync()

        expect(third.actions.at(-1)?.source).toBe(ActionSource.System)
        expect(linesOf(third.actionPanel, 'previous')).toEqual([
            `${third.getPlayerName(seat)} forfeited Move`
        ])
    })

    it('Not while reading the log in History View', async () => {
        const { third } = await watching(['defend', 'tax'])
        await third.history.goToPreviousAction()
        flushSync()

        expect(third.isViewingHistory).toBe(true)
        expect(third.previousSeatLine).toBeUndefined()
    })
})

const RawId = /\b(?:space|writ|guild|card|tile|disc|seal|route)\.[a-z]/
const Unfilled = /undefined|\[object|NaN/

describe('R-X.2 Whole games at 2 to 5 seats, every Action from every perspective', () => {
    const walks = realGames()
    const types = new Set<string>()
    const protectedTypes = new Set<string>()

    it.each(walks.map((walk) => ({ walk, seats: walk.game.players.length })))(
        '$seats seats',
        ({ walk }) => {
            const nameOf = (id: string) =>
                walk.game.players.find((player) => player.id === id)?.name ?? id
            for (const action of processedOf(walk)) {
                types.add(action.type)
                const open = new Set(writsNamedIn(recordFor(action, Spectator, walk)))
                const known = action.playerId
                    ? recordFor(action, { kind: 'player', playerId: action.playerId }, walk)
                    : action
                const hidden = writsNamedIn(known).filter((id) => !open.has(id))
                if (hidden.length > 0) {
                    protectedTypes.add(action.type)
                }
                for (const perspective of perspectivesOf(walk)) {
                    const record = recordFor(action, perspective, walk)
                    const viewerId =
                        perspective.kind === 'player' ? perspective.playerId : undefined
                    const said = describeAction(record, { viewerId, nameOf })
                    expect(said, action.type).toBeDefined()
                    expect(said, action.type).not.toMatch(RawId)
                    expect(said, action.type).not.toMatch(Unfilled)
                    for (const writId of hidden) {
                        if (viewerId === action.playerId) {
                            expect(said, action.type).toContain(writWords(writId))
                        } else {
                            expect(said, action.type).not.toContain(writWords(writId))
                        }
                    }
                }
            }
        }
    )

    it('They carry the protected writ fields this spec means to prove', () => {
        expect([...protectedTypes]).toEqual(
            expect.arrayContaining([
                ActionType.Explore,
                ActionType.KeepWrits,
                ActionType.GuildAction,
                ActionType.PlaceDisc
            ])
        )
    })

    it('They fire every type but four: SealCharter is played below, the others stated above', () => {
        const unseen = Object.values(ActionType).filter((type) => !types.has(type))

        expect(unseen.toSorted()).toEqual([
            ActionType.PlaceVessel,
            ActionType.ReclaimImmunitySeal,
            ActionType.SealCharter,
            ActionType.SpendRegionTile
        ])
    })

    it('R-4.5.4 Rank changes are named on the Action that caused them', () => {
        let named = 0
        for (const walk of walks) {
            const nameOf = (id: string) =>
                walk.game.players.find((player) => player.id === id)?.name ?? id
            for (const action of processedOf(walk)) {
                const changes = rankChangesIn('metadata' in action ? action.metadata : undefined)
                if (changes.length === 0) {
                    continue
                }
                const said = describeAction(action, { viewerId: undefined, nameOf }) ?? ''
                for (const change of changes) {
                    expect(said, action.type).toContain(nameOf(change))
                    named += 1
                }
                expect(said, action.type).toMatch(/ became | dropped to | left the /)
            }
        }
        expect(named).toBeGreaterThan(0)
    })
})

function rankChangesIn(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.flatMap(rankChangesIn)
    }
    if (typeof value !== 'object' || value === null) {
        return []
    }
    return Object.entries(value).flatMap(([key, inner]) =>
        key === 'rankChanges' && Array.isArray(inner)
            ? inner.flatMap((change: unknown) =>
                  typeof change === 'object' &&
                  change !== null &&
                  'playerId' in change &&
                  typeof change.playerId === 'string'
                      ? [change.playerId]
                      : []
              )
            : rankChangesIn(inner)
    )
}
