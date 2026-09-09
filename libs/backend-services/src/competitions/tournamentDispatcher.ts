import {
    assertExists,
    generateSeed,
    type Tournament,
    type TournamentSchedule
} from '@tabletop/common'
import type { TournamentStore } from '../persistence/stores/tournamentStore.js'
import type { TaskService } from '../tasks/taskService.js'
import { enqueueTournamentTask, type TournamentTask } from './tournamentTasks.js'
import { updateTournamentRegistration } from './tournamentRegistration.js'
import { generateTournamentSchedule } from './tournamentScheduler.js'
import { reserveTournamentTables } from './tournamentDispatch.js'

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
        if (
            !tournament ||
            tournament.paused ||
            tournament.status === 'cancelled' ||
            tournament.status === 'draft'
        )
            return
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
                            if (
                                current.paused ||
                                !['locked', 'inProgress'].includes(current.status)
                            )
                                return
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
                                delete dispatch.error
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
            if (
                !claimed ||
                tournament.paused ||
                !['locked', 'inProgress'].includes(tournament.status)
            )
                return
            for (const tableId of claimed.reserved)
                await this.provision(tournament.id, stage.id, tableId)
            const latest = await this.store.read(tournament.id)
            assertExists(latest, 'Tournament disappeared')
            await this.notify(latest)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Tournament dispatch failed'
            tournament = await this.store.update(tournament.id, undefined, false, (current) => {
                if (
                    current.paused ||
                    current.status === 'cancelled' ||
                    current.nextTaskAt === undefined
                )
                    return
                const stage = current.stages[0]
                if (stage) {
                    stage.dispatch ??= { reserved: [], active: [], finished: [] }
                    stage.dispatch.error = message.slice(0, 512)
                }
                current.revision++
                current.updatedAt = this.now()
            })
            await this.notify(tournament)
            throw error
        }
    }
}
