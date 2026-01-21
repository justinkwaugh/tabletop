import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import { GameDefinition } from '@tabletop/common'

import CreateGame from '../routes/titleSpecific/create.js'
import StartGame from '../routes/titleSpecific/start.js'
import ApplyAction from '../routes/titleSpecific/action.js'
import UndoAction from '../routes/titleSpecific/undo.js'
import ForkGame from '../routes/titleSpecific/fork.js'

import { AppOptions } from '../app.js'
import { GameVersionMismatchError } from '../lib/errors.js'

async function registerGame(
    definition: GameDefinition,
    fastify: FastifyInstance,
    opts: AppOptions
) {
    const prefix = `${opts.prefix || ''}/game/${definition.info.id}`

    await fastify.register(
        async function (instance) {
            instance.addHook('onRequest', async (request, reply) => {
                const logicVersion = definition.info.metadata.version
                const requestHeader = request.headers['x-tabletop-game-logic-version']
                const requestVersion = Array.isArray(requestHeader)
                    ? requestHeader[0]
                    : requestHeader
                const serverMajor = parseMajorVersion(logicVersion)
                const requestMajor = parseMajorVersion(requestVersion)
                if (
                    serverMajor != null &&
                    requestMajor != null &&
                    serverMajor !== requestMajor
                ) {
                    console.warn(
                        `Game logic major version mismatch for ${definition.info.id}: server=${logicVersion} client=${requestVersion}`
                    )
                    reply.code(400)
                    throw new GameVersionMismatchError({
                        requestedVersion: requestVersion ?? 'unknown',
                        serverVersion: logicVersion ?? 'unknown'
                    })
                }
            })

            instance.addHook('onSend', async (_request, reply, payload) => {
                let logicVersion = definition.info.metadata.version ?? '0.0.0'
                let uiVersion = '0.0.0'
                try {
                    const manifest = await instance.libraryService.getManifest()
                    const entry = manifest.games?.find((game) => game.gameId === definition.info.id)
                    if (entry?.uiVersion) {
                        uiVersion = entry.uiVersion
                    }
                } catch (error) {
                    console.warn(
                        `Unable to resolve ui manifest version for ${definition.info.id}`,
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

const parseMajorVersion = (version?: string) => {
    if (!version) return null
    const match = version.match(/^(\d+)\./)
    return match ? Number(match[1]) : null
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
