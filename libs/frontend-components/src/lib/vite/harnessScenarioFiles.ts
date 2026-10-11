import { access, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { Connect, Plugin } from 'vite'
import { HARNESS_SCENARIO_ENDPOINT } from '../harness/harnessScenarioEndpoint.js'

const RECORDING_ID = /^[a-z0-9][a-z0-9-]*$/

// Lets the dev harness list, save and delete scenario recordings in the title's own folder. It
// exists only while the dev server runs, and the folder ignores itself, so recordings stay local.
export function harnessScenarioFiles({
    dir = 'src/lib/dev/recordings'
}: { dir?: string } = {}): Plugin {
    return {
        name: 'tabletop-harness-scenario-files',
        apply: 'serve',
        // The harness fetches recordings itself, so the dev server has no reason to watch them;
        // watching would reload the page every time one is saved or deleted.
        config(userConfig) {
            const root = resolve(userConfig.root ?? process.cwd())
            return { server: { watch: { ignored: [join(resolve(root, dir), '**')] } } }
        },
        configureServer(server) {
            server.middlewares.use(
                HARNESS_SCENARIO_ENDPOINT,
                recordingsRoute(resolve(server.config.root, dir))
            )
        }
    }
}

// Each recording file's parsed contents by file name; a file that is not JSON is listed by its
// parse error, so the harness reports it rather than dropping it silently.
export async function listScenarioRecordings(dir: string): Promise<Record<string, unknown>> {
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

export async function saveScenarioRecording(dir: string, body: string): Promise<string> {
    const recording: unknown = JSON.parse(body)
    const id = checkedId(
        typeof recording === 'object' && recording !== null && 'id' in recording
            ? recording.id
            : undefined
    )
    await mkdir(dir, { recursive: true })
    const ignore = join(dir, '.gitignore')
    await access(ignore).catch(() => writeFile(ignore, '*\n'))
    const file = join(dir, `${id}.json`)
    await writeFile(file, `${JSON.stringify(recording, null, 4)}\n`)
    return file
}

// Deletes the recording for id; an id that names no file is already gone, so it succeeds.
export async function deleteScenarioRecording(dir: string, id: unknown): Promise<string> {
    const file = join(dir, `${checkedId(id)}.json`)
    await rm(file, { force: true })
    return file
}

function checkedId(id: unknown): string {
    if (typeof id !== 'string' || !RECORDING_ID.test(id)) {
        throw new Error('A scenario recording needs an id of lowercase letters, digits and dashes')
    }
    return id
}

function recordingsRoute(dir: string): Connect.NextHandleFunction {
    return (request, response) => {
        if (request.method === 'GET') {
            listScenarioRecordings(dir)
                .then((recordings) => respond(response, 200, recordings))
                .catch((error: unknown) => respond(response, 500, failure(error)))
            return
        }
        if (request.method === 'DELETE') {
            const id = new URL(request.url ?? '/', 'http://localhost').searchParams.get('id')
            deleteScenarioRecording(dir, id)
                .then((file) => respond(response, 200, { file }))
                .catch((error: unknown) => respond(response, 400, failure(error)))
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
            saveScenarioRecording(dir, Buffer.concat(chunks).toString('utf8'))
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
