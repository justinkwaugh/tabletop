import { describe, expect, it } from 'vitest'
import {
    assertExists,
    createBranch,
    executeBranchAction,
    executeCommonAction,
    settleSpan,
    type Game,
    type UnmergedBranch
} from '@tabletop/common'
import { AnomalyChallenge } from '../components/anomalies.js'
import { Faction } from '../components/factions.js'
import { ScenarioId } from '../components/scenarios.js'
import { WorldSide } from '../components/worlds.js'
import { canExplore } from '../model/exploration.js'
import type { StellarHorizonsProjectedState } from '../model/gameState.js'
import { heldShipIds } from '../model/holds.js'
import { canAccept, isValidProposal } from '../model/pacts.js'
import { PactTargetKind, type PactTerms } from '../model/pieces.js'
import {
    edit,
    engine,
    executeAll,
    hydrate,
    placeShip,
    startedGame,
    userAction
} from '../testing/fixtures.js'
import { ActionType } from './actions.js'
import { MachineState } from './states.js'

const SYSTEM = 'alpha-centauri'
// Terran DNA: science 8 + 2 players = 10, reward 2 IP and 2 biology markers.
const ANOMALY = 'terran-dna'

function setUp() {
    const { game, state } = startedGame(2, { scenario: ScenarioId.Campaign })
    let starfarers = ''
    let givers = ''
    const ready = edit(state, (hydrated) => {
        const find = (faction: Faction) => {
            const player = hydrated.players.find((candidate) => candidate.faction === faction)
            assertExists(player)
            return player.playerId
        }
        starfarers = find(Faction.Starfarers)
        givers = find(Faction.Givers)
        for (const pool of [hydrated.worldPool, hydrated.setAsideWorlds]) {
            if (pool.includes('m-1')) pool.splice(pool.indexOf('m-1'), 1)
        }
        hydrated.systemState(SYSTEM).worlds = [{ tileId: 'm-1', side: WorldSide.I }]
        hydrated.anomalyPool.splice(hydrated.anomalyPool.indexOf(ANOMALY), 1)
        hydrated.systemState(SYSTEM).anomaly = ANOMALY
        // Orion counts 5 + 1 (research) = 6; Darwin counts 5 + 1 = 6. Neither reaches 10 alone;
        // with the Starfarers in the pact the difficulty is 9.
        placeShip(hydrated, starfarers, 'starfarers-orion', SYSTEM)
        placeShip(hydrated, givers, 'givers-darwin', SYSTEM)
    })
    return { game, state: ready, starfarers, givers }
}

function terms(starfarers: string, givers: string): PactTerms {
    return {
        targetKind: PactTargetKind.Anomaly,
        targetId: ANOMALY,
        challenge: AnomalyChallenge.Science,
        partnerIds: [starfarers, givers],
        pledges: { [starfarers]: ['starfarers-orion'], [givers]: ['givers-darwin'] },
        shares: {
            [starfarers]: { influence: 2, cash: 0, markers: 1, settlements: 0 },
            [givers]: { influence: 0, cash: 0, markers: 1, settlements: 0 }
        }
    }
}

function act(
    game: Game,
    state: StellarHorizonsProjectedState,
    playerId: string,
    type: ActionType,
    fields: Record<string, unknown>
) {
    const result = executeAll(
        game,
        state,
        userAction(game, playerId, type, { common: true, ...fields })
    )
    return { state: result.state, actions: result.processedActions }
}

