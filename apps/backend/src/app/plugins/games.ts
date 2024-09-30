import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import { GameDefinition } from '@tabletop/common'

import CreateGame from '../routes/titleSpecific/create.js'
import StartGame from '../routes/titleSpecific/start.js'
import ApplyAction from '../routes/titleSpecific/action.js'
import UndoAction from '../routes/titleSpecific/undo.js'

import { AppOptions } from '../app.js'

async function registerGame(
    definition: GameDefinition,
    fastify: FastifyInstance,
    opts: AppOptions
) {
    const prefix = `${opts.prefix || ''}/game/${definition.id}`

    await fastify.register(CreateGame.bind(null, definition), { prefix })
    await fastify.register(StartGame.bind(null, definition), { prefix })
    await fastify.register(UndoAction.bind(null, definition), { prefix })

    // Register all the actions
    for (const actionType of Object.keys(definition.apiActions)) {
        const actionSchema = definition.apiActions[actionType]
        await fastify.register(ApplyAction.bind(null, definition, actionType, actionSchema), {
            prefix
        })
    }
}

const Games = async (fastify: FastifyInstance, opts: AppOptions) => {
    for (const title of Object.values(fastify.gameService.getTitles())) {
        await registerGame(title, fastify, opts)
    }
}

export default fp(Games)
