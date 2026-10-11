import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { Connect, Plugin } from 'vite'
import { HARNESS_SCENARIO_ENDPOINT } from '../harness/harnessScenarioEndpoint.js'

const SCENARIO_ID = /^[a-z0-9][a-z0-9-]*$/

// Lets the dev harness save the current game as a scenario file in the title's scenarios folder,
// which a browser cannot write to itself. It exists only while the dev server runs.
export function harnessScenarioFiles({ dir = 'scenarios' }: { dir?: string } = {}): Plugin {
    let scenarios = ''
    // Vite's hooks and its file watcher spell paths differently on Windows
    const slashed = (path: string) => path.replaceAll('\\', '/')
    const isScenarioFile = (path: string) =>
        slashed(path).startsWith(`${slashed(scenarios)}/`) && path.endsWith('.json')
    return {
        name: 'tabletop-harness-scenario-files',
        apply: 'serve',
        configResolved(config) {
            scenarios = resolve(config.root, dir)
        },
        // Runs after Vite's glob handling, whose update of the dev page would close the open game,
        // or show an error for a removed file; the page lists a save itself.
        hotUpdate: {
            order: 'post',
            handler({ file }) {
                if (isScenarioFile(file)) return []
            }
        },
        configureServer(server) {
            // Vite keeps the dev page's list of scenario files from when it first compiled it, so
            // any scenario file added, changed or removed, by a save or by anyone else, marks
            // everything for recompiling, and the next page load lists the folder as it is.
            server.watcher.add(scenarios)
            server.watcher.on('all', (_event, path) => {
                if (isScenarioFile(path)) server.moduleGraph.invalidateAll()
            })
            server.middlewares.use(HARNESS_SCENARIO_ENDPOINT, saveRoute(scenarios))
        }
    }
}

// Writes { id, scenario } as dir/<id>.json, replacing a scenario with the same id.
export async function saveScenarioFile(dir: string, body: string): Promise<string> {
    const request: unknown = JSON.parse(body)
    if (typeof request !== 'object' || request === null || !('scenario' in request)) {
        throw new Error('A scenario file needs its scenario')
    }
    const id = 'id' in request ? request.id : undefined
    if (typeof id !== 'string' || !SCENARIO_ID.test(id)) {
        throw new Error('A scenario file needs an id of lowercase letters, digits and dashes')
    }
    await mkdir(dir, { recursive: true })
    const file = join(dir, `${id}.json`)
    await writeFile(file, `${JSON.stringify(request.scenario)}\n`)
    return file
}

const MAX_SCENARIO_BYTES = 20 * 1024 * 1024
const LOCAL_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

// The dev server may listen on every network address so other devices can play, but only a browser
// on this machine may write into the repository.
export function isLocalAddress(address: string | undefined): boolean {
    return address !== undefined && LOCAL_ADDRESSES.has(address)
}

// Only JSON requests: a web page can send a cross-site form post here without asking, but a JSON
// one makes the browser ask the dev server first, which by default answers only localhost pages.
export function saveRoute(dir: string): Connect.NextHandleFunction {
    return (request, response) => {
        if (request.method !== 'POST') {
            response.statusCode = 405
            response.end()
            return
        }
        if (!isLocalAddress(request.socket.remoteAddress)) {
            respond(response, 403, {
                error: 'Scenarios can be saved only from a browser on the machine running the dev server'
            })
            return
        }
        const contentType = request.headers['content-type']?.split(';')[0].trim()
        if (contentType !== 'application/json') {
            respond(response, 415, { error: 'A scenario file is saved as JSON' })
            return
        }
        // Refuses a body too large as soon as it is known to be, then reads the rest unkept, so the
        // refusal reaches the client rather than a dropped connection.
        let tooLarge = Number(request.headers['content-length']) > MAX_SCENARIO_BYTES
        if (tooLarge) refuseTooLarge(response)
        const chunks: Buffer[] = []
        let size = 0
        request.on('data', (chunk: Buffer) => {
            if (tooLarge) return
            size += chunk.length
            tooLarge = size > MAX_SCENARIO_BYTES
            if (tooLarge) refuseTooLarge(response)
            else chunks.push(chunk)
        })
        request.on('end', () => {
            if (tooLarge) return
            saveScenarioFile(dir, Buffer.concat(chunks).toString('utf8'))
                .then((file) => respond(response, 200, { file }))
                .catch((error: unknown) =>
                    respond(response, 400, {
                        error: error instanceof Error ? error.message : String(error)
                    })
                )
        })
    }
}

function refuseTooLarge(response: Parameters<typeof respond>[0]) {
    respond(response, 413, { error: 'That scenario is too large to save' })
}

function respond(
    response: {
        statusCode: number
        setHeader(name: string, value: string): unknown
        end(body: string): unknown
    },
    status: number,
    body: Record<string, string>
) {
    response.statusCode = status
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify(body))
}
