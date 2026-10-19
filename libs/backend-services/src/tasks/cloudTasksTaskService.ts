import { BaseTaskService } from './baseTaskService.js'
import { CreatePushTaskOptions } from './taskService.js'
import { CloudTasksClient, protos } from '@google-cloud/tasks'

const client = new CloudTasksClient()
const project = await client.getProjectId()
const location = 'us-central1'
const ALREADY_EXISTS = 6

export class CloudTasksTaskService extends BaseTaskService {
    constructor(private readonly host: string) {
        super()
    }

    async createPushTask<T>(options: CreatePushTaskOptions<T>) {
        const url = `${this.host}/tasks${options.path}`
        const parent = client.queuePath(project, location, options.queue)

        const httpRequest: protos.google.cloud.tasks.v2.IHttpRequest = {
            headers: {
                'Content-Type': 'application/json'
            },
            httpMethod: 'POST',
            url
        }

        if (options.payload) {
            httpRequest.body = Buffer.from(JSON.stringify(options.payload)).toString('base64')
        }

        const task: protos.google.cloud.tasks.v2.ITask = { httpRequest }
        if (options.uniqueName)
            task.name = client.taskPath(project, location, options.queue, options.uniqueName)

        if (options.inSeconds) {
            task.scheduleTime = {
                seconds: Math.ceil(options.inSeconds + Date.now() / 1000)
            }
        }

        const request: protos.google.cloud.tasks.v2.ICreateTaskRequest = {
            parent: parent,
            task: task
        }
        try {
            const [response] = await client.createTask(request)
            console.log(
                `Created task ${response.name} for path ${options.path} in queue ${options.queue}`
            )
        } catch (error) {
            if (!options.uniqueName || !isAlreadyExists(error)) throw error
            console.log(`Task ${options.uniqueName} already exists in queue ${options.queue}`)
        }
    }
}

function isAlreadyExists(error: unknown): boolean {
    return error instanceof Error && Reflect.get(error, 'code') === ALREADY_EXISTS
}
