import type { FastifyRequest } from 'fastify'
import type { GameDefinition } from '@tabletop/common'

export type TitleDefinition = GameDefinition | ((request: FastifyRequest) => GameDefinition)

export function resolveTitle(source: TitleDefinition, request: FastifyRequest): GameDefinition {
    return typeof source === 'function' ? source(request) : source
}
