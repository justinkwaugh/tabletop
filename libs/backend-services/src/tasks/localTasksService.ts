import { BaseTaskService } from './baseTaskService.js'
import { CreatePushTaskOptions } from './taskService.js'

export class LocalTaskService extends BaseTaskService {
    constructor(private readonly host: string) {
        super()
    }

    async createPushTask<T>(options: CreatePushTaskOptions<T>) {
        const url = `${this.host}/tasks${options.path}`
        const body = JSON.stringify(options.payload)

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body
        })

        if (!response.ok) {
            throw new Error(
                `Failed to create task for path ${options.path} in queue ${options.queue}, got response code: ${response.status}`
            )
        }
        console.log(`Ran task for path ${options.path} in queue ${options.queue}`)
    }
}
