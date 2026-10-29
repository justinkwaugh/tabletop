import { assert, assertExists, type Game, type GameAction } from '@tabletop/common'
import type { HydratedOathGameState } from '../model/gameState.js'
import { PlayerStatus } from '../model/oathEnums.js'
import {
    ChronicleStep,
    type ChronicleSeat,
    type ChronicleWaysMet,
    type TableRecord
} from '../model/chronicle.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
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
    forcedVowOf,
    isExileWinner,
    isImperialWinner,
    seatNameOf,
    unansweredOffers
} from './chronicleChoices.js'

/** The System Actions that settle what the rules decide alone at a step (DESIGN.md). */
export type ChronicleSystemActionType =
    | ActionType.ChronicleStart
    | ActionType.ChronicleForcedVow
    | ActionType.ChronicleFlipCitizens
    | ActionType.ChronicleMap
    | ActionType.ChronicleSettleSuit
    | ActionType.ChronicleAddCards
    | ActionType.ChronicleHeal
    | ActionType.ChronicleDispossess
    | ActionType.ChronicleRelics
    | ActionType.ChronicleRebuild

/** What the step being written waits on: a System Action, or the players a choice names. */
export type ChronicleWait =
    { kind: 'system'; type: ChronicleSystemActionType } | { kind: 'choice'; choosers: string[] }

/**
 * One of R-8's steps. `waiting` is read on reaching the step, and again after an action that
 * leaves it open; undefined means the step is done, or has nothing to settle or decide.
 */
export interface ChronicleStepRule {
    readonly step: ChronicleStep
    waiting(state: HydratedOathGameState): ChronicleWait | undefined
}

const system = (type: ChronicleSystemActionType): ChronicleWait => ({ kind: 'system', type })
const choice = (choosers: string[]): ChronicleWait => ({ kind: 'choice', choosers })

/** Law 8 — "the winner performs these steps in order". */
const theWinner = (state: HydratedOathGameState) => choice([chronicleWinnerOf(state)])

/** R-8.1 to R-8.8 and the winner's entry, in the Law's order. */
export const CHRONICLE_STEPS: readonly ChronicleStepRule[] = [
    {
        // R-8.1 — a win with a Vision alone has its Oath already; any other win chooses.
        step: ChronicleStep.Vow,
        waiting: (state) => {
            if (chronicleOf(state).vowedOath !== undefined) return undefined
            return forcedVowOf(state) ? system(ActionType.ChronicleForcedVow) : theWinner(state)
        }
    },
    {
        // R-8.2 — an Exile winner flips the Citizen boards, then may offer any other Exile; every
        // offered Exile answers, in any order (R-8.2-H1).
        step: ChronicleStep.Citizenship,
        waiting: (state) => {
            if (!isExileWinner(state)) return undefined
            const citizenship = chronicleOf(state).citizenship
            if (!citizenship) return system(ActionType.ChronicleFlipCitizens)
            if (!citizenship.offers) {
                return citizenshipEligible(state).length > 0 ? theWinner(state) : undefined
            }
            const open = unansweredOffers(state)
            return open.length > 0 ? choice(open) : undefined
        }
    },
    {
        // R-8.3.1 — the Chancellor or a Citizen may build or repair one edifice.
        step: ChronicleStep.BuildOrRepair,
        waiting: (state) =>
            isImperialWinner(state) && edificeChoices(state).length > 0
                ? theWinner(state)
                : undefined
    },
    // R-8.3.2 to R-8.3.5
    { step: ChronicleStep.Map, waiting: () => system(ActionType.ChronicleMap) },
    {
        // R-8.4 — the winner chooses only among tied suits.
        step: ChronicleStep.Suit,
        waiting: (state) => {
            if (chronicleOf(state).suit !== undefined) return undefined
            return chronicleSuitLeaders(state).length === 1
                ? system(ActionType.ChronicleSettleSuit)
                : theWinner(state)
        }
    },
    // R-8.4, R-8.4.a — a tie for the largest stack shows the stacks' sizes.
    { step: ChronicleStep.AddSix, waiting: () => system(ActionType.ChronicleAddCards) },
    {
        // R-8.4.a-H1 — only once the tie for the largest Dispossessed stack is published; the
        // cards are drawn from the stack the winner chose.
        step: ChronicleStep.HealStack,
        waiting: (state) => {
            const chronicle = chronicleOf(state)
            if (!chronicle.healTie) return undefined
            if (chronicle.healSuit === undefined) return theWinner(state)
            return chronicle.added === undefined ? system(ActionType.ChronicleHeal) : undefined
        }
    },
    // R-8.5
    { step: ChronicleStep.Dispossess, waiting: () => system(ActionType.ChronicleDispossess) },
    // R-8.6
    { step: ChronicleStep.Relics, waiting: () => system(ActionType.ChronicleRelics) },
    // R-8.7, R-8.8
    { step: ChronicleStep.Rebuild, waiting: () => system(ActionType.ChronicleRebuild) },
    // The winner writes the story of the game, or skips it.
    { step: ChronicleStep.Story, waiting: theWinner }
]

