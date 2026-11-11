import type { FastifyInstance, FastifySchemaCompiler } from 'fastify'
import type { TSchema } from 'typebox'
import { Compile } from 'typebox/compile'
import { CompetitionError } from '@tabletop/backend-services'

export function competitionRequestValidator(message: string): FastifySchemaCompiler<TSchema> {
    return ({ schema }) => {
        const validator = Compile(schema)
        return (data) => (validator.Check(data) ? { value: data } : { error: new Error(message) })
    }
}

export function prepareCompetitionRoutes(fastify: FastifyInstance, errorName: string) {
    fastify.addHook('onRequest', fastify.verifyActiveUser)
    fastify.addHook('onSend', async (_request, reply, payload) => {
        reply.header('Cache-Control', 'no-store')
        return payload
    })
    fastify.setErrorHandler((error, _request, reply) => {
        if (error instanceof CompetitionError)
            return reply.code(error.statusCode).send({
                status: 'error',
                error: { name: errorName, message: error.message }
            })
        return reply.send(error)
    })
}
