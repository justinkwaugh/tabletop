import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { beforeAll, describe, expect, it } from 'vitest'
import {
    ActionSource,
    assertExists,
    latestPlayerUndoTarget,
    replaceSupersededAction,
    unnamedDuplicateReason,
    type GameAction,
    type GameEngine,
    type Game
} from '@tabletop/common'
import { Autorouter } from '@tabletop/18xx-autorouter'
import {
    declaredRunInstructionFor,
    getCompany,
    trainRoutesOf,
    type EighteenXXState,
    type InstructedRun,
    type SolvedRun,
    type InstructedRunAttachment,
    type RunInstruction,
    type IgnorableRunInstructionStop
} from '@tabletop/18xx'
import { exampleGame } from '@tabletop/18xx/scenarios'
import { Shikoku1889RouteRules } from './index.js'
import { Shikoku1889Scenarios } from './scenarios/index.js'

let router: Autorouter
beforeAll(async () => {
    const bytes = await readFile(
        createRequire(import.meta.url).resolve('@tabletop/18xx-autorouter/solver.wasm')
    )
    router = await Autorouter.create(new Uint8Array(bytes).buffer)
})

type Position = { game: Game; engine: GameEngine<EighteenXXState>; state: EighteenXXState }

function solvedRun(state: EighteenXXState, companyId: string, key = 'solved'): SolvedRun {
    const solved = router.solve(
        { ...state, routeStep: { companyId } },
        Shikoku1889RouteRules,
        companyId
    )
    expect(solved.exhaustive).toBe(true)
    return { routes: trainRoutesOf(solved.result), key }
}

function userAction(
    game: Game,
    type: string,
    playerId: string,
    fields: Record<string, unknown> = {}
): GameAction {
    return {
        id: `${type}-${playerId}-${Math.random()}`,
        gameId: game.id,
        source: ActionSource.User,
        type,
        playerId,
        ...fields
    }
}

function declare(
    game: Game,
    playerId: string,
    companyId: string,
    run: SolvedRun,
    ignoredStops: IgnorableRunInstructionStop[] = []
): GameAction {
    const instruction: RunInstruction = {
        payout: 'pay',
        run,
        ...(ignoredStops.length ? { ignoredStops } : {})
    }
    return userAction(game, 'SetRunInstruction', playerId, {
        ...declaration,
        companyId,
        instruction
    })
}

const declaration = {
    outOfTurn: true,
    supersedable: true,
    supersessionScope: 'companyId'
} as const

function summarize(actions: readonly GameAction[]): string[] {
    return actions.map((action) => `${action.source}:${action.type}`)
}

function execute(position: Position, state: EighteenXXState, action: GameAction) {
    return position.engine.executeCanonicalAction({ game: position.game, state, action })
}

/** Blair operates IR by hand to the end of its turn, the last action carrying any attachments. */
function finishIrTurn(
    position: Position,
    state: EighteenXXState,
    attachments?: InstructedRunAttachment[]
) {
    const { game } = position
    let current = execute(
        position,
        state,
        userAction(game, 'FinishTrack', 'blair', { companyId: 'IR' })
    )
    const placing = current.updatedState.machineState === 'PlacingStation'
    if (placing)
        current = execute(
            position,
            current.updatedState,
            userAction(game, 'FinishStations', 'blair', { companyId: 'IR' })
        )
    current = execute(
        position,
        current.updatedState,
        userAction(game, 'RunTrains', 'blair', {
            companyId: 'IR',
            routes: solvedRun(current.updatedState, 'IR').routes
        })
    )
    current = execute(
        position,
        current.updatedState,
        userAction(game, 'DistributeEarnings', 'blair', { companyId: 'IR', choice: 'pay' })
    )
    return execute(
        position,
        current.updatedState,
        userAction(game, 'FinishOperatingTurn', 'blair', {
            companyId: 'IR',
            ...(attachments ? { instructedRuns: attachments } : {})
        })
    )
}

