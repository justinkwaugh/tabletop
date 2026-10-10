import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { Plugin } from 'vite'
import { HARNESS_SCENARIO_ENDPOINT } from '../harness/harnessScenarioEndpoint.js'

const RECORDING_ID = /^[a-z0-9][a-z0-9-]*$/

// Lets the dev harness list and save scenario recordings in the title's own folder. It exists only
// while the dev server runs, and the folder ignores itself, so recordings stay local.
export function harnessScenarioFiles({
    dir = 'src/lib/dev/recordings'
}: { dir?: string } = {}): Plugin {
    return {
        name: 'tabletop-harness-scenario-files',
        apply: 'serve',
        configureServer(server) {
            const target = resolve(server.config.root, dir)
            server.middlewares.use(HARNESS_SCENARIO_ENDPOINT, (request, response) => {
                if (request.method === 'GET') {
                    listScenarioRecordings(target)
                        .then((recordings) => respond(response, 200, recordings))
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
                    saveScenarioRecording(target, Buffer.concat(chunks).toString('utf8'))
                        .then((file) => respond(response, 200, { file }))
                        .catch((error: unknown) => respond(response, 400, failure(error)))
                })
            })
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
    const id =
        typeof recording === 'object' && recording !== null && 'id' in recording
            ? recording.id
            : undefined
    if (typeof id !== 'string' || !RECORDING_ID.test(id)) {
        throw new Error('A scenario recording needs an id of lowercase letters, digits and dashes')
    }
    await mkdir(dir, { recursive: true })
    const ignore = join(dir, '.gitignore')
    await access(ignore).catch(() => writeFile(ignore, '*\n'))
    const file = join(dir, `${id}.json`)
    await writeFile(file, `${JSON.stringify(recording, null, 4)}\n`)
    return file
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
