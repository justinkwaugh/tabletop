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
    opts: AppOptions,
    manifestVersions?: { logicVersion?: string; uiVersion?: string }
) {
    const version = manifestVersions?.logicVersion ?? definition.info.metadata.version ?? '0.0.0'
    const majorPart = version.split('.')[0] ?? '0'
    const majorVersion = Number.parseInt(majorPart, 10)
    const majorSegment = Number.isFinite(majorVersion) ? `v${majorVersion}` : 'v0'
    const logicVersion =
        manifestVersions?.logicVersion ?? definition.info.metadata.version ?? '0.0.0'
    const uiVersion = manifestVersions?.uiVersion ?? '0.0.0'
    // Base for backwards compatibility, can remove later
    const basePrefix = `${opts.prefix || ''}/game/${definition.info.id}`
    const versionedPrefix = `${opts.prefix || ''}/game/${definition.info.id}/${majorSegment}`

    for (const prefix of [basePrefix, versionedPrefix]) {
        await fastify.register(
            async function (instance) {
                instance.addHook('onSend', async (_request, reply, payload) => {
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
    let manifestVersions = new Map<string, { logicVersion?: string; uiVersion?: string }>()
    try {
        titles = await fastify.libraryService.getTitles()
        const manifest = await fastify.libraryService.getManifest()
        manifestVersions = new Map(
            (manifest.games ?? []).map((entry) => [
                entry.gameId,
                { logicVersion: entry.logicVersion, uiVersion: entry.uiVersion }
            ])
        )
    } catch (error) {
        console.warn('Unable to register game routes from manifest', error)
        return
    }

    for (const title of titles) {
        await registerGame(title, fastify, opts, manifestVersions.get(title.info.id))
    }
}

export default fp(Games)
