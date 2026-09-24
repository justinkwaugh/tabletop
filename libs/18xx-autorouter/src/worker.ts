import type { RouteRules, TrainRunningState } from '@tabletop/18xx'
import { Autorouter, type AutoroutingResult } from './autorouter.js'

export type AutoroutingRequest = { state: TrainRunningState; companyId: string }
export type AutoroutingResponse =
    | { result: AutoroutingResult; error?: never }
    | { error: string; result?: never }

export function serveAutorouter(rules: RouteRules, wasmUrl: string): void {
    let router: Promise<Autorouter> | undefined
    globalThis.onmessage = async (event: MessageEvent<AutoroutingRequest>) => {
        try {
            router ??= fetch(wasmUrl).then(async (response) => {
                if (!response.ok) throw new Error('The route solver could not be loaded.')
                return Autorouter.create(await response.arrayBuffer())
            })
            const result = (await router).solve(event.data.state, rules, event.data.companyId)
            globalThis.postMessage({ result } satisfies AutoroutingResponse)
        } catch (error) {
            globalThis.postMessage({
                error: error instanceof Error ? error.message : 'Route calculation failed.'
            } satisfies AutoroutingResponse)
        }
    }
}
