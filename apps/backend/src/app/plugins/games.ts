import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyPluginOptions, FastifyRequest } from 'fastify'
import type { GameDefinition } from '@tabletop/common'
import Preferences from '../routes/titleSpecific/preferences.js'
import CreateGame from '../routes/titleSpecific/create.js'
import StartGame from '../routes/titleSpecific/start.js'
import ApplyAction from '../routes/titleSpecific/action.js'
import UndoAction from '../routes/titleSpecific/undo.js'
import ForkGame from '../routes/titleSpecific/fork.js'
import PlayerVotes from '../routes/titleSpecific/vote.js'
import { GameVersionMismatchError } from '../lib/errors.js'

const parseMajorVersion = (version?: string) => {
    const match = version?.match(/^(\d+)\./)
    return match ? Number(match[1]) : null
}

const Games = async (fastify: FastifyInstance, opts: FastifyPluginOptions) => {
    await fastify.libraryService.getTitles()
    await fastify.register(
        async (instance) => {
            const definitions = new WeakMap<FastifyRequest, GameDefinition>()
            const definitionFor = (request: FastifyRequest) => {
                const definition = definitions.get(request)
                if (!definition) throw Object.assign(new Error('Not Found'), { statusCode: 404 })
                return definition
            }
            instance.addHook('onRequest', async (request) => {
                const params = request.params
                if (
                    typeof params !== 'object' ||
                    params === null ||
                    !('titleId' in params) ||
                    typeof params.titleId !== 'string'
                ) {
                    throw Object.assign(new Error('Not Found'), { statusCode: 404 })
                }
                const generation = instance.libraryService.getGeneration(params.titleId)
                if (!generation) throw Object.assign(new Error('Not Found'), { statusCode: 404 })
                definitions.set(request, generation.definition)
                const logicVersion = generation.publication.logicVersion
                const header = request.headers['x-tabletop-game-logic-version']
                const requestVersion = Array.isArray(header) ? header[0] : header
                const serverMajor = parseMajorVersion(logicVersion)
                const requestMajor = parseMajorVersion(requestVersion)
                if (serverMajor !== null && requestMajor !== null && serverMajor !== requestMajor) {
                    throw Object.assign(
                        new GameVersionMismatchError({
                            requestedVersion: requestVersion ?? 'unknown',
                            serverVersion: logicVersion
                        }),
                        { statusCode: 400 }
                    )
                }
            })
            instance.addHook('onSend', async (request, reply, payload) => {
                const definition = definitions.get(request)
                if (definition) {
                    const generation = instance.libraryService.getGeneration(definition.info.id)
                    reply.header('X-TABLETOP-GAME-LOGIC-VERSION', definition.info.metadata.version)
                    reply.header(
                        'X-TABLETOP-GAME-UI-VERSION',
                        generation?.publication.uiVersion ?? '0.0.0'
                    )
                }
                return payload
            })
            instance.addHook('onResponse', async (request) => {
                definitions.delete(request)
            })
            await instance.register(Preferences.bind(null, definitionFor))
            await instance.register(CreateGame.bind(null, definitionFor))
            await instance.register(StartGame.bind(null, definitionFor))
            await instance.register(UndoAction.bind(null, definitionFor))
            await instance.register(ForkGame.bind(null, definitionFor))
            await instance.register(PlayerVotes.bind(null, definitionFor))
            await instance.register(ApplyAction.bind(null, definitionFor, undefined, undefined))
        },
        { prefix: `${opts.prefix ?? ''}/game/:titleId` }
    )
}

export default fp(Games)
