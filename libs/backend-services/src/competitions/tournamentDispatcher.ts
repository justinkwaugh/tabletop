import {
    assertExists,
    generateSeed,
    knockoutBracket,
    tournamentInPlay,
    type KnockoutResults,
    type Tournament,
    type TournamentSchedule
} from '@tabletop/common'
import type { TournamentStore } from '../persistence/stores/tournamentStore.js'
import type { TaskService } from '../tasks/taskService.js'
import { enqueueTournamentTask, type TournamentTask } from './tournamentTasks.js'
import { updateTournamentRegistration } from './tournamentRegistration.js'
import { generateTournamentSchedule, knockoutTables } from './tournamentScheduler.js'
import { reserveTournamentTables } from './tournamentDispatch.js'
import { TournamentEntrantUnavailableError } from '../games/tournamentGames.js'
import { TournamentResultsPendingError } from './tournamentError.js'

export class TournamentDispatcher {
    constructor(
        private readonly store: TournamentStore,
        private readonly tasks: Pick<TaskService, 'createPushTask'>,
        private readonly provision: (
            tournamentId: string,
            stageId: string,
            tableId: string
        ) => Promise<void>,
        private readonly notify: (tournament: Tournament) => Promise<void>,
        private readonly finished: (tournament: Tournament) => Promise<Tournament>,
        private readonly knockoutResults: (
            tournament: Tournament,
            schedule: TournamentSchedule
        ) => Promise<KnockoutResults>,
        private readonly now: () => number
    ) {}

    async enqueue(tournament: Tournament): Promise<void> {
        if (tournament.nextTaskAt === undefined || tournament.paused) return
        await enqueueTournamentTask(
            this.tasks,
            {
                tournamentId: tournament.id,
                ...(tournament.startId ? { startId: tournament.startId } : {})
            },
            Math.max(0, Math.ceil((tournament.nextTaskAt - this.now()) / 1000))
        )
    }

