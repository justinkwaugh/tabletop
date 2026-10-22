import type { FastifyRequest, RouteOptions } from 'fastify'

export function observeHandler(
    handler: RouteOptions['handler'],
    start: (request: FastifyRequest) => () => void
): RouteOptions['handler'] {
    return function (request, reply) {
        const finish = start(request)
        try {
            const result = handler.call(this, request, reply)
            if (
                result !== null &&
                (typeof result === 'object' || typeof result === 'function') &&
                'then' in result &&
                typeof result.then === 'function'
            ) {
                void Promise.resolve(result).then(finish, finish)
            } else finish()
            return result
        } catch (error) {
            finish()
            throw error
        }
    }
}
