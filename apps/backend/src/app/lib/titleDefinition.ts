import type { FastifyRequest } from 'fastify'
import type { GameDefinition } from '@tabletop/common'

// The Definition a title route runs for the request, resolved from the generation the games
// plugin pinned when the request arrived.
export type TitleResolver = (request: FastifyRequest) => GameDefinition