/** The actions after which their step may still wait: the flip, the offers, the answers, the stack chosen. */
const LEAVES_ITS_STEP_OPEN: ReadonlySet<string> = new Set([
    ActionType.ChronicleFlipCitizens,
    ActionType.OfferChronicleCitizenship,
    ActionType.AnswerChronicleCitizenship,
    ActionType.ChooseHealStack
])

/** R-3 — the one winner, and from the chronicle revision the ending R-8 reads. */
export function recordWin(state: HydratedOathGameState, outcome: GameOutcome): void {
    state.winningPlayerIds = [outcome.winnerPlayerId]
    if (!isAtLeastOathRevision(state, OathRevision.Chronicle)) return
    state.chronicle = {
        ending: {
            winnerPlayerId: outcome.winnerPlayerId,
            rule: outcome.rule,
            waysMet: waysMetBy(state, outcome.winnerPlayerId)
        }
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

/**
 * R-3, R-8 — where the action that won goes: the result, or from its revision the chronicle, whose
 * steps the Chronicle phase runs as System Actions of their own.
 */
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
    return MachineState.Chronicle
}

/** What the chronicle waits on now: its start, the step's System Action, or the step's choosers. */
export function chronicleWaiting(state: HydratedOathGameState): ChronicleWait {
    const step = chronicleOf(state).step
    if (step === undefined) return system(ActionType.ChronicleStart)
    const wait = ruleOf(step).waiting(state)
    assertExists(wait, `R-8 — the chronicle rests only on a step that waits, not on ${step}`)
    return wait
}

/** The players the step being written waits on; none while a System Action settles it. */
export function chroniclersOf(state: HydratedOathGameState): string[] {
    const wait = chronicleWaiting(state)
    return wait.kind === 'choice' ? wait.choosers : []
}

/**
 * R-8 — after `action`: write on from its step, or from the first once the chronicle starts, to
 * the next step that waits; once the last is done, write the record's entry and go to the result.
 */
export function chronicleAfter(state: HydratedOathGameState, action: GameAction): MachineState {
    const step = chronicleOf(state).step
    if (step === undefined) {
        assert(action.type === ActionType.ChronicleStart, 'R-8 — the chronicle starts first')
        return writeChronicleFrom(state, 0)
    }
    const at = CHRONICLE_STEPS.indexOf(ruleOf(step))
    return writeChronicleFrom(state, LEAVES_ITS_STEP_OPEN.has(action.type) ? at : at + 1)
}

function ruleOf(step: ChronicleStep): ChronicleStepRule {
    const rule = CHRONICLE_STEPS.find((candidate) => candidate.step === step)
    assertExists(rule, `R-8 — ${step} is one of the chronicle's steps`)
    return rule
}

function writeChronicleFrom(state: HydratedOathGameState, from: number): MachineState {
    const chronicle = chronicleOf(state)
    for (const rule of CHRONICLE_STEPS.slice(from)) {
        chronicle.step = rule.step
        if (rule.waiting(state)) return MachineState.Chronicle
    }
    delete chronicle.step
    appendChronicleEntry(state)
    return MachineState.EndOfGame
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
    // R-8.3.3 — the edifices flipped to their ruined side.
    const ruined = chronicle.ruined ?? []
    const story = chronicle.story
    state.chronicleRecord = [
        ...earlier,
        {
            gameNumber: earlier.length + 1,
            sessionName: table.name,
            date: table.date,
            startingOath: state.oathType,
            rule: ending.rule,
            winner: seatOf(state, ending.winnerPlayerId),
            ...(chronicle.vowedOath !== undefined ? { nextOath: chronicle.vowedOath } : {}),
            ...(chronicle.added ? { added: structuredClone(chronicle.added) } : {}),
            ...(citizens.length > 0 ? { citizens } : {}),
            ...(chronicle.built ? { built: { ...chronicle.built } } : {}),
            ...(ruined.length > 0 ? { ruined } : {}),
            ...(story !== undefined ? { story } : {})
        }
    ]
    // The steps' results are the entry's now; a later game reads only the ending, the Oath vowed
    // and the rebuild.
    for (const done of STEP_RESULTS) delete chronicle[done]
}

const STEP_RESULTS = [
    'citizenship',
    'built',
    'returnedDenizenId',
    'ruined',
    'suit',
    'healTie',
    'healSuit',
    'added',
    'dispossessed',
    'story'
] as const

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