describe('A pact in a Local Game', () => {
    it('is proposed mid-Branch, agreed, holds the ships and resolves with the split', () => {
        const { game, state, starfarers, givers } = setUp()
        expect(state.machineState).toBe(MachineState.Exploring)
        const branchPlayer = state.activePlayerIds[0]
        const other = branchPlayer === starfarers ? givers : starfarers

        // The Player who is not playing proposes while the other's Branch is open. The Game
        // Client asks the same Main Line, part-way through that Branch, before offering it.
        expect(isValidProposal(hydrate(state), other, terms(starfarers, givers))).toBe(true)
        const proposed = act(game, state, other, ActionType.ProposePact, {
            terms: terms(starfarers, givers)
        })
        expect(proposed.state.machineState).toBe(MachineState.Exploring)
        expect(proposed.state.activePlayerIds).toEqual([branchPlayer])
        const [pact] = proposed.state.pacts
        expect(pact.acceptedIds).toEqual([other])
        expect(heldShipIds(hydrate(proposed.state), other)).toHaveLength(1)

        // The Branch's Player accepts: the pact is agreed and binds.
        expect(canAccept(hydrate(proposed.state), branchPlayer, pact.id, pact.revision)).toBe(true)
        const accepted = act(game, proposed.state, branchPlayer, ActionType.AcceptPact, {
            pactId: pact.id,
            revision: pact.revision
        })
        const [acceptance] = accepted.actions
        expect(acceptance.revealsInfo).toBe(true)
        expect(accepted.state.pacts[0].agreed).toBe(true)
        const hydrated = hydrate(accepted.state)
        expect(canExplore(hydrated, hydrated.ship('starfarers-orion'))).toBe(false)
        expect(canExplore(hydrated, hydrated.ship('givers-darwin'))).toBe(false)

        // Both finish exploring; the pact resolves at its earliest partner and splits.
        let current = accepted.state
        const actions = []
        for (
            let guard = 0;
            guard < 10 && current.machineState === MachineState.Exploring;
            guard++
        ) {
            const [playerId] = current.activePlayerIds
            const result = executeAll(
                game,
                current,
                userAction(game, playerId, ActionType.EndPhase, { phase: 'Exploration' })
            )
            current = result.state
            actions.push(...result.processedActions)
        }
        const resolve = actions.find((action) => action.type === ActionType.ResolveAnomaly)
        assertExists(resolve)
        const metadata = (resolve as { metadata?: { resolved: boolean; shares?: unknown[] } })
            .metadata
        expect(metadata?.resolved).toBe(true)
        expect(metadata?.shares).toHaveLength(2)
        const final = hydrate(current)
        expect(final.getPlayerState(starfarers).anomalies).toEqual([ANOMALY])
        expect(final.getPlayerState(givers).anomalies).toEqual([ANOMALY])
        expect(final.pacts).toEqual([])
    })

    it('refuses terms whose ships fall short, and lapses when a partner closes', () => {
        const { game, state, starfarers, givers } = setUp()
        const branchPlayer = state.activePlayerIds[0]
        const other = branchPlayer === starfarers ? givers : starfarers
        const short = terms(starfarers, givers)
        short.pledges[givers] = []
        expect(() => act(game, state, other, ActionType.ProposePact, { terms: short })).toThrow()
        const proposed = act(game, state, other, ActionType.ProposePact, {
            terms: terms(starfarers, givers)
        })
        // The Branch's Player ends their phase without accepting: the offer lapses.
        const closed = executeAll(
            game,
            proposed.state,
            userAction(game, branchPlayer, ActionType.EndPhase, { phase: 'Exploration' })
        ).state
        const [pact] = closed.pacts
        expect(() =>
            act(game, closed, branchPlayer, ActionType.AcceptPact, {
                pactId: pact.id,
                revision: pact.revision
            })
        ).toThrow()
        expect(heldShipIds(hydrate(closed), other)).toEqual([])
    })
})

