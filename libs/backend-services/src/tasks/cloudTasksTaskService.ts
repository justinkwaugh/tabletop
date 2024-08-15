import { BaseTaskService } from './baseTaskService.js'
import { CreatePushTaskOptions } from './taskService.js'
import { CloudTasksClient, protos } from '@google-cloud/tasks'

const client = new CloudTasksClient()
const project = await client.getProjectId()
const location = 'us-central1'

export class CloudTasksTaskService extends BaseTaskService {
    constructor(private readonly host: string) {
        super()
    }

    async createPushTask<T>(options: CreatePushTaskOptions<T>) {
        const url = `${this.host}/tasks${options.path}`
        const parent = client.queuePath(project, location, options.queue)

        const httpRequest = <protos.google.cloud.tasks.v2.IHttpRequest>{
            headers: {
                'Content-Type': 'application/json'
            },
            httpMethod: 'POST',
            url
        }

        if (options.payload) {
            httpRequest.body = Buffer.from(JSON.stringify(options.payload)).toString('base64')
        }

        const task = {
            httpRequest
        } as protos.google.cloud.tasks.v2.ITask

        if (options.inSeconds) {
            task.scheduleTime = {
                seconds: options.inSeconds + Date.now() / 1000
            }
        }

        const request = <protos.google.cloud.tasks.v2.CreateTaskRequest>{
            parent: parent,
            task: task
        }
        const [response] = await client.createTask(request)
        console.log(
            `Created task ${response.name} for path ${options.path} in queue ${options.queue}`
        )
    }
}
