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
import {
    chronicleOf,
    chronicleSuitLeaders,
    chronicleWinnerOf,
    citizenshipEligible,
    edificeChoices,
    flipCitizenBoards,
    forcedVowOf,
    isExileWinner,
    isImperialWinner,
    seatNameOf,
    unansweredOffers
} from './chronicleChoices.js'

/** A step the winner, or the players it names, decide; the phase waits on them. */
export interface ChronicleChoice {
    readonly step: ChronicleStep
    readonly kind: 'choice'
    /** What the rules settle on reaching the step, before anyone is asked. */
    reach?(state: HydratedOathGameState): void
    /** Whether the step waits on a choice; a step with one possible outcome does not. */
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

/** Not yet built: a system step that changes nothing. */
function systemStepToCome(step: ChronicleStep): ChronicleSystemStep {
    return { step, kind: 'system', applies: () => true, run: () => {} }
}

/** Law 8 — "the winner performs these steps in order". */
const theWinner = (state: HydratedOathGameState) => [chronicleWinnerOf(state)]

/** R-8.1 — a win with a Vision alone has its Oath already; any other win chooses. */
const VOW: ChronicleChoice = {
    step: ChronicleStep.Vow,
    kind: 'choice',
    reach(state) {
        const forced = forcedVowOf(state)
        if (!forced) return
        const chronicle = chronicleOf(state)
        chronicle.vowedOath = forced.oathType
        chronicle.vowedByVisionId = forced.visionId
    },
    applies: (state) => forcedVowOf(state) === undefined,
    choosers: theWinner
}

/** R-8.2 — an Exile winner flips the Citizen boards, then may offer any other Exile. */
const CITIZENSHIP: ChronicleChoice = {
    step: ChronicleStep.Citizenship,
    kind: 'choice',
    reach(state) {
        if (isExileWinner(state)) flipCitizenBoards(state)
    },
    applies: (state) => isExileWinner(state) && citizenshipEligible(state).length > 0,
    // R-8.2-H1 — the winner offers, then every offered Exile answers, in any order.
    choosers: (state) =>
        state.chronicle?.citizenship?.offers ? unansweredOffers(state) : theWinner(state)
}

/** R-8.3.1 — the Chancellor or a Citizen may build or repair one edifice. */
const BUILD_OR_REPAIR: ChronicleChoice = {
    step: ChronicleStep.BuildOrRepair,
    kind: 'choice',
    applies: (state) => isImperialWinner(state) && edificeChoices(state).length > 0,
    choosers: theWinner
}

/** R-8.4 — the winner chooses only among tied suits. */
const SUIT: ChronicleChoice = {
    step: ChronicleStep.Suit,
    kind: 'choice',
    reach(state) {
        const leaders = chronicleSuitLeaders(state)
        if (leaders.length === 1) chronicleOf(state).suit = leaders[0]
    },
    applies: (state) => chronicleSuitLeaders(state).length > 1,
    choosers: theWinner
}

/** R-8.4.a-H1 — only once the tie for the largest Dispossessed stack is published. */
const HEAL_STACK: ChronicleChoice = {
    step: ChronicleStep.HealStack,
    kind: 'choice',
    applies: (state) => state.chronicle?.healTie !== undefined,
    choosers: theWinner
}

/** The winner writes the story of the game, or skips it. */
const STORY: ChronicleChoice = {
    step: ChronicleStep.Story,
    kind: 'choice',
    applies: () => true,
    choosers: theWinner
}

/** R-8.1 to R-8.8 and the winner's entry, in the Law's order. */
export const CHRONICLE_STEPS: readonly ChronicleStepRule[] = [
    VOW,
    CITIZENSHIP,
    BUILD_OR_REPAIR,
    systemStepToCome(ChronicleStep.Map),
    SUIT,
    systemStepToCome(ChronicleStep.AddSix),
    HEAL_STACK,
    systemStepToCome(ChronicleStep.Dispossess),
    systemStepToCome(ChronicleStep.Relics),
    systemStepToCome(ChronicleStep.Save),
    systemStepToCome(ChronicleStep.Rebuild),
    STORY
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
    return writeChronicleFrom(state, 0)
}

/** R-8 — the step being written is done: write on from the next one. */
export function completeChronicleStep(state: HydratedOathGameState): MachineState {
    const step = state.chronicle?.step
    assertExists(step, 'R-8 — the chronicle is being written')
    return writeChronicleFrom(state, CHRONICLE_STEPS.findIndex((rule) => rule.step === step) + 1)
}

/**
 * R-8 — from step `from`, run each system step and settle what the rules decide alone, until a
 * choice waits; once the last step is done, write the record's entry and go to the result.
 */
function writeChronicleFrom(state: HydratedOathGameState, from: number): MachineState {
    const chronicle = chronicleOf(state)
    for (const rule of CHRONICLE_STEPS.slice(from)) {
        chronicle.step = rule.step
        if (rule.kind === 'system') {
            if (rule.applies(state)) rule.run(state)
            continue
        }
        rule.reach?.(state)
        if (rule.applies(state)) return MachineState.Chronicle
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
    const chronicle = chronicleOf(state)
    const ending = chronicle.ending
    const table = state.table
    assertExists(table, 'A game from the chronicle revision starts with its table record')
    const earlier = state.chronicleRecord ?? []
    // R-8.2 — the Exiles who accepted, by name and the colour they played.
    const citizens = (chronicle.citizenship?.offers ?? [])
        .filter((offer) => offer.accepted === true)
        .map((offer) => seatOf(state, offer.playerId))
    // The story is kept once, in the entry.
    const story = chronicle.story
    delete chronicle.story
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
            winner: seatOf(state, ending.winnerPlayerId),
            ...(chronicle.vowedOath !== undefined ? { nextOath: chronicle.vowedOath } : {}),
            ...(citizens.length > 0 ? { citizens } : {}),
            ...(chronicle.built ? { built: { ...chronicle.built } } : {}),
            ...(story !== undefined ? { story } : {})
        }
    ]
}

/** A name and this game's colour: player ids change between games. */
function seatOf(state: HydratedOathGameState, playerId: string): ChronicleSeat {
    return { name: seatNameOf(state, playerId), color: state.getPlayerState(playerId).color }
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
