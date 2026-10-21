import type { TSchema } from 'typebox'
import { Compile, type Validator } from 'typebox/compile'
import * as Value from 'typebox/value'
import {
    actionRequestSchema,
    createGameRequestSchema,
    GameAction,
    type GameDefinition
} from '@tabletop/common'

export type TitleRequestKey = 'create' | `action:${string}`

type CompiledRequest = { schema: TSchema; validator: Validator }

export const gameActionEnvelope = Compile(GameAction)

// Request validation for the title routes. A title's request and action validators are compiled
// with TypeBox on first use and cached against its Definition, so activation compiles nothing
// and a retired generation takes its validators with it.
export class TitleValidation {
    private readonly requests = new WeakMap<GameDefinition, Map<string, CompiledRequest>>()
    private readonly actions = new WeakMap<GameDefinition, Map<string, Validator>>()

    // Validates a create or action request body the way Fastify's AJV validator did for these
    // routes: values are coerced to the schema's types and defaults applied in place, and a
    // create body also loses properties the schema does not name. Throws Fastify's validation
    // error, so the response is the usual 400.
    request(definition: GameDefinition, key: TitleRequestKey, body: unknown): unknown {
        const compiled = this.compiledRequest(definition, key)
        if (!compiled) throw Object.assign(new Error('Not Found'), { statusCode: 404 })
        const { schema, validator } = compiled
        const value = Value.Default(
            schema,
            Value.Convert(schema, key === 'create' ? Value.Clean(schema, body) : body)
        )
        if (!validator.Check(value)) {
            const errors = [...validator.Errors(value)]
            throw Object.assign(
                new Error(
                    errors.map((error) => `body${error.instancePath} ${error.message}`).join(', ')
                ),
                {
                    code: 'FST_ERR_VALIDATION',
                    statusCode: 400,
                    validation: errors,
                    validationContext: 'body'
                }
            )
        }
        return value
    }

    // The compiled validator for an action's own schema, checked after the wire form has been
    // converted to the Action the title executes.
    action(definition: GameDefinition, type: string): Validator | undefined {
        let cache = this.actions.get(definition)
        if (!cache) {
            cache = new Map()
            this.actions.set(definition, cache)
        }
        const existing = cache.get(type)
        if (existing) return existing
        const schema = definition.runtime.apiActions[type]
        if (!schema) return undefined
        const validator = Compile(schema)
        cache.set(type, validator)
        return validator
    }

    private compiledRequest(
        definition: GameDefinition,
        key: TitleRequestKey
    ): CompiledRequest | undefined {
        let cache = this.requests.get(definition)
        if (!cache) {
            cache = new Map()
            this.requests.set(definition, cache)
        }
        const existing = cache.get(key)
        if (existing) return existing
        const schema = this.requestSchema(definition, key)
        if (!schema) return undefined
        const compiled = { schema, validator: Compile(schema) }
        cache.set(key, compiled)
        return compiled
    }

    private requestSchema(definition: GameDefinition, key: TitleRequestKey): TSchema | undefined {
        if (key === 'create') return createGameRequestSchema(definition.info.configurator?.schema)
        const action = definition.runtime.apiActions[key.slice('action:'.length)]
        return action ? actionRequestSchema(action) : undefined
    }
}
