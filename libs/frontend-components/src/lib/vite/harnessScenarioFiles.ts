import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { Connect, Plugin } from 'vite'
import { HARNESS_SCENARIO_ENDPOINT } from '../harness/harnessScenarioEndpoint.js'

const SCENARIO_ID = /^[a-z0-9][a-z0-9-]*$/

// Lets the dev harness save the current game as a scenario file in the title's scenarios folder,
// which a browser cannot write to itself. It exists only while the dev server runs.
export function harnessScenarioFiles({ dir = 'scenarios' }: { dir?: string } = {}): Plugin {
    return {
        name: 'tabletop-harness-scenario-files',
        apply: 'serve',
        configureServer(server) {
            server.middlewares.use(
                HARNESS_SCENARIO_ENDPOINT,
                // Vite keeps the dev page's list of scenario files from when it first compiled it,
                // so a save marks everything for recompiling, and the next page load lists the new
                // file.
                saveRoute(resolve(server.config.root, dir), () =>
                    server.moduleGraph.invalidateAll()
                )
            )
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

function saveRoute(dir: string, saved: () => void): Connect.NextHandleFunction {
    return (request, response) => {
        if (request.method !== 'POST') {
            response.statusCode = 405
            response.end()
            return
        }
        const chunks: Buffer[] = []
        request.on('data', (chunk: Buffer) => chunks.push(chunk))
        request.on('end', () => {
            saveScenarioFile(dir, Buffer.concat(chunks).toString('utf8'))
                .then((file) => {
                    saved()
                    respond(response, 200, { file })
                })
                .catch((error: unknown) =>
                    respond(response, 400, {
                        error: error instanceof Error ? error.message : String(error)
                    })
                )
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
    body: Record<string, string>
) {
    response.statusCode = status
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify(body))
}