    async run(task: TournamentTask): Promise<void> {
        let tournament = await this.store.read(task.tournamentId)
        if (!tournament || tournament.status === 'cancelled' || tournament.status === 'draft')
            return
        if (tournament.status === 'finished' || tournament.paused) {
            if (tournament.status === 'finished') tournament = await this.finished(tournament)
            await this.notify(tournament)
            return
        }
        if (tournament.nextTaskAt === undefined || tournament.nextTaskAt > this.now()) return
        if (task.startId && tournament.status === 'open' && tournament.startId !== task.startId)
            return
        try {
            let schedule: TournamentSchedule
            let stage = tournament.stages[0]
            if (!stage?.scheduleId) {
                const prepared = structuredClone(tournament)
                if (prepared.status === 'open') updateTournamentRegistration(prepared, this.now())
                if (prepared.status !== 'locked') {
                    if (prepared.status === 'cancelled') {
                        tournament = await this.store.update(
                            tournament.id,
                            undefined,
                            false,
                            (current) => {
                                updateTournamentRegistration(current, this.now())
                            }
                        )
                        await this.notify(tournament)
                    }
                    return
                }
                schedule = generateTournamentSchedule(prepared, generateSeed())
                tournament = await this.store.commitSchedule(
                    schedule,
                    tournament.revision,
                    undefined,
                    this.now()
                )
                stage = tournament.stages[0]
            } else {
                schedule = await this.store.readSchedule(tournament.id, stage.id)
                if (schedule.bracket) {
                    const advanced = await this.advanceBracket(tournament, schedule)
                    if (advanced.tournament.status === 'finished') {
                        await this.notify(await this.finished(advanced.tournament))
                        return
                    }
                    ;({ tournament, schedule } = advanced)
                    stage = tournament.stages[0]
                }
                const dispatch = stage.dispatch ?? { reserved: [], active: [], finished: [] }
                if (
                    !dispatch.reserved.length ||
                    reserveTournamentTables(tournament, schedule, dispatch).length >
                        dispatch.reserved.length
                ) {
                    tournament = await this.store.update(
                        tournament.id,
                        undefined,
                        false,
                        (current) => {
                            if (current.paused || !tournamentInPlay(current.status)) return
                            const currentStage = current.stages.find(
                                (value) => value.id === schedule.stageId
                            )
                            assertExists(currentStage, 'Scheduled stage disappeared')
                            if (currentStage.scheduleId !== schedule.id) return
                            const dispatch = currentStage.dispatch ?? {
                                reserved: [],
                                active: [],
                                finished: []
                            }
                            dispatch.reserved = reserveTournamentTables(current, schedule, dispatch)
                            if (!dispatch.reserved.length) {
                                delete current.schedulingError
                                delete current.nextTaskAt
                            }
                            currentStage.dispatch = dispatch
                            current.revision++
                            current.updatedAt = this.now()
                        }
                    )
                }
            }
            const claimed = tournament.stages.find((value) => value.id === stage.id)?.dispatch
            if (!claimed || tournament.paused || !tournamentInPlay(tournament.status)) return
            let unavailableEntrant: TournamentEntrantUnavailableError | undefined
            for (const tableId of claimed.reserved) {
                try {
                    await this.provision(tournament.id, stage.id, tableId)
                } catch (error) {
                    if (!(error instanceof TournamentEntrantUnavailableError)) throw error
                    unavailableEntrant = error
                }
            }
            const latest = await this.store.read(tournament.id)
            assertExists(latest, 'Tournament disappeared')
            await this.notify(latest)
            if (unavailableEntrant) throw unavailableEntrant
        } catch (error) {
            // Not a failure to show: the retried task reads the result once it is visible.
            if (error instanceof TournamentResultsPendingError) throw error
            const message = error instanceof Error ? error.message : 'Tournament dispatch failed'
            tournament = await this.store.update(tournament.id, undefined, false, (current) => {
                if (
                    current.paused ||
                    current.status === 'cancelled' ||
                    current.nextTaskAt === undefined
                )
                    return
                current.schedulingError = message.slice(0, 512)
                current.revision++
                current.updatedAt = this.now()
            })
            await this.notify(tournament)
            throw error
        }
    }

    /**
     * Adds the Tables a Knockout's results have made due, or finishes it once the final is
     * decided. Tables are appended only to the Schedule the results were read against.
     */
    private async advanceBracket(
        tournament: Tournament,
        schedule: TournamentSchedule
    ): Promise<{ tournament: Tournament; schedule: TournamentSchedule }> {
        for (let attempt = 0; attempt < 3; attempt++) {
            const bracket = knockoutBracket(
                schedule,
                await this.knockoutResults(tournament, schedule)
            )
            if (bracket.finished) {
                const finished = await this.store.update(
                    tournament.id,
                    undefined,
                    false,
                    (current) => {
                        if (!tournamentInPlay(current.status)) return
                        current.status = 'finished'
                        current.finishedAt = this.now()
                        delete current.nextTaskAt
                        delete current.paused
                        delete current.schedulingError
                        current.revision++
                        current.updatedAt = this.now()
                    }
                )
                return { tournament: finished, schedule }
            }
            if (!bracket.due.length) return { tournament, schedule }
            const known = schedule.tables.length
            tournament = await this.store.extendSchedule(
                tournament.id,
                schedule.id,
                known,
                knockoutTables(schedule, bracket.due),
                this.now()
            )
            // Paused or ended meanwhile: nothing more to add, and nothing failed.
            if (tournament.paused || !tournamentInPlay(tournament.status))
                return { tournament, schedule }
            schedule = await this.store.readSchedule(tournament.id, schedule.stageId)
            if (schedule.tables.length > known) return { tournament, schedule }
        }
        throw new Error('The knockout schedule kept changing; dispatch will retry')
    }
}
