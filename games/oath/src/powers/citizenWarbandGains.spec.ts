import { describe, expect, it } from 'vitest'
import { Color, type GameAction } from '@tabletop/common'
import { MoveWarbands } from '../actions/moveWarbands.js'
import { UseActionPower } from '../actions/useActionPower.js'
import { BattlePlanSide, PowerTiming, powerIndexOf, powersWithTiming } from '../data/cardPowers.js'
import type { OathProjectedState } from '../model/gameState.js'
import { WarbandMoveKind } from '../model/warbandMove.js'
import { buildAction } from '../testing/actions.js'
import { engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { campaignRecords, openTurn, testPlayer, testState } from '../testing/fixture.js'
import { required } from '../testing/required.js'
import { pawnSiteId } from '../util/pawn.js'
import { PowerChoiceKind, type PowerChoice } from '../util/powerChoice.js'
import { OathRevision } from '../util/revision.js'
import { homelandPayout } from '../util/sitePowers.js'
import { effectFor, type EffectContext, type PlayerPlanContext } from './registry.js'
import '../powers/index.js'

const CIT = 'cit'
const CHAN = 'chan'
const FOE = 'foe'

const KEY = 'denizen.discord.key-to-the-city'
const GARRISON = 'denizen.order.garrison'

/** A Citizen at the Ancient City (c1), with their own bank full and the Chancellor's holding `imperial`. */
function table(revision: OathRevision | undefined, imperial = 10) {
    const s = testState(
        [
            testPlayer({ playerId: CIT, color: Color.Yellow, status: PlayerStatus.Citizen, siteId: 'c1', warbandsOnBoard: {}, warbandsInPersonalBank: { [CIT]: 10 } }),
            testPlayer({ playerId: CHAN, color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'p1', warbandsOnBoard: {}, warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: imperial } }),
            testPlayer({ playerId: FOE, color: Color.Blue, siteId: 'h1', warbandsOnBoard: { [FOE]: 2 }, warbandsInPersonalBank: { [FOE]: 10 } })
        ],
        {
            chancellorPlayerId: CHAN,
            siteCards: { c1: 'site.ancient-city', c2: 'site.river', p1: 'site.plains', h1: 'site.wastes' },
            denizensBySite: { c1: [], c2: [KEY], p1: [], h1: [] },
            relicsBySite: { c1: [{ slotId: 'slot-1' }] },
            warbandsBySite: { c1: { [IMPERIAL_WARBANDS]: 1 }, c2: { [FOE]: 1 } },
            ...(revision === undefined ? {} : { oathRevision: revision })
        }
    )
    openTurn(s, CIT)
    s.campaign = {
        attackerPlayerId: CIT,
        defenderPlayerId: FOE,
        nonImperialPlayerIds: [],
        allyPlayerIds: [],
        targets: [],
        attackPool: 0,
        defensePool: 0,
        attackRoll: [],
        defenseRoll: [],
        defense: 0,
        swords: 0,
        defendingForce: [],
        defendingBandits: 0,
        defeatKilled: 2,
        // Cursed Cauldron's count from revision 4 (R-X.4), as the defeat kills before it.
        enemyWarbandsKilled: { attacker: 2, defender: 0 },
        ...campaignRecords()
    }
    return s
}
type Table = ReturnType<typeof table>

function contextFor(s: Table, cardId: string, timing: PowerTiming, choices: PowerChoice[] = [], playerId = CIT): EffectContext {
    const power = required(powersWithTiming(cardId, timing)[0], `${cardId} has a ${timing} power`)
    return { state: s, playerId, power, choices }
}

/** Each runner returns the summary its power recorded. */
type Run = (s: Table, playerId?: string) => string | undefined

function resolve(cardId: string, timing: PowerTiming, choices: PowerChoice[] = []): Run {
    return (s, playerId) => {
        const ctx = contextFor(s, cardId, timing, choices, playerId)
        return required(effectFor(ctx.power), `${cardId} is registered`).resolve(ctx).summary
    }
}

