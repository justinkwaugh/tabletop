import type { TitleResolver } from '../../lib/titleDefinition.js'
import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { GameClientCapability } from '@tabletop/common'

type UndoVoteTarget = Static<typeof UndoVoteTarget>
const UndoVoteTarget = Type.Object(
    {
        gameId: Type.String(),
        actionIndex: Type.Integer({ minimum: 0 })
    },
    { additionalProperties: false }
)

type UndoVoteOpening = Static<typeof UndoVoteOpening>
const UndoVoteOpening = Type.Object(
    {
        gameId: Type.String(),
        actionIndex: Type.Integer({ minimum: 0 }),
        targetActionId: Type.String()
    },
    { additionalProperties: false }
)

type CallRequest = Static<typeof CallRequest>
const CallRequest = Type.Object(
    {
        gameId: Type.String(),
        declaredWinnerIds: Type.Array(Type.String())
    },
    { additionalProperties: false }
)

type VoteReference = Static<typeof VoteReference>
const VoteReference = Type.Object(
    {
        gameId: Type.String(),
        voteId: Type.String()
    },
    { additionalProperties: false }
)

export default async function (title: TitleResolver, fastify: FastifyInstance) {
    const onRequest = fastify.auth([fastify.verifyUser], { relation: 'and' })

    fastify.post<{ Body: UndoVoteTarget }>(
        '/vote/undo/preview',
        { schema: { body: UndoVoteTarget }, onRequest },
        async function (request) {
            const definition = title(request)
            if (!request.user) {
                throw Error('No user found for undo vote preview')
            }
            const preview = await fastify.gameService.previewUndoVote({
                user: request.user,
                definition,
                ...request.body
            })
            return { status: 'ok', payload: { preview } }
        }
    )

    fastify.post<{ Body: UndoVoteOpening }>(
        '/vote/undo/open',
        { schema: { body: UndoVoteOpening }, onRequest },
        async function (request) {
            const definition = title(request)
            if (!request.user) {
                throw Error('No user found for opening an undo vote')
            }
            const game = await fastify.gameService.openUndoVote({
                user: request.user,
                definition,
                ...request.body
            })
            return { status: 'ok', payload: { game } }
        }
    )

    fastify.post<{ Body: CallRequest }>(
        '/vote/call',
        { schema: { body: CallRequest }, onRequest },
        async function (request) {
            const definition = title(request)
            if (!request.user) {
                throw Error('No user found for calling a game')
            }
            const publication = fastify.libraryService.getGeneration(
                definition.info.id
            )?.publication
            const publishedUiSupportsCalls =
                publication !== undefined &&
                (await fastify.catalogService.supportsCapability(
                    publication,
                    GameClientCapability.CalledGames
                ))
            const game = await fastify.gameService.requestCall({
                user: request.user,
                definition,
                publishedUiSupportsCalls,
                ...request.body
            })
            return { status: 'ok', payload: { game } }
        }
    )

    fastify.post<{ Body: VoteReference }>(
        '/vote/approve',
        { schema: { body: VoteReference }, onRequest },
        async function (request) {
            const definition = title(request)
            if (!request.user) {
                throw Error('No user found for approving a vote')
            }
            const game = await fastify.gameService.approveVote({
                user: request.user,
                definition,
                ...request.body
            })
            return { status: 'ok', payload: { game } }
        }
    )

    fastify.post<{ Body: VoteReference }>(
        '/vote/decline',
        { schema: { body: VoteReference }, onRequest },
        async function (request) {
            if (!request.user) {
                throw Error('No user found for declining a vote')
            }
            const game = await fastify.gameService.declineVote({
                user: request.user,
                ...request.body
            })
            return { status: 'ok', payload: { game } }
        }
    )

    fastify.post<{ Body: VoteReference }>(
        '/vote/withdraw',
        { schema: { body: VoteReference }, onRequest },
        async function (request) {
            if (!request.user) {
                throw Error('No user found for withdrawing a vote')
            }
            const game = await fastify.gameService.withdrawVote({
                user: request.user,
                ...request.body
            })
            return { status: 'ok', payload: { game } }
        }
    )
}
