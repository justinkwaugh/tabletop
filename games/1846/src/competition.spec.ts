import { assertExists } from '@tabletop/common'
import { trainsOwnedBy } from '@tabletop/18xx'
import type { ExamplePlay } from '@tabletop/18xx/scenarios'
import { startingPositionTests } from '../../../libs/18xx/test/startingPositions.js'
import { Definition } from './definition/gameDefinition.js'
import { Scenarios1846 } from './scenarios/index.js'
import type { EighteenFortySixProjectedState, HydratedEighteenFortySixState } from './state.js'
import { trainBuyingChoices1846 } from './trains.js'

type Setup = Omit<EighteenFortySixProjectedState, 'id'>

/** Table order runs opposite to the draft: seat one drafts first and the last seat holds the priority deal. */
function seated1846(ordinary: Setup, playerIds: readonly string[]): Setup {
    const [seatOne] = playerIds
    const tableOrder = playerIds.toReversed()
    const inTableOrder = <Row>(rows: readonly Row[], playerOf: (row: Row) => string | undefined) =>
        tableOrder.map((playerId) => {
            const row = rows.find((candidate) => playerOf(candidate) === playerId)
            assertExists(row, `Setup has a row for ${playerId}`)
            return row
        })
    const draft = ordinary.draft
    return {
        ...ordinary,
        players: inTableOrder(ordinary.players, (player) => player.playerId),
        activePlayerIds: [seatOne],
        turnManager: {
            ...ordinary.turnManager,
            turnOrder: [...playerIds],
            series: [{ type: 'turn', playerId: seatOne, start: 0 }]
        },
        draft:
            draft.kind === 'public'
                ? draft
                : {
                      ...draft,
                      participants: inTableOrder(
                          draft.participants,
                          (participant) => participant.playerId
                      ).map((participant) => ({
                          ...participant,
                          packet:
                              participant.playerId === seatOne
                                  ? draft.participants.find(
                                        (dealt) => dealt.playerId === ordinary.activePlayerIds[0]
                                    )?.packet
                                  : []
                      }))
                  }
    }
}

function finishEnding(
    play: ExamplePlay<EighteenFortySixProjectedState, HydratedEighteenFortySixState>
) {
    const companyId = play.state.trainPurchaseStep?.companyId
    assertExists(companyId, 'The ending position is a company buying trains')
    if (trainsOwnedBy(play.state, { kind: 'company', companyId }).length === 0) {
        const offer = trainBuyingChoices1846(play.state)?.offers[0]
        assertExists(offer, 'The ending company can buy a train')
        const { price, ...request } = offer
        play.act('BuyTrain', { ...request, expectedPrice: price })
    }
    play.act('FinishOperatingTurn', { companyId })
}

startingPositionTests(Definition, Scenarios1846, [2, 3, 4, 5], {
    finishEnding,
    seated: seated1846
})