describe('Run instructions', () => {
    it('lets a president declare out of turn, then operates the company by itself', () => {
        const position = exampleGame(Shikoku1889Scenarios, 'operations')
        const { game, state } = position
        expect(state.activePlayerIds).toEqual(['blair'])
        const run = solvedRun(state, 'AR')
        const declared = execute(position, state, declare(game, 'alex', 'AR', run))
        expect(summarize(declared.processedActions)).toEqual(['user:SetRunInstruction'])
        expect(declaredRunInstructionFor(declared.updatedState, 'AR')).toMatchObject({
            playerId: 'alex',
            payout: 'pay',
            declaredRevenue: 40,
            declaredTrainIds: ['shikoku-1889/2/3'],
            runs: [run]
        })

        const finished = finishIrTurn(position, declared.updatedState)
        const automatic = finished.processedActions.filter(
            (action) =>
                action.source === ActionSource.System &&
                'companyId' in action &&
                action.companyId === 'AR'
        )
        expect(summarize(automatic).slice(0, 6)).toEqual([
            'system:StartOperatingTurn',
            'system:FinishTrack',
            'system:FinishStations',
            'system:RunTrains',
            'system:DistributeEarnings',
            'system:FinishOperatingTurn'
        ])
        expect(automatic.slice(1).every((action) => action.playerId === 'alex')).toBe(true)
        expect(getCompany(finished.updatedState, 'AR').lastRunRevenue).toBe(40)
        expect(declaredRunInstructionFor(finished.updatedState, 'AR')?.runs).toEqual([run])

        let undone = finished.updatedState
        for (const action of finished.processedActions.toReversed())
            undone = position.engine.undoProcessedAction({ state: undone, action })
        expect(undone.runInstructions).toEqual(declared.updatedState.runInstructions)
    })

    it('rejects a declaration by anyone but the president, or with an illegal run', () => {
        const position = exampleGame(Shikoku1889Scenarios, 'operations')
        const { game, state } = position
        expect(() =>
            execute(position, state, declare(game, 'blair', 'AR', solvedRun(state, 'AR')))
        ).toThrow()
        expect(() =>
            execute(position, state, declare(game, 'alex', 'AR', solvedRun(state, 'IR')))
        ).toThrow()
    })

    it('stores runs attached to any action and applies them on the company’s turn', () => {
        const position = exampleGame(Shikoku1889Scenarios, 'operations')
        const { game, state } = position
        const declared = execute(
            position,
            state,
            declare(game, 'alex', 'AR', solvedRun(state, 'AR'))
        )
        const refreshed = solvedRun(state, 'AR', 'refreshed')
        const tracked = execute(
            position,
            declared.updatedState,
            userAction(game, 'FinishTrack', 'blair', {
                companyId: 'IR',
                instructedRuns: [{ companyId: 'AR', runs: [refreshed] }]
            })
        )
        expect(declaredRunInstructionFor(tracked.updatedState, 'AR')?.runs).toEqual([refreshed])
        expect(() =>
            execute(
                position,
                declared.updatedState,
                userAction(game, 'FinishTrack', 'blair', {
                    companyId: 'IR',
                    instructedRuns: [{ companyId: 'IR', runs: [refreshed] }]
                })
            )
        ).toThrow()
    })

    it('stops when the run earns less than declared, and resumes when told to ignore it', () => {
        const position = exampleGame(Shikoku1889Scenarios, 'operations')
        const { game, state } = position
        const declared = execute(
            position,
            state,
            declare(game, 'alex', 'AR', solvedRun(state, 'AR'))
        )
        const lower: InstructedRun = { routes: [], key: 'lower' }
        const finished = finishIrTurn(position, declared.updatedState, [
            { companyId: 'AR', runs: [lower] }
        ])
        expect(summarize(finished.processedActions).at(-1)).toBe('system:StopRunInstruction')
        expect(finished.updatedState.machineState).toBe('LayingTrack')
        expect(finished.updatedState.activePlayerIds).toEqual(['alex'])
        expect(declaredRunInstructionFor(finished.updatedState, 'AR')?.stopReason).toBe(
            'run-lowered'
        )

        const resumed = execute(
            position,
            finished.updatedState,
            userAction(game, 'SetRunInstructionStops', 'alex', {
                ...declaration,
                companyId: 'AR',
                ignoredStops: ['run-lowered']
            })
        )
        expect(summarize(resumed.processedActions).slice(0, 4)).toEqual([
            'user:SetRunInstructionStops',
            'system:FinishTrack',
            'system:FinishStations',
            'system:RunTrains'
        ])
        expect(getCompany(resumed.updatedState, 'AR').lastRunRevenue).toBe(0)
    })

    it('reports a lost train separately from a worse map', () => {
        const position = exampleGame(Shikoku1889Scenarios, 'operations')
        const { game, state } = position
        const declared = execute(
            position,
            state,
            declare(game, 'alex', 'AR', solvedRun(state, 'AR'))
        )
        const withoutTrain = structuredClone(declared.updatedState)
        withoutTrain.trainInventory.trains = withoutTrain.trainInventory.trains.map((train) =>
            train.id === 'shikoku-1889/2/3'
                ? { id: train.id, definitionId: train.definitionId, status: 'market' }
                : train
        )
        const finished = finishIrTurn(position, withoutTrain, [
            { companyId: 'AR', runs: [{ routes: [], key: 'no-train' }] }
        ])
        expect(declaredRunInstructionFor(finished.updatedState, 'AR')?.stopReason).toBe(
            'train-lost'
        )
    })

    it('stops for a lost train even when the run earns as much', () => {
        const position = exampleGame(Shikoku1889Scenarios, 'operations')
        const { game } = position
        // The run uses AR's own train; a spare it also owns plays no part in it.
        const run = solvedRun(position.state, 'AR')
        const state = structuredClone(position.state)
        const spare = state.trainInventory.trains.find((train) => train.status === 'depot')
        assertExists(spare)
        const owned = state.trainInventory.trains.find(
            (train) =>
                train.status === 'owned' &&
                train.owner.kind === 'company' &&
                train.owner.companyId === 'AR'
        )
        assertExists(owned)
        state.trainInventory.trains = state.trainInventory.trains.map((train) =>
            train.id === spare.id
                ? { ...owned, id: spare.id, definitionId: spare.definitionId }
                : train
        )
        const declared = execute(position, state, declare(game, 'alex', 'AR', run))
        const withoutSpare = structuredClone(declared.updatedState)
        withoutSpare.trainInventory.trains = withoutSpare.trainInventory.trains.map((train) =>
            train.id === spare.id
                ? { id: train.id, definitionId: train.definitionId, status: 'market' }
                : train
        )
        const finished = finishIrTurn(position, withoutSpare, [{ companyId: 'AR', runs: [run] }])
        expect(declaredRunInstructionFor(finished.updatedState, 'AR')?.stopReason).toBe(
            'train-lost'
        )
    })

    it('runs on after ignored train loss and lower run, then stops when the company must buy one', () => {
        const position = exampleGame(Shikoku1889Scenarios, 'operations')
        const { game, state } = position
        const declared = execute(
            position,
            state,
            declare(game, 'alex', 'AR', solvedRun(state, 'AR'), ['train-lost', 'run-lowered'])
        )
        const withoutTrain = structuredClone(declared.updatedState)
        withoutTrain.trainInventory.trains = withoutTrain.trainInventory.trains.map((train) =>
            train.id === 'shikoku-1889/2/3'
                ? { id: train.id, definitionId: train.definitionId, status: 'market' }
                : train
        )
        const finished = finishIrTurn(position, withoutTrain, [
            { companyId: 'AR', runs: [{ routes: [], key: 'no-train' }] }
        ])
        expect(finished.updatedState.machineState).toBe('BuyingTrains')
        expect(declaredRunInstructionFor(finished.updatedState, 'AR')?.stopReason).toBe(
            'must-buy-train'
        )

        const changed = execute(
            position,
            finished.updatedState,
            userAction(game, 'SetRunInstructionStops', 'alex', {
                ...declaration,
                companyId: 'AR',
                ignoredStops: ['train-lost']
            })
        )
        expect(declaredRunInstructionFor(changed.updatedState, 'AR')?.stopReason).toBe(
            'must-buy-train'
        )
    })

    it('stops when no client could prove a run', () => {
        const position = exampleGame(Shikoku1889Scenarios, 'operations')
        const { game, state } = position
        const declared = execute(
            position,
            state,
            declare(game, 'alex', 'AR', solvedRun(state, 'AR'))
        )
        const finished = finishIrTurn(position, declared.updatedState, [
            { companyId: 'AR', runs: [{ unsolved: true, key: 'unsolved' }] }
        ])
        expect(declaredRunInstructionFor(finished.updatedState, 'AR')?.stopReason).toBe(
            'routes-unsolved'
        )
    })

    it('spends an attached run on each turn and keeps the last for the next action', () => {
        const position = exampleGame(Shikoku1889Scenarios, 'operations')
        const { game, state } = position
        const arRun = solvedRun(state, 'AR', 'first')
        let current = execute(position, state, declare(game, 'alex', 'AR', arRun)).updatedState
        current = finishIrTurn(position, current).updatedState
        expect(current.operatingSet?.roundNumber).toBe(2)
        expect(current.activePlayerIds).toEqual(['blair'])
        const second = { ...arRun, key: 'second' }
        const third = { ...arRun, key: 'third' }
        const both = execute(position, current, {
            ...declare(game, 'blair', 'IR', solvedRun(current, 'IR')),
            instructedRuns: [{ companyId: 'AR', runs: [second, third] }]
        })
        const runs = both.processedActions.filter((action) => action.type === 'RunTrains')
        expect(runs.map((action) => action.playerId)).toEqual(['blair', 'alex'])
        expect(declaredRunInstructionFor(both.updatedState, 'AR')?.runs).toEqual([third])
        expect(both.updatedState.machineState).toBe('StockRound')
    })

    it('removes the instruction when its player no longer presides', () => {
        const position = exampleGame(Shikoku1889Scenarios, 'operations')
        const { game, state } = position
        const declared = execute(
            position,
            state,
            declare(game, 'alex', 'AR', solvedRun(state, 'AR'))
        )
        const sold = structuredClone(declared.updatedState)
        const company = getCompany(sold, 'AR')
        company.president = { kind: 'player', playerId: 'casey' }
        for (const certificate of sold.certificates)
            if (
                certificate.companyId === 'AR' &&
                certificate.owner.kind === 'player' &&
                certificate.owner.playerId === 'alex'
            )
                certificate.owner = { kind: 'player', playerId: 'casey' }
        const finished = finishIrTurn(position, sold)
        expect(summarize(finished.processedActions).at(-1)).toBe('system:StopRunInstruction')
        expect(finished.updatedState.runInstructions).toBeUndefined()
        expect(finished.updatedState.activePlayerIds).toEqual(['casey'])
    })

    it('lets the president undo a declaration that ran the turn at once', () => {
        const position = exampleGame(Shikoku1889Scenarios, 'operations')
        const { game, state } = position
        const declaration = declare(game, 'blair', 'IR', solvedRun(state, 'IR'))
        const fired = execute(position, state, declaration)
        expect(fired.processedActions.some((action) => action.type === 'RunTrains')).toBe(true)
        const recorded = fired.processedActions
        expect(latestPlayerUndoTarget(recorded, 'blair')).toBe(recorded[0])

        let undone = fired.updatedState
        for (const action of recorded.toReversed())
            undone = position.engine.undoProcessedAction({ state: undone, action })
        expect(undone).toEqual(state)
    })

    it('leaves live run instructions out of an exploration and out of its undo', () => {
        const position = exampleGame(Shikoku1889Scenarios, 'operations')
        const { game, state, engine } = position
        const declaration = declare(game, 'alex', 'AR', solvedRun(state, 'AR'))
        const declared = execute(position, state, declaration).updatedState
        const exploration = engine.runtime.exploration
        assertExists(exploration?.keepsSourceDeclaration)
        expect(exploration.createFromCanonicalState(declared).runInstructions).toBeUndefined()
        expect(exploration.keepsSourceDeclaration(declaration)).toBe(false)
    })

    it('removes a stopped instruction too once its player no longer presides', () => {
        const position = exampleGame(Shikoku1889Scenarios, 'operations')
        const { game, state } = position
        const declared = execute(
            position,
            state,
            declare(game, 'alex', 'AR', solvedRun(state, 'AR'))
        )
        const lowered = finishIrTurn(position, declared.updatedState, [
            { companyId: 'AR', runs: [{ routes: [], key: 'lower' }] }
        ])
        expect(declaredRunInstructionFor(lowered.updatedState, 'AR')?.stopReason).toBe(
            'run-lowered'
        )
        const sold = structuredClone(lowered.updatedState)
        getCompany(sold, 'AR').president = { kind: 'player', playerId: 'casey' }
        for (const certificate of sold.certificates)
            if (
                certificate.companyId === 'AR' &&
                certificate.owner.kind === 'player' &&
                certificate.owner.playerId === 'alex'
            )
                certificate.owner = { kind: 'player', playerId: 'casey' }
        sold.activePlayerIds = ['casey']
        const finished = execute(
            position,
            sold,
            userAction(game, 'FinishTrack', 'casey', { companyId: 'AR' })
        )
        expect(summarize(finished.processedActions)).toContain('system:StopRunInstruction')
        expect(finished.updatedState.runInstructions).toBeUndefined()
    })

    it('records every train the company owns, including any its run leaves idle', () => {
        const position = exampleGame(Shikoku1889Scenarios, 'operations')
        const { game, state } = position
        const run = solvedRun(state, 'IR')
        const declared = execute(
            position,
            state,
            declare(game, 'blair', 'IR', { ...run, routes: run.routes.slice(0, 1) })
        )
        expect(declaredRunInstructionFor(declared.updatedState, 'IR')?.declaredTrainIds).toEqual(
            run.routes.map((route) => route.trainId)
        )
    })

    it('lets a declaration carry runs for the company it declares', () => {
        const position = exampleGame(Shikoku1889Scenarios, 'operations')
        const { game, state } = position
        const run = solvedRun(state, 'AR')
        const later = { ...run, key: 'later' }
        const declared = execute(position, state, {
            ...declare(game, 'alex', 'AR', run),
            instructedRuns: [{ companyId: 'AR', runs: [run, later] }]
        })
        expect(declaredRunInstructionFor(declared.updatedState, 'AR')?.runs).toEqual([run, later])
    })

    it('replaces a standing declaration when toggled, so toggles do not grow history', () => {
        const position = exampleGame(Shikoku1889Scenarios, 'operations')
        const { game, state, engine } = position
        const on = execute(position, state, declare(game, 'alex', 'AR', solvedRun(state, 'AR')))
        const cancel = {
            ...userAction(game, 'SetRunInstruction', 'alex', { ...declaration, companyId: 'AR' }),
            supersedesActionId: on.processedActions[0].id
        }
        const outcome = replaceSupersededAction({
            engine,
            apiActions: engine.runtime.apiActions,
            game,
            state: on.updatedState,
            window: on.processedActions,
            replacement: cancel
        })
        expect(outcome.kind).toBe('replace')
        if (outcome.kind !== 'replace') return
        expect(outcome.state).toEqual(state)
        expect(
            unnamedDuplicateReason(engine.runtime.apiActions, on.processedActions, {
                ...cancel,
                supersedesActionId: undefined
            })
        ).toBeDefined()
    })
})
