import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { Connect, Plugin } from 'vite'
import {
    HARNESS_SCENARIO_ENDPOINT,
    HARNESS_SCENARIO_REQUEST_ENDPOINT
} from '../harness/harnessScenarioEndpoint.js'

const FILE_ID = /^[a-z0-9][a-z0-9-]*$/

// Lets the dev harness list and save scenario recordings, and requests for new ones, in the
// title's own folder. It exists only while the dev server runs, and the folder ignores itself, so
// everything in it stays local.
export function harnessScenarioFiles({
    dir = 'src/lib/dev/recordings'
}: { dir?: string } = {}): Plugin {
    return {
        name: 'tabletop-harness-scenario-files',
        apply: 'serve',
        configureServer(server) {
            const recordings = resolve(server.config.root, dir)
            server.middlewares.use(
                HARNESS_SCENARIO_ENDPOINT,
                jsonFolder((body) => saveScenarioRecording(recordings, body), recordings)
            )
            server.middlewares.use(
                HARNESS_SCENARIO_REQUEST_ENDPOINT,
                jsonFolder(
                    (body) => saveScenarioRequest(recordings, body),
                    scenarioRequestFolder(recordings)
                )
            )
        }
    }
}

export function scenarioRequestFolder(recordings: string) {
    return join(recordings, 'requests')
}

// Each JSON file's parsed contents by file name; a file that is not JSON is listed by its parse
// error, so the harness reports it rather than dropping it silently.
export async function listJsonFiles(dir: string): Promise<Record<string, unknown>> {
    const names = await readdir(dir).catch(() => [])
    const files = names.filter((name) => name.endsWith('.json')).toSorted()
    const entries = await Promise.all(
        files.map(async (name) => {
            const text = await readFile(join(dir, name), 'utf8')
            try {
                return [name, JSON.parse(text)] as const
            } catch (error) {
                return [name, failure(error)] as const
            }
        })
    )
    return Object.fromEntries(entries)
}

export function saveScenarioRecording(recordings: string, body: string): Promise<string> {
    return saveJsonFile(recordings, recordings, body, 'A scenario recording')
}

export function saveScenarioRequest(recordings: string, body: string): Promise<string> {
    return saveJsonFile(scenarioRequestFolder(recordings), recordings, body, 'A scenario request')
}

async function saveJsonFile(
    dir: string,
    recordings: string,
    body: string,
    noun: string
): Promise<string> {
    const content: unknown = JSON.parse(body)
    const id =
        typeof content === 'object' && content !== null && 'id' in content ? content.id : undefined
    if (typeof id !== 'string' || !FILE_ID.test(id)) {
        throw new Error(`${noun} needs an id of lowercase letters, digits and dashes`)
    }
    await mkdir(dir, { recursive: true })
    const ignore = join(recordings, '.gitignore')
    await access(ignore).catch(() => writeFile(ignore, '*\n'))
    const file = join(dir, `${id}.json`)
    await writeFile(file, `${JSON.stringify(content, null, 4)}\n`)
    return file
}

function jsonFolder(
    save: (body: string) => Promise<string>,
    dir: string
): Connect.NextHandleFunction {
    return (request, response) => {
        if (request.method === 'GET') {
            listJsonFiles(dir)
                .then((files) => respond(response, 200, files))
                .catch((error: unknown) => respond(response, 500, failure(error)))
            return
        }
        if (request.method !== 'POST') {
            response.statusCode = 405
            response.end()
            return
        }
        const chunks: Buffer[] = []
        request.on('data', (chunk: Buffer) => chunks.push(chunk))
        request.on('end', () => {
            save(Buffer.concat(chunks).toString('utf8'))
                .then((file) => respond(response, 200, { file }))
                .catch((error: unknown) => respond(response, 400, failure(error)))
        })
    }
}

function respond(
    response: {
        statusCode: number
        setHeader(name: string, value: string): unknown
        end(body: string): unknown
    },
    status: number,
    body: unknown
) {
    response.statusCode = status
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify(body))
}

function failure(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) }
}