function after(cardId: string, particulars: EffectContext['particulars'] = {}): Run {
    return (s, playerId) => {
        const ctx = { ...contextFor(s, cardId, PowerTiming.Modifier, [], playerId), particulars }
        return required(effectFor(ctx.power)?.modifier?.after, `${cardId} acts after its action`)(ctx)?.summary
    }
}

function victorious(cardId: string): Run {
    return (s, playerId = CIT) => {
        const ctx: PlayerPlanContext = {
            ...contextFor(s, cardId, PowerTiming.BattlePlan, [], playerId),
            campaign: {
                parties: { attackerPlayerId: playerId, defenderPlayerId: playerId === FOE ? CIT : FOE, allyPlayerIds: [], nonImperialPlayerIds: [], targets: [], attackerSiteId: pawnSiteId(s, playerId), forceSiteIds: [] },
                side: BattlePlanSide.Attacker,
                pools: { attackPool: 0, defensePool: 0 }
            }
        }
        const outcome = required(effectFor(ctx.power)?.battlePlan?.onOutcome, `${cardId} pays on victory`)(ctx, true)
        return typeof outcome === 'string' ? outcome : outcome?.note
    }
}

type Gain = { name: string; run: Run; gained: number; placedAt?: string }

/** R-10.10 — every power that says "gain warbands" goes through one helper; the Homeland reward too. */
const GAINS: Gain[] = [
    { name: 'Field Promotion', run: victorious('denizen.order.field-promotion'), gained: 3 },
    { name: 'Second Chance', run: resolve('denizen.beast.second-chance', PowerTiming.Action, [{ kind: PowerChoiceKind.Player, playerId: FOE }]), gained: 1 },
    { name: 'Key to the City', run: resolve(KEY, PowerTiming.WhenPlayed), gained: 1, placedAt: 'c2' },
    { name: 'Dragonskin Drum', run: after('relic.dragonskin-drum'), gained: 1 },
    { name: 'Cursed Cauldron', run: victorious('relic.cursed-cauldron'), gained: 2 },
    { name: 'Animal Host', run: resolve('denizen.beast.animal-host', PowerTiming.WhenPlayed), gained: 1 },
    { name: 'A Small Favor', run: resolve('denizen.discord.a-small-favor', PowerTiming.WhenPlayed), gained: 4 },
    { name: 'Garrison', run: resolve(GARRISON, PowerTiming.WhenPlayed), gained: 1, placedAt: 'c1' },
    { name: 'Relic Breaker', run: resolve('denizen.hearth.relic-breaker', PowerTiming.Action, [{ kind: PowerChoiceKind.RelicSlot, slotId: 'slot-1' }]), gained: 3 },
    { name: 'Wild Cry', run: after('denizen.beast.wild-cry', { playedCardId: 'denizen.beast.animal-host', playedTo: 'site' }), gained: 2 },
    { name: 'the Homeland reward', run: (s, playerId = CIT) => homelandPayout(s, playerId, 'c1', 'denizen.order.battle-honors'), gained: 2 }
]

const onSite = (s: Table, siteId: string | undefined, owner: string) => (siteId ? (s.warbandsBySite[siteId]?.[owner] ?? 0) : 0)

