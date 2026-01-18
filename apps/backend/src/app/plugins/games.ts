import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import { GameDefinition } from '@tabletop/common'

import CreateGame from '../routes/titleSpecific/create.js'
import StartGame from '../routes/titleSpecific/start.js'
import ApplyAction from '../routes/titleSpecific/action.js'
import UndoAction from '../routes/titleSpecific/undo.js'
import ForkGame from '../routes/titleSpecific/fork.js'

import { AppOptions } from '../app.js'

async function registerGame(
    definition: GameDefinition,
    fastify: FastifyInstance,
    opts: AppOptions
) {
    // Base for backwards compatibility, can remove later
    const basePrefix = `${opts.prefix || ''}/game/${definition.info.id}`
    const versionedPrefix = `${opts.prefix || ''}/game/${definition.info.id}/${definition.info.metadata.version}`

    for (const prefix of [basePrefix, versionedPrefix]) {
        await fastify.register(CreateGame.bind(null, definition), { prefix })
        await fastify.register(StartGame.bind(null, definition), { prefix })
        await fastify.register(UndoAction.bind(null, definition), { prefix })
        await fastify.register(ForkGame.bind(null, definition), { prefix })

        // Register all the actions
        for (const actionType of Object.keys(definition.runtime.apiActions)) {
            const actionSchema = definition.runtime.apiActions[actionType]
            await fastify.register(ApplyAction.bind(null, definition, actionType, actionSchema), {
                prefix
            })
        }
    }
}

const Games = async (fastify: FastifyInstance, opts: AppOptions) => {
    let titles: GameDefinition[] = []
    try {
        titles = await fastify.libraryService.getTitles()
    } catch (error) {
        console.warn('Unable to register game routes from manifest', error)
        return
    }

    for (const title of titles) {
        await registerGame(title, fastify, opts)
    }
}

export default fp(Games)
