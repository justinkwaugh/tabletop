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
    const version = definition.info.metadata.version ?? '0.0.0'
    const majorPart = version.split('.')[0] ?? '0'
    const majorVersion = Number.parseInt(majorPart, 10)
    const majorSegment = Number.isFinite(majorVersion) ? `v${majorVersion}` : 'v0'
    // Base for backwards compatibility, can remove later
    const basePrefix = `${opts.prefix || ''}/game/${definition.info.id}`
    const versionedPrefix = `${opts.prefix || ''}/game/${definition.info.id}/${majorSegment}`

    for (const prefix of [basePrefix, versionedPrefix]) {
        await fastify.register(
            async function (instance) {
                instance.addHook('onSend', async (_request, reply, payload) => {
                    let logicVersion = definition.info.metadata.version ?? '0.0.0'
                    let uiVersion = '0.0.0'
                    try {
                        const manifest = await instance.libraryService.getManifest()
                        const entry = manifest.games?.find(
                            (game) => game.gameId === definition.info.id
                        )
                        if (entry?.logicVersion) {
                            logicVersion = entry.logicVersion
                        }
                        if (entry?.uiVersion) {
                            uiVersion = entry.uiVersion
                        }
                    } catch (error) {
                        console.warn(
                            `Unable to resolve manifest versions for ${definition.info.id}`,
                            error
                        )
                    }
                    reply.header('X-TABLETOP-GAME-LOGIC-VERSION', logicVersion)
                    reply.header('X-TABLETOP-GAME-UI-VERSION', uiVersion)
                    return payload
                })

                await instance.register(CreateGame.bind(null, definition))
                await instance.register(StartGame.bind(null, definition))
                await instance.register(UndoAction.bind(null, definition))
                await instance.register(ForkGame.bind(null, definition))

                // Register all the actions
                for (const actionType of Object.keys(definition.runtime.apiActions)) {
                    const actionSchema = definition.runtime.apiActions[actionType]
                    await instance.register(
                        ApplyAction.bind(null, definition, actionType, actionSchema)
                    )
                }
            },
            { prefix }
        )
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
