import type { TSchema } from 'typebox'
import { readFile } from 'node:fs/promises'
import AjvCompiler from '@fastify/ajv-compiler'
import type { FastifySchemaCompiler } from 'fastify'
import {
    actionRequestSchema,
    createGameRequestSchema,
    titleActionAjvOptions,
    titleAjvOptions,
    type GameDefinition
} from '@tabletop/common'
import { evaluateLogicFactory } from '@tabletop/common/node/collectible-factory'
import type { TitleGeneration } from '@tabletop/backend-services'

type Validator = ReturnType<FastifySchemaCompiler<unknown>>

function isValidator(value: unknown): value is Validator {
    return typeof value === 'function'
}

export class TitleValidation {
    private readonly validators = new WeakMap<GameDefinition, Map<string, Validator>>()

    async prepare(generation: TitleGeneration): Promise<void> {
        const filename = `${generation.directory}/validators.cjs`
        let loaded: unknown
        try {
            loaded = evaluateLogicFactory(await readFile(filename, 'utf8'), filename)
        } catch (error) {
            if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT')
                throw error
        }
        const validators = new Map<string, Validator>()
        const schemas = new Map<string, TSchema>([
            ['create', createGameRequestSchema(generation.definition.info.configurator?.schema)],
            ...Object.entries(generation.definition.runtime.apiActions).map(
                ([type, schema]): [string, ReturnType<typeof actionRequestSchema>] => [
                    `action:${type}`,
                    actionRequestSchema(schema)
                ]
            )
        ])
        const build = AjvCompiler()
        for (const [key, schema] of schemas) {
            if (loaded !== undefined) {
                const validate =
                    typeof loaded === 'object' && loaded !== null
                        ? Reflect.get(loaded, key)
                        : undefined
                if (!isValidator(validate))
                    throw new Error(`Missing validator ${key} in ${filename}`)
                validators.set(key, validate)
            } else {
                const compile = build(
                    {},
                    key === 'create' ? titleAjvOptions : titleActionAjvOptions
                )
                validators.set(key, compile({ schema, method: 'POST', url: key, httpPart: 'body' }))
            }
        }
        this.validators.set(generation.definition, validators)
    }

    validate(definition: GameDefinition, key: string, body: unknown): void {
        const validate = this.validators.get(definition)?.get(key)
        if (!validate) throw Object.assign(new Error('Not Found'), { statusCode: 404 })
        if (!validate(body)) {
            throw Object.assign(
                new Error(
                    (validate.errors ?? [])
                        .map((error) => `body${error.instancePath} ${error.message}`)
                        .join(', ')
                ),
                {
                    code: 'FST_ERR_VALIDATION',
                    statusCode: 400,
                    validation: validate.errors,
                    validationContext: 'body'
                }
            )
        }
    }
}
