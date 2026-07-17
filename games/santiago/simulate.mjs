// Headless simulation of a full Santiago game.
// Run from /workspace/games/santiago: node simulate.mjs
// Reports state transitions, errors, and final scores.

import { GameEngine } from './node_modules/@tabletop/common/esm/index.js'
import {
    SantiagoRuntime,
    ActionType,
    MachineState,
    SquareType,
} from './esm/index.js'
import { validCanalPlacements, validNeutralTilePlacements } from './esm/util/placement.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

const playerIds = ['p1', 'p2', 'p3', 'p4']
const playerNames = { p1: 'Dave', p2: 'Tom', p3: 'Steven', p4: 'Will' }

function name(id) { return playerNames[id] ?? id }

function makeGame() {
    return {
        id: 'sim-game',
        typeId: 'santiago',
        status: 'started',
        isPublic: false,
        deleted: false,
        ownerId: 'p1',
        name: 'Sim Game',
        hotseat: true,
        players: playerIds.map(id => ({
            id,
            name: playerNames[id],
            isBot: false,
        })),
        config: {},
        winningPlayerIds: [],
        createdAt: new Date(),
        startedAt: null,
    }
}

function getPlayer(state, id) {
    return state.players.find(p => p.playerId === id)
}

function firstEmptySquare(state) {
    for (let col = 0; col < 8; col++) {
        for (let row = 0; row < 6; row++) {
            if (state.board.squares[col][row].type === SquareType.Empty) return { col, row }
        }
    }
    return null
}

let actionId = 1
function buildAction(type, playerId, state) {
    const base = {
        id: `sim-action-${actionId++}`,
        gameId: 'sim-game',
        source: 'user',
        type,
        playerId,
        index: state.actionCount,
    }

    switch (type) {
        case ActionType.PlaceBid: {
            const player = getPlayer(state, playerId)
            const money = player?.money ?? 0
            // Find taken non-zero bids
            const taken = new Set(state.players.filter(p => p.bid != null && p.bid > 0).map(p => p.bid))
            // Try bids 1..money in order; fall back to 0
            let amount = 0
            for (let b = 1; b <= money; b++) {
                if (!taken.has(b)) { amount = b; break }
            }
            return { ...base, amount }
        }

        case ActionType.SelectTile:
            return { ...base, tileIndex: 0 }

        case ActionType.PlaceField: {
            const sq = firstEmptySquare(state)
            if (!sq) throw new Error(`${name(playerId)}: no empty square to place field`)
            return { ...base, col: sq.col, row: sq.row }
        }

        case ActionType.PlaceNeutralTile: {
            const placements = validNeutralTilePlacements(state.board)
            if (!placements.length) throw new Error(`${name(playerId)}: no valid neutral tile placement`)
            return { ...base, col: placements[0].col, row: placements[0].row }
        }

        case ActionType.ProposeCanal: {
            const player = getPlayer(state, playerId)
            const money = player?.money ?? 0
            if (money < 1) return { ...base, type: ActionType.Pass }
            const segs = validCanalPlacements(state.board)
            // Avoid re-proposing a segment we already have a proposal on
            const proposed = new Set(
                (state.canalProposals ?? []).map(p => `${p.segment.orientation},${p.segment.col},${p.segment.row}`)
            )
            const seg = segs.find(s => !proposed.has(`${s.orientation},${s.col},${s.row}`)) ?? segs[0]
            if (!seg) return { ...base, type: ActionType.Pass }
            return { ...base, segment: seg, amount: 1 }
        }

        case ActionType.OverseerDecision: {
            // Accept the first proposal if any, else build on first valid segment
            const hydratedState = SantiagoRuntime.hydrator.hydrateState(state)
            const proposals = hydratedState.canalProposals ?? []
            if (proposals.length > 0) {
                const p = proposals[0]
                return { ...base, segment: p.segment, accepting: true }
            }
            const segs = validCanalPlacements(state.board)
            if (!segs[0]) throw new Error(`${name(playerId)}: no valid canal segment for overseer`)
            return { ...base, segment: segs[0], accepting: false }
        }

        case ActionType.BuildCanal: {
            const segs = validCanalPlacements(state.board)
            if (!segs[0]) throw new Error(`${name(playerId)}: no valid canal segment to build`)
            return { ...base, segment: segs[0] }
        }

        case ActionType.Pass:
            return base

        default:
            throw new Error(`Unknown action type: ${type}`)
    }
}

// ── Main simulation ───────────────────────────────────────────────────────────

const engine = new GameEngine(SantiagoRuntime)
const game = makeGame()
const { startedGame, initialState } = engine.startGame(game)

let state = initialState
let actionCount = 0
let lastPhase = null
let errors = []

console.log(`\nStarting Santiago simulation — ${playerIds.length} players, ${Math.floor(45 / Math.max(4, playerIds.length))} rounds\n`)

while (state.machineState !== MachineState.EndOfGame) {
    if (actionCount > 2000) {
        errors.push('Simulation exceeded 2000 actions — possible infinite loop')
        break
    }

    const phase = state.machineState
    if (phase !== lastPhase) {
        console.log(`  [Round ${state.round}] → ${phase}`)
        lastPhase = phase
    }

    const activeId = state.activePlayerIds?.[0]
    if (!activeId) {
        errors.push(`No active player in state: ${phase}`)
        break
    }

    const validTypes = engine.getValidActionTypesForPlayer(startedGame, state, activeId)
    if (validTypes.length === 0) {
        errors.push(`No valid actions for ${name(activeId)} in state ${phase}`)
        break
    }

    const type = validTypes[0]

    try {
        const action = buildAction(type, activeId, state)
        const result = engine.run(action, state, startedGame)
        state = result.updatedState
        actionCount += result.processedActions.length
    } catch (err) {
        errors.push(`Action ${type} for ${name(activeId)} in ${phase}: ${err.message}`)
        break
    }
}

// ── Results ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`)
console.log(`Simulation finished after ${actionCount} actions\n`)

if (state.machineState === MachineState.EndOfGame) {
    console.log('Final scores:')
    const sorted = [...state.players].sort((a, b) => b.score - a.score)
    for (const p of sorted) {
        const winner = state.winningPlayerIds.includes(p.playerId) ? ' ← winner' : ''
        console.log(`  ${name(p.playerId).padEnd(8)} ${String(p.score).padStart(3)} pts${winner}`)
    }
    console.log(`\nResult: ${state.result}`)
} else {
    console.log(`Game did NOT reach EndOfGame — stopped in: ${state.machineState}`)
}

if (errors.length > 0) {
    console.log(`\nErrors (${errors.length}):`)
    for (const e of errors) console.log(`  ✗ ${e}`)
} else {
    console.log('\nNo errors detected.')
}
