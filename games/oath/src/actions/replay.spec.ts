import { RunMode, vaultOf, engine } from '../testing/engine.js'
import { buildAction } from '../testing/actions.js'
import { SetupVariant } from '../model/oathEnums.js'
import { describe, expect, it } from 'vitest'
import { ActionSource, Game, assert, assertExists, type GameAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { TOP_CRADLE_SLOT } from '../data/mapSlots.js'
import { MachineState } from '../definition/states.js'
import { Search, SearchSource, isSearch } from './search.js'
import { SearchPlay, SearchResolve } from './searchResolve.js'
import { Peek, PeekTargetKind, isPeek } from './peek.js'
import { Recover, RecoverTargetKind } from './recover.js'
import { SetupChoice } from './setupChoice.js'
import { Travel, isTravel } from './travel.js'
import { Campaign } from './campaign.js'
import { CampaignSacrifice } from './campaignSacrifice.js'
import { CampaignResolveVictory } from './campaignResolveVictory.js'
import { EndActPhase } from './endActPhase.js'
import { CompleteRest } from './completeRest.js'
import { CampaignTargetKind } from '../model/campaign.js'
import { IMPERIAL_COLOR } from '../model/oathEnums.js'
import { ongoingCampaign, required } from '../testing/required.js'
import { testGame } from '../testing/game.js'

/** At this seed `slot.provinces.1` holds Drowned City, the only site with two relics. */
const MASTER_SEED = '0000000000000000000000000000002a'

type Step = { from: OathProjectedState; actions: GameAction[]; to: OathProjectedState }

function walkSetup() {
    // The Curated variant deals only eight sites, so the seed's Drowned City needs the full deck.
    const game = testGame(['p1', 'p2'], { config: { setupVariant: SetupVariant.Randomized } })
    const { initialState } = engine.startGame(game, { masterSeed: MASTER_SEED })
    const vault = vaultOf(initialState)

    const steps: Step[] = []
    let current = initialState

    const record = (action: GameAction) => {
        const from = structuredClone(current)
        const result = engine.runNext(action, current, game)
        steps.push({
            from,
            actions: result.processedActions,
            // Cloned because the walk later mutates `current` once, before the Recover.
            to: structuredClone(result.updatedState)
        })
        current = result.updatedState
        return result.processedActions[0]
    }

    for (const playerId of current.turnManager.turnOrder) {
        const hydrated = new HydratedOathGameState(current)
        const hand = hydrated.getPlayerState(playerId).knownHand()
        record(buildAction(SetupChoice, {
            playerId,
            // R-1.23.1 — the Chancellor must take the top Cradle site; others any faceup one.
            siteId:
                playerId === current.chancellorPlayerId
                    ? TOP_CRADLE_SLOT
                    : hydrated.faceupSiteIds()[1],
            adviserCardId: hand[0],
            discardOrder: hand.slice(1)
        }))
    }
    return { game, vault, steps, record, state: () => current }
}

function walkTwoTurns() {
    const walk = walkSetup()
    const { record } = walk

    const chancellor = walk.state().chancellorPlayerId
    expect(walk.state().activePlayerIds).toEqual([chancellor])
    expect(walk.state().machineState).toBe(MachineState.ActPhase)

    // R-5.1 — the server records the vault draw in the Search's metadata; a replay cannot recover it.
    const search = record(buildAction(Search, {
        playerId: chancellor,
        drawFrom: SearchSource.WorldDeck,
        revealsInfo: true
    }))
    assert(isSearch(search), 'the Search is the first action processed')
    assertExists(search.metadata, 'the server resolved the draw into the Search record')
    const drawn = search.metadata.draw.drawnCardIds
    record(buildAction(SearchResolve, {
        playerId: chancellor,
        keptCardId: drawn[0],
        discardOrder: drawn.slice(1),
        play: SearchPlay.Discard
    }))

    // R-5.6.2 — travelling onto a facedown site reveals it and its relics from the vault.
    const destination = 'slot.provinces.1'
    record(buildAction(Travel, { playerId: chancellor, siteId: destination }))
    const afterTravel = new HydratedOathGameState(walk.state())
    const [peeked, recovered] = afterTravel.relicSlotsAt(destination)
    expect(recovered, 'the walk needs two relics at the destination').toBeDefined()

    // R-6.3 — the site Peek; the Reliquary is already the Scepter holder's to know (R-6.4-H1).
    record(buildAction(Peek, {
        playerId: chancellor,
        target: { kind: PeekTargetKind.SiteRelic, slotId: required(peeked, 'a relic to peek at').slotId }
    }))

    // Fixture, not rule: Drowned City's Recover burns two favor, which a player may not have.
    required(walk.state().players.find((p) => p.playerId === chancellor), 'the Chancellor').favor = 2
    record(buildAction(Recover, {
        playerId: chancellor,
        target: { kind: RecoverTargetKind.Relic, slotId: required(recovered, 'a relic to recover').slotId }
    }))

    // R-5.5.1 — nobody rules the destination, so the bandits defend; no second pawn is needed.
    const board = new HydratedOathGameState(walk.state()).getPlayerState(chancellor).warbandsOnBoard
    record(buildAction(Campaign, {
        playerId: chancellor,
        defender: { kind: 'bandits' },
        targets: [{ kind: CampaignTargetKind.Site, siteId: destination }],
        attackDice: Object.values(board).reduce((n, c) => n + c, 0),
    }))

    // R-5.5.5.c — exactly enough to win, derived from the roll rather than hard-coded.
    const rolled = ongoingCampaign(walk.state())
    record(buildAction(CampaignSacrifice, {
        playerId: chancellor,
        sacrifice: Math.max(0, rolled.defense - rolled.swords + 1),
        // R-5.5.6 — the bandits have no warbands, so there is no half to kill.
        defeatKills: []
    }))
    expect(walk.state().campaign?.attackerVictorious).toBe(true)

    record(buildAction(CampaignResolveVictory, {
        playerId: chancellor,
        // R-5.5.7.I — the one surviving warband is placed, which takes rule of the site.
        placements: [{ siteId: destination, color: IMPERIAL_COLOR, count: 1 }],
        burnFavor: false
    }))

    record(buildAction(EndActPhase, { playerId: chancellor }))
    record(buildAction(CompleteRest, { playerId: chancellor }))

    const next = required(walk.state().activePlayerIds[0], 'the next active player')
    expect(next).not.toBe(chancellor)
    expect(walk.state().machineState).toBe(MachineState.ActPhase)
    record(buildAction(EndActPhase, { playerId: next }))
    record(buildAction(CompleteRest, { playerId: next }))

    return walk
}

/** What a replaying client has: `RunMode.Single` and no vault. */
function expectEveryStepReplays(game: Game, steps: Step[]) {
    for (const { from, actions, to } of steps) {
        let state = structuredClone(from)
        for (const action of actions) {
            state = engine.run(structuredClone(action), state, game, RunMode.Single).updatedState
        }
        expect(state, `replaying ${actions.map((a) => a.type).join(', ')}`).toEqual(to)
    }
}

function recorded(steps: Step[]): GameAction[] {
    return steps.flatMap((s) => s.actions)
}

describe('every action replays from its recorded form', () => {
    it('R-1.23.1–R-1.23.3 — replaying setup reproduces the same state exactly', () => {
        const { game, steps } = walkSetup()
        expect(steps).toHaveLength(2)
        expectEveryStepReplays(game, steps)
    })

    it('R-4 through R-6 — two full turns replay, vault reads included', () => {
        const { game, steps } = walkTwoTurns()
        expectEveryStepReplays(game, steps)
    })

    it('the walk performs every action that reads the vault', () => {
        const { steps } = walkTwoTurns()
        const actions = recorded(steps)
        const covered = actions.map((a) => a.type)

        for (const type of [
            ActionType.Search,
            ActionType.Travel,
            ActionType.Peek,
            ActionType.Recover
        ]) {
            expect(covered, `${type} is a vault read and must be walked`).toContain(type)
        }
        // R-6.3's site Peek, the player's own; no Peek is ever taken for the Reliquary (R-6.4-H1).
        const peeks = actions.filter(isPeek)
        expect(peeks.filter((p) => p.target.kind === PeekTargetKind.SiteRelic)).toHaveLength(1)
        expect(peeks.every((p) => p.source === ActionSource.User)).toBe(true)

        // The Campaign reads no vault but advances the PRNG, the other way replay can diverge.
        for (const type of [
            ActionType.Campaign,
            ActionType.CampaignSacrifice,
            ActionType.CampaignResolveVictory
        ]) {
            expect(covered).toContain(type)
        }
    })

    it('R-5.5.5 — a Campaign’s roll is reproduced, not recorded', () => {
        const { game, steps } = walkTwoTurns()
        const campaign = required(steps.find((s) => s.actions[0].type === ActionType.Campaign), 'the Campaign step')

        expect(campaign.actions).toHaveLength(1)
        expect(campaign.actions[0]).not.toHaveProperty('attackRoll')
        expect(campaign.to.campaign?.attackRoll?.length).toBeGreaterThan(0)

        const replayed = engine.run(
            structuredClone(campaign.actions[0]),
            structuredClone(campaign.from),
            game,
            RunMode.Single
        )
        expect(replayed.updatedState.campaign).toEqual(campaign.to.campaign)
    })

    it('R-5.1.2 — the Search draw survives the round trip', () => {
        const { steps } = walkTwoTurns()
        const search = required(recorded(steps).find(isSearch), 'the Search step')
        const draw = required(search.metadata, 'the recorded draw').draw

        expect(draw.drawnCardIds.length).toBeGreaterThan(0)
        expect(draw.drawnCardIds.length).toBeLessThanOrEqual(3)
    })

    it('R-5.6.2 — the site reveal survives the round trip', () => {
        const { steps } = walkTwoTurns()
        const travel = required(steps.find((s) => s.actions[0].type === ActionType.Travel), 'the Travel step')
        const reveal = travel.actions.find(isTravel)?.metadata

        expect(reveal?.revealedSiteCardId).toBe('site.drowned-city')
        expect(reveal?.relicsRevealed).toBe(2)
        expect(travel.to.siteCards?.['slot.provinces.1']).toBe('site.drowned-city')
    })

    /** The one-per-pile counts are transcribed from R-1.19, not read off the implementation. */
    it('R-1.19 — the discard seed counts are in the initial state', () => {
        const { steps } = walkSetup()
        const initial = steps[0].from
        expect(initial.discardPileCounts).toEqual({
            cradle: 1,
            provinces: 1,
            hinterland: 1
        })
        for (const player of initial.players) {
            expect(player.handIds).toHaveLength(3)
        }
    })
})
