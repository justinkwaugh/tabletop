import { hasTurnMark, trainsOwnedBy, type Train, type TrainPurchaseState } from '@tabletop/18xx'
import { requireState1828, type HydratedState1828 } from './state.js'
import { phaseTrainLimit } from './trains.js'

type SystemState = Pick<HydratedState1828, 'systems'>

/** Whether the company is a system (§13.4). */
export function isSystem(state: object, companyId: string): boolean {
    return companyId in requireState1828(state).systems
}

/** The public companies a company stands for: a system's two, or the company itself. */
export function constituents(state: object, companyId: string): string[] {
    const system = requireState1828(state).systems[companyId]
    return system ? [companyId, system.absorbedId] : [companyId]
}

export function systemAbsorbing(state: SystemState, companyId: string): string | undefined {
    return Object.entries(state.systems).find(([, system]) => system.absorbedId === companyId)?.[0]
}

/** The company that operates for a public company: itself, or the system it merged into. */
export function operatingCompanyFor(state: SystemState, companyId: string): string {
    return systemAbsorbing(state, companyId) ?? companyId
}

export type ShellIndex = 0 | 1

/** What the director has named, for this turn, as the shell its next train goes to. */
export const TrainShellMarks = ['train-shell-first', 'train-shell-second'] as const

/** Marks that a train has come to the system from another company this turn. */
export const ShellsClosedMark = 'shells-closed'

/** Marks that the operating company bought a train from the given company this turn. */
export const trainBoughtFromMark = (companyId: string) => `train-bought-from:${companyId}`

/** Forgets the shell the director named for the next train. */
export function clearNamedTrainShell(state: HydratedState1828): void {
    state.turnMarks = state.turnMarks?.filter(
        (mark) => !TrainShellMarks.some((shellMark) => shellMark === mark)
    )
}

/** The shell a new train goes to: the one named, if it has room, else the one with fewer trains. */
function shellForNewTrain(
    state: HydratedState1828,
    [first, second]: readonly [readonly string[], readonly string[]]
): ShellIndex {
    const named = TrainShellMarks.findIndex((mark) => hasTurnMark(state, mark))
    const limit = phaseTrainLimit(state)
    if (named === 0 && first.length < limit) return 0
    if (named === 1 && second.length < limit) return 1
    return second.length < first.length ? 1 : 0
}

/** A train has left the company: its shell no longer lists it. */
export function forgetShellTrain(state: object, companyId: string, trainId: string): void {
    const system = requireState1828(state).systems[companyId]
    if (!system) return
    const [first, second] = system.shellTrainIds
    system.shellTrainIds = [
        first.filter((id) => id !== trainId),
        second.filter((id) => id !== trainId)
    ]
}

/** The shell the operating system's next train goes to (§8.3.5.1). */
export function nextTrainShell(state: HydratedState1828, companyId: string): ShellIndex {
    return shellForNewTrain(state, arrangedShellTrainIds(state, companyId))
}

/**
 * A system's train ids by shell, trains just acquired counted in the shell they go to: a shell
 * below the limit may buy, even a train that the phase change then puts it over (§15.4).
 */
export function arrangedShellTrainIds(
    state: TrainPurchaseState,
    companyId: string
): [string[], string[]] {
    const title = requireState1828(state)
    const [first, second] = title.systems[companyId].shellTrainIds
    const shells: [string[], string[]] = [[...first], [...second]]
    for (const train of unplacedShellTrains(state, companyId))
        shells[shellForNewTrain(title, shells)].push(train.id)
    return shells
}

/**
 * A company's trains by shell: a system's first and second shells, or an unmerged company's one
 * group (§13.4, §15.4).
 */
export function trainShells(state: TrainPurchaseState, companyId: string): Train[][] {
    const trains = trainsOwnedBy(state, { kind: 'company', companyId })
    if (!requireState1828(state).systems[companyId]) return [trains]
    return arrangedShellTrainIds(state, companyId).map((ids) =>
        trains.filter((train) => ids.includes(train.id))
    )
}

/** A system's trains in neither shell: just acquired, to be placed. */
export function unplacedShellTrains(state: TrainPurchaseState, companyId: string): Train[] {
    const system = requireState1828(state).systems[companyId]
    if (!system) return []
    return trainsOwnedBy(state, { kind: 'company', companyId }).filter(
        (train) => !system.shellTrainIds.some((shell) => shell.includes(train.id))
    )
}
