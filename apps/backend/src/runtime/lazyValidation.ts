import AjvCompiler, { type BuildCompilerFromPool } from '@fastify/ajv-compiler'
import type { FastifySchemaCompiler } from 'fastify'

export type AjvCompilerOptions = NonNullable<Parameters<BuildCompilerFromPool>[1]>
type ExternalSchemas = Parameters<BuildCompilerFromPool>[0]
type ValidationResult = ReturnType<FastifySchemaCompiler<unknown>>

function isExternalSchema(schema: unknown): schema is ExternalSchemas[string] {
    return typeof schema === 'boolean' || (typeof schema === 'object' && schema !== null)
}

function externalSchemas(schemas: Record<string, unknown>): ExternalSchemas {
    const valid: ExternalSchemas = {}
    for (const [id, schema] of Object.entries(schemas)) {
        if (isExternalSchema(schema)) valid[id] = schema
    }
    return valid
}

// Fastify compiles every route's validator before the server starts listening, which is
// most of a replacement child's startup; compile each one on its route's first request.
export function lazyValidatorCompiler(
    getSchemas: () => Record<string, unknown>,
    ajvOptions: AjvCompilerOptions
): FastifySchemaCompiler<unknown> {
    const buildFromPool = AjvCompiler()
    return (route) => {
        let validate: ValidationResult | undefined
        const lazyValidate: ValidationResult = (data: unknown) => {
            validate ??= buildFromPool(externalSchemas(getSchemas()), ajvOptions)({ ...route })
            const result = validate(data)
            lazyValidate.errors = validate.errors
            return result
        }
        return lazyValidate
    }
}
