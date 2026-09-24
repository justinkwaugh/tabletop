import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import { assert, type GameDefinition } from '@tabletop/common'
import type { EighteenXXState, HydratedEighteenXXState } from '@tabletop/18xx'

function orderIndependent(key: string, value: unknown): unknown {
    if (key === 'required' && Array.isArray(value)) return [...value].sort()
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value
    return Object.fromEntries(
        Object.entries(value).sort(([first], [second]) => first.localeCompare(second))
    )
}

export function runtimeContractTests(
    definition: GameDefinition<EighteenXXState, HydratedEighteenXXState>,
    snapshotPath: string
) {
    it('keeps the serialized contract that deployed clients and stored games rely on', async () => {
        const runtime = definition.runtime
        const validator = runtime.canonicalStateValidator
        assert(
            validator && 'Type' in validator && typeof validator.Type === 'function',
            'The runtime exposes its canonical state schema'
        )
        await expect(
            JSON.stringify(
                {
                    canonicalState: validator.Type(),
                    actionSchemaDigests: Object.fromEntries(
                        Object.entries(runtime.apiActions).map(([type, schema]) => [
                            type,
                            createHash('sha256')
                                .update(JSON.stringify(schema, orderIndependent))
                                .digest('hex')
                        ])
                    ),
                    handledMachineStates: Object.keys(runtime.stateHandlers).sort()
                },
                orderIndependent,
                2
            )
        ).toMatchFileSnapshot(snapshotPath)
    })
}