describe('A pact in a Hosted Game', () => {
    function hostedSetUp() {
        const { game, state } = startedGame(2, { scenario: ScenarioId.Campaign }, { resting: true })
        const placed = setUpFrom(state)
        return { game, ...placed }
    }

    function setUpFrom(state: StellarHorizonsProjectedState) {
        let starfarers = ''
        let givers = ''
        const ready = edit(state, (hydrated) => {
            const find = (faction: Faction) => {
                const player = hydrated.players.find((candidate) => candidate.faction === faction)
                assertExists(player)
                return player.playerId
            }
            starfarers = find(Faction.Starfarers)
            givers = find(Faction.Givers)
            for (const pool of [hydrated.worldPool, hydrated.setAsideWorlds]) {
                if (pool.includes('m-1')) pool.splice(pool.indexOf('m-1'), 1)
            }
            hydrated.systemState(SYSTEM).worlds = [{ tileId: 'm-1', side: WorldSide.I }]
            hydrated.anomalyPool.splice(hydrated.anomalyPool.indexOf(ANOMALY), 1)
            hydrated.systemState(SYSTEM).anomaly = ANOMALY
            placeShip(hydrated, starfarers, 'starfarers-orion', SYSTEM)
            placeShip(hydrated, givers, 'givers-darwin', SYSTEM)
        })
        return { state: ready, starfarers, givers }
    }

    function common(
        game: Game,
        state: StellarHorizonsProjectedState,
        playerId: string,
        type: ActionType,
        fields: Record<string, unknown>,
        branch: UnmergedBranch['branch']
    ) {
        const outcome = executeCommonAction({
            engine,
            game,
            state,
            action: userAction(game, playerId, type, { common: true, ...fields }),
            branch
        })
        if (outcome.kind === 'refused') throw new Error(outcome.reason)
        return outcome.result.updatedState
    }

    it('is negotiated on the Main Line while both Branches are open, and merges', () => {
        const { game, state: resting, starfarers, givers } = hostedSetUp()
        expect(resting.machineState).toBe(MachineState.ExplorationPhase)
        const branchOf = (playerId: string, mainLine: StellarHorizonsProjectedState) =>
            createBranch({ engine, game, state: mainLine, playerId }).branch
        let mainLine = common(
            game,
            resting,
            starfarers,
            ActionType.ProposePact,
            { terms: terms(starfarers, givers) },
            branchOf(starfarers, resting)
        )
        const [pact] = mainLine.pacts
        mainLine = common(
            game,
            mainLine,
            givers,
            ActionType.AcceptPact,
            { pactId: pact.id, revision: pact.revision },
            branchOf(givers, mainLine)
        )
        expect(mainLine.machineState).toBe(MachineState.ExplorationPhase)
        expect(mainLine.pacts[0].agreed).toBe(true)

        // Each Player then plays their Branch over the Main Line; the held ships cannot explore.
        const play = (playerId: string): UnmergedBranch => {
            let execution = createBranch({ engine, game, state: mainLine, playerId })
            const recorded = [...execution.processedActions]
            const held = playerId === starfarers ? 'starfarers-orion' : 'givers-darwin'
            expect(() =>
                executeBranchAction({
                    engine,
                    game,
                    state: mainLine,
                    branch: execution.branch,
                    action: userAction(game, playerId, ActionType.Explore, { shipId: held })
                })
            ).toThrow()
            execution = executeBranchAction({
                engine,
                game,
                state: mainLine,
                branch: execution.branch,
                action: userAction(game, playerId, ActionType.EndPhase, { phase: 'Exploration' })
            })
            recorded.push(...execution.processedActions)
            return { branch: execution.branch, actions: recorded }
        }
        const settled = settleSpan({
            engine,
            game,
            state: mainLine,
            unmergedBranches: [play(starfarers), play(givers)]
        })
        expect(settled.refusal).toBeUndefined()
        const final = hydrate(settled.updatedState)
        expect(final.getPlayerState(starfarers).anomalies).toEqual([ANOMALY])
        expect(final.getPlayerState(givers).anomalies).toEqual([ANOMALY])
    })

    it('refuses a proposal pledging a ship the proposer used in their own Branch', () => {
        const { game, state: resting, starfarers, givers } = hostedSetUp()
        let execution = createBranch({ engine, game, state: resting, playerId: starfarers })
        execution = executeBranchAction({
            engine,
            game,
            state: resting,
            branch: execution.branch,
            action: userAction(game, starfarers, ActionType.Explore, {
                shipId: 'starfarers-orion'
            })
        })
        expect(() =>
            common(
                game,
                resting,
                starfarers,
                ActionType.ProposePact,
                { terms: terms(starfarers, givers) },
                execution.branch
            )
        ).toThrow(/not valid in your Branch/)
    })
})