describe('R-6.6.2, R-5.2.2 — a Citizen gains the Empire’s warbands, from the Chancellor’s bank', () => {
    it.each(GAINS)('$name, at revision 5', ({ run, gained, placedAt }) => {
        const s = table(OathRevision.EngineFixes2)
        const before = onSite(s, placedAt, IMPERIAL_WARBANDS)
        run(s)
        const board = s.getPlayerState(CIT).warbandsOnBoard
        const placed = onSite(s, placedAt, IMPERIAL_WARBANDS) - before
        expect(board[CIT] ?? 0).toBe(0)
        expect((board[IMPERIAL_WARBANDS] ?? 0) + placed).toBe(gained)
        expect(placedAt === undefined || placed > 0).toBe(true)
        expect(s.getPlayerState(CHAN).warbandsInPersonalBank[IMPERIAL_WARBANDS]).toBe(10 - gained)
        expect(s.getPlayerState(CIT).warbandsInPersonalBank[CIT]).toBe(10)
    })

    it('as Muster does, a short Chancellor’s bank gives as many as it holds (R-9.3), never the Citizen’s own', () => {
        const s = table(OathRevision.EngineFixes2, 1)
        resolve('denizen.discord.a-small-favor', PowerTiming.WhenPlayed)(s)
        expect(s.getPlayerState(CIT).warbandsOnBoard).toEqual({ [IMPERIAL_WARBANDS]: 1 })
        expect(s.getPlayerState(CHAN).warbandsInPersonalBank[IMPERIAL_WARBANDS]).toBe(0)
        expect(s.getPlayerState(CIT).warbandsInPersonalBank[CIT]).toBe(10)
    })

    it('an Exile and the Chancellor gain as before: their own warbands', () => {
        const s = table(OathRevision.EngineFixes2)
        for (const playerId of [FOE, CHAN]) {
            const ctx = { ...contextFor(s, 'denizen.discord.a-small-favor', PowerTiming.WhenPlayed), playerId }
            required(effectFor(ctx.power), 'A Small Favor is registered').resolve(ctx)
        }
        expect(s.getPlayerState(FOE).warbandsOnBoard[FOE]).toBe(6)
        expect(s.getPlayerState(CHAN).warbandsOnBoard[IMPERIAL_WARBANDS]).toBe(4)
    })
})

