import { assert, assertExists, type Game } from '@tabletop/common'
import type { HydratedOathGameState } from '../model/gameState.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { WinKind } from '../model/ending.js'
import {
    ChronicleMark,
    ChronicleStep,
    type ChronicleSeat,
    type ChronicleWaysMet,
    type TableRecord
} from '../model/chronicle.js'
import { MachineState } from '../definition/states.js'
import { visionsMetBy } from './oathkeeper.js'
import { isImperialPlayer } from './rule.js'
import { OathRevision, isAtLeastOathRevision } from './revision.js'
import type { GameOutcome } from './victory.js'

/** A step the winner, or the players it names, decide; the phase waits on them. */
export interface ChronicleChoice {
    readonly step: ChronicleStep
    readonly kind: 'choice'
    applies(state: HydratedOathGameState): boolean
    choosers(state: HydratedOathGameState): string[]
}

/** A step the rules settle alone; it runs inside the action that reaches it. */
export interface ChronicleSystemStep {
    readonly step: ChronicleStep
    readonly kind: 'system'
    applies(state: HydratedOathGameState): boolean
    run(state: HydratedOathGameState): void
}

export type ChronicleStepRule = ChronicleChoice | ChronicleSystemStep

/** Law 8 — "the winner performs these steps in order". */
function winnerOf(state: HydratedOathGameState): string {
    const chronicle = state.chronicle
    assertExists(chronicle, 'R-8 — the chronicle is written only after a win')
    return chronicle.ending.winnerPlayerId
}

/** Not yet built: a choice that never waits. */
function choiceToCome(step: ChronicleStep): ChronicleChoice {
    return { step, kind: 'choice', applies: () => false, choosers: (state) => [winnerOf(state)] }
}

/** Not yet built: a system step that changes nothing. */
function systemStepToCome(step: ChronicleStep): ChronicleSystemStep {
    return { step, kind: 'system', applies: () => true, run: () => {} }
}

/** R-8.1 to R-8.8 and the winner's entry, in the Law's order. */
export const CHRONICLE_STEPS: readonly ChronicleStepRule[] = [
    choiceToCome(ChronicleStep.Vow),
    choiceToCome(ChronicleStep.Citizenship),
    choiceToCome(ChronicleStep.BuildOrRepair),
    systemStepToCome(ChronicleStep.Map),
    choiceToCome(ChronicleStep.Suit),
    systemStepToCome(ChronicleStep.AddSix),
    choiceToCome(ChronicleStep.HealStack),
    systemStepToCome(ChronicleStep.Dispossess),
    systemStepToCome(ChronicleStep.Relics),
    systemStepToCome(ChronicleStep.Save),
    systemStepToCome(ChronicleStep.Rebuild),
    choiceToCome(ChronicleStep.Story)
]

/** R-3 — the one winner, and from the chronicle revision the ending R-8 reads. */
export function recordWin(state: HydratedOathGameState, outcome: GameOutcome): void {
    state.winningPlayerIds = [outcome.winnerPlayerId]
    if (!isAtLeastOathRevision(state, OathRevision.Chronicle)) return
    state.chronicle = {
        ending: {
            winnerPlayerId: outcome.winnerPlayerId,
            kind: outcome.kind,
            rule: outcome.rule,
            mark: markOf(outcome.kind),
            waysMet: waysMetBy(state, outcome.winnerPlayerId)
        }
    }
}

function markOf(kind: WinKind): ChronicleMark {
    switch (kind) {
        case WinKind.Successor:
            return ChronicleMark.Successor
        case WinKind.Visionary:
            return ChronicleMark.Visionary
        case WinKind.Usurper:
        case WinKind.StableRegime:
        case WinKind.WarExhaustion:
            return ChronicleMark.Oathkeeper
    }
}

/** R-8.1 — "won with a Vision alone … or won in multiple ways": every way met, not only the one that won. */
function waysMetBy(state: HydratedOathGameState, playerId: string): ChronicleWaysMet {
    const exile = state.getPlayerState(playerId).status === PlayerStatus.Exile
    return {
        usurper:
            exile && state.oathkeeperPlayerId === playerId && state.oathkeeperIsUsurper === true,
        visionIds: exile ? visionsMetBy(state, playerId) : [],
        empire: isImperialPlayer(state, playerId)
    }
}

/** R-3, R-8 — where the action that won goes: the result, or from its revision the chronicle. */
export function stateAfterWin(state: HydratedOathGameState): MachineState {
    if (!isAtLeastOathRevision(state, OathRevision.Chronicle)) return MachineState.EndOfGame
    const chronicle = state.chronicle
    assertExists(chronicle, 'R-3 — the action that won stored its ending')
    assert(
        state.pendingOathkeeperChoice === undefined &&
            state.pendingQuestions === undefined &&
            state.heldTurn === undefined &&
            state.pendingConsent === undefined,
        'R-8 — the chronicle starts with nothing of the game left open'
    )
    chronicle.step = CHRONICLE_STEPS[0].step
    return advanceChronicle(state)
}

/**
 * R-8 — from the step the cursor names, run each system step until a choice waits; once the last
 * step is done, write the record's entry and go to the result.
 */
export function advanceChronicle(state: HydratedOathGameState): MachineState {
    const chronicle = state.chronicle
    assertExists(chronicle?.step, 'R-8 — the chronicle is being written')
    const from = CHRONICLE_STEPS.findIndex((rule) => rule.step === chronicle.step)
    for (const rule of CHRONICLE_STEPS.slice(from)) {
        if (!rule.applies(state)) continue
        if (rule.kind === 'choice') {
            chronicle.step = rule.step
            return MachineState.Chronicle
        }
        rule.run(state)
    }
    chronicle.step = undefined
    appendChronicleEntry(state)
    return MachineState.EndOfGame
}

/** The players the step being written waits on. */
export function chroniclersOf(state: HydratedOathGameState): string[] {
    const step = state.chronicle?.step
    const rule = CHRONICLE_STEPS.find((candidate) => candidate.step === step)
    assert(rule?.kind === 'choice', `R-8 — the chronicle waits only on a choice, not on ${step}`)
    return rule.choosers(state)
}

/** Written once, when the Chronicle phase ends; a later game copies it and adds its own. */
function appendChronicleEntry(state: HydratedOathGameState): void {
    const ending = state.chronicle?.ending
    assertExists(ending, 'R-3 — the action that won stored its ending')
    const table = state.table
    assertExists(table, 'A game from the chronicle revision starts with its table record')
    const earlier = state.chronicleRecord ?? []
    state.chronicleRecord = [
        ...earlier,
        {
            gameNumber: earlier.length + 1,
            sessionName: table.name,
            date: table.date,
            startingOath: state.oathType,
            mark: ending.mark,
            kind: ending.kind,
            rule: ending.rule,
            winner: seatOf(state, table, ending.winnerPlayerId)
        }
    ]
}

/** A name and this game's colour: player ids change between games. */
function seatOf(state: HydratedOathGameState, table: TableRecord, playerId: string): ChronicleSeat {
    const name = table.seatNames[playerId]
    assertExists(name, `The table record names every seat, not ${playerId}`)
    return { name, color: state.getPlayerState(playerId).color }
}

/** The game's name, the day it started (UTC) and each seat's name, as the platform holds them. */
export function tableRecordOf(game: Game): TableRecord {
    const started = game.startedAt ?? game.createdAt
    return {
        name: game.name,
        date: started.toISOString().slice(0, 10),
        seatNames: Object.fromEntries(game.players.map((player) => [player.id, player.name]))
    }
}