describe('R-X.4 — in a game created before revision 5 a Citizen’s power gains stay their own colour', () => {
    const SECOND_CHANCE = 'denizen.beast.second-chance'

    /** What each power left before the revision, from the cards' counts: the Citizen's own warbands, from their own bank. */
    const LEGACY: Record<string, { board: number; bank: number; c1: Record<string, number>; c2: Record<string, number> }> = {
        'Field Promotion': { board: 3, bank: 7, c1: { [IMPERIAL_WARBANDS]: 1 }, c2: { [FOE]: 1 } },
        'Second Chance': { board: 1, bank: 9, c1: { [IMPERIAL_WARBANDS]: 1 }, c2: { [FOE]: 1 } },
        'Key to the City': { board: 0, bank: 9, c1: { [IMPERIAL_WARBANDS]: 1 }, c2: { [FOE]: 0, [CIT]: 1 } },
        'Dragonskin Drum': { board: 1, bank: 9, c1: { [IMPERIAL_WARBANDS]: 1 }, c2: { [FOE]: 1 } },
        'Cursed Cauldron': { board: 2, bank: 8, c1: { [IMPERIAL_WARBANDS]: 1 }, c2: { [FOE]: 1 } },
        'Animal Host': { board: 1, bank: 9, c1: { [IMPERIAL_WARBANDS]: 1 }, c2: { [FOE]: 1 } },
        'A Small Favor': { board: 4, bank: 6, c1: { [IMPERIAL_WARBANDS]: 1 }, c2: { [FOE]: 1 } },
        Garrison: { board: 0, bank: 9, c1: { [IMPERIAL_WARBANDS]: 1, [CIT]: 1 }, c2: { [FOE]: 1 } },
        'Relic Breaker': { board: 3, bank: 7, c1: { [IMPERIAL_WARBANDS]: 1 }, c2: { [FOE]: 1 } },
        'Wild Cry': { board: 2, bank: 8, c1: { [IMPERIAL_WARBANDS]: 1 }, c2: { [FOE]: 1 } },
        'the Homeland reward': { board: 2, bank: 8, c1: { [IMPERIAL_WARBANDS]: 1 }, c2: { [FOE]: 1 } }
    }

    const cases = [undefined, OathRevision.TurnFlow, OathRevision.CostsAndFacedownModifiers, OathRevision.PlanCostsAndSearchPlays, OathRevision.CardFixes1].flatMap((revision) => GAINS.map(({ name, run }) => ({ revision, name, run })))

    it.each(cases)('revision $revision, $name', ({ revision, name, run }) => {
        const expected = required(LEGACY[name], `${name} has a legacy expectation`)
        const s = table(revision)
        run(s)
        const citizen = s.getPlayerState(CIT)
        expect(citizen.warbandsOnBoard[CIT] ?? 0).toBe(expected.board)
        expect(citizen.warbandsOnBoard[IMPERIAL_WARBANDS] ?? 0).toBe(0)
        expect(s.warbandsBySite.c1).toEqual(expected.c1)
        expect(s.warbandsBySite.c2).toEqual(expected.c2)
        expect(citizen.warbandsInPersonalBank).toEqual({ [CIT]: expected.bank })
        expect(s.getPlayerState(CHAN).warbandsInPersonalBank).toEqual({ [IMPERIAL_WARBANDS]: 10 })
    })

    function recordedGame(revision: OathRevision | undefined) {
        const game = testGame([CIT, CHAN, FOE])
        const hydrated = table(revision)
        hydrated.getPlayerState(CIT).setAdvisers([{ cardId: SECOND_CHANCE, faceUp: true }])
        hydrated.getPlayerState(CIT).favor = 3
        hydrated.getPlayerState(CIT).secrets = 2
        hydrated.getPlayerState(FOE).setAdvisers([{ cardId: GARRISON, faceUp: true }])
        hydrated.campaign = undefined
        let current = hydrated.dehydrate()
        current.activePlayerIds = [CIT]
        const record = (action: GameAction) => {
            current = engine.runNext(action, current, game).updatedState
            return structuredClone(current)
        }
        const gained = record(
            buildAction(UseActionPower, {
                playerId: CIT,
                cardId: SECOND_CHANCE,
                powerIndex: powerIndexOf(SECOND_CHANCE, PowerTiming.Action),
                choices: [{ kind: PowerChoiceKind.Player, playerId: FOE }]
            })
        )
        const moved = record(buildAction(MoveWarbands, { playerId: CIT, move: { kind: WarbandMoveKind.BoardToSite }, owner: CIT, count: 1 }))
        return { gained, moved }
    }

    it.each([undefined, OathRevision.TurnFlow, OathRevision.CostsAndFacedownModifiers, OathRevision.PlanCostsAndSearchPlays, OathRevision.CardFixes1])('revision %s: Second Chance gains the Citizen’s own warband, and a later move names it by that owner', (revision) => {
        const { gained, moved } = recordedGame(revision)
        const citizen = (state: OathProjectedState) => required(state.players.find((p) => p.playerId === CIT), 'the Citizen')
        const chancellor = (state: OathProjectedState) => required(state.players.find((p) => p.playerId === CHAN), 'the Chancellor')
        expect(citizen(gained).warbandsOnBoard).toEqual({ [CIT]: 1 })
        expect(citizen(gained).warbandsInPersonalBank).toEqual({ [CIT]: 9 })
        expect(chancellor(gained).warbandsInPersonalBank).toEqual({ [IMPERIAL_WARBANDS]: 10 })
        expect(citizen(moved).warbandsOnBoard[CIT] ?? 0).toBe(0)
        expect(moved.warbandsBySite.c1).toEqual({ [IMPERIAL_WARBANDS]: 1, [CIT]: 1 })
    })

    it('at revision 5 the same power gives the Empire’s warband, so the move of the Citizen’s own is refused', () => {
        expect(() => recordedGame(OathRevision.EngineFixes2)).toThrow(/Cannot move warbands: cannot move 1 of cit's/)
    })
})

describe('R-10.13 — from revision 5 a gain’s summary names whose warbands it gave, so the History draws them in that colour', () => {
    /** The words recorded before the revision, which a game created then keeps. */
    const RECORDED: Record<string, string> = {
        'Field Promotion': 'Field Promotion: gained 3 warbands',
        'Second Chance': "killed a warband on foe's board and gained 1",
        'Key to the City': 'Key to the City: killed 1 at c2, gained 1 and placed 1 there',
        'Dragonskin Drum': 'Dragonskin Drum: gained 1 warband',
        'Cursed Cauldron': 'Cursed Cauldron: gained 2 warbands, one per enemy warband killed',
        'Animal Host': 'gained 1 warbands (1 beast cards at sites)',
        'A Small Favor': 'gained 4 warbands',
        Garrison: 'gained 1 warbands and placed 1 across 1 ruled sites',
        'Relic Breaker': 'Relic Breaker: the relic went to the bottom of the relic deck; gained 3 warbands',
        'Wild Cry': 'Wild Cry: gained 0 Supply and 2 warbands',
        'the Homeland reward': 'Ancient City (Homeland): gained 2 warbands'
    }

    /** A Citizen's gain is the Empire's. Relic Breaker records its owner on its row, so its words stay. */
    const CITIZEN: Record<string, string> = {
        'Field Promotion': 'Field Promotion: gained 3 Imperial warbands',
        'Second Chance': "killed a warband on foe's board and gained 1 Imperial warband",
        'Key to the City': 'Key to the City: killed 1 at c2, gained 1 Imperial warband and placed 1 there',
        'Dragonskin Drum': 'Dragonskin Drum: gained 1 Imperial warband',
        'Cursed Cauldron': 'Cursed Cauldron: gained 2 Imperial warbands, one per enemy warband killed',
        'Animal Host': 'gained 1 Imperial warband (1 beast cards at sites)',
        'A Small Favor': 'gained 4 Imperial warbands',
        Garrison: 'gained 1 Imperial warband and placed 1 across 1 ruled sites',
        'Relic Breaker': 'Relic Breaker: the relic went to the bottom of the relic deck; gained 3 warbands',
        'Wild Cry': 'Wild Cry: gained 0 Supply and 2 Imperial warbands',
        'the Homeland reward': 'Ancient City (Homeland): gained 2 Imperial warbands'
    }

    it.each(GAINS)('$name, a Citizen at revision 5', ({ name, run }) => {
        expect(run(table(OathRevision.EngineFixes2))).toBe(CITIZEN[name])
    })

    const legacy = [undefined, OathRevision.TurnFlow, OathRevision.CostsAndFacedownModifiers, OathRevision.PlanCostsAndSearchPlays, OathRevision.CardFixes1].flatMap((revision) => GAINS.map(({ name, run }) => ({ revision, name, run })))

    it.each(legacy)('revision $revision, $name: the words recorded then', ({ revision, name, run }) => {
        expect(run(table(revision))).toBe(RECORDED[name])
    })

    it('the Chancellor’s gain names the Empire’s warbands too', () => {
        const s = table(OathRevision.EngineFixes2)
        expect(resolve('denizen.discord.a-small-favor', PowerTiming.WhenPlayed)(s, CHAN)).toBe('gained 4 Imperial warbands')
    })

    it('an Exile’s own are a bare count, on a row that counts the actor’s own', () => {
        const s = table(OathRevision.EngineFixes2)
        expect(resolve('denizen.discord.a-small-favor', PowerTiming.WhenPlayed)(s, FOE)).toBe('gained 4 warbands')
        expect(after('relic.dragonskin-drum')(s, FOE)).toBe('Dragonskin Drum: gained 1 warband')
    })

    it('named by their owner where the row counts another’s: Second Chance’s kill, a battle plan read on the other side’s row', () => {
        const s = table(OathRevision.EngineFixes2)
        expect(resolve('denizen.beast.second-chance', PowerTiming.Action, [{ kind: PowerChoiceKind.Player, playerId: FOE }])(s, FOE)).toBe("killed a warband on foe's board and gained 1 of foe's warbands")
        expect(victorious('denizen.order.field-promotion')(s, FOE)).toBe("Field Promotion: gained 3 of foe's warbands")
        expect(victorious('relic.cursed-cauldron')(s, FOE)).toBe("Cursed Cauldron: gained 2 of foe's warbands, one per enemy warband killed")
    })
})
