import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { HydratedBridgesGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { HydratedVillage } from '../components/village.js'

export type BeginJourney = Static<typeof BeginJourney>
export const BeginJourney = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.BeginJourney),
            playerId: Type.String(),
            from: Type.Number(),
            to: Type.Number()
        })
    ])
)

export const BeginJourneyValidator = Compile(BeginJourney)

export function isBeginJourney(action?: GameAction): action is BeginJourney {
    return action?.type === ActionType.BeginJourney
}

export class HydratedBeginJourney
    extends HydratableAction<typeof BeginJourney>
    implements BeginJourney
{
    declare type: ActionType.BeginJourney
    declare playerId: string
    declare from: number
    declare to: number

    constructor(data: BeginJourney) {
        super(data, BeginJourneyValidator)
    }

    apply(state: HydratedBridgesGameState) {
        const { valid: validSource, reason: sourceErrorReason } =
            HydratedBeginJourney.isValidSourceVillage(state, this.playerId, this.from)
        if (!validSource) {
            throw Error(sourceErrorReason)
        }

        const { valid: validDestination, reason: destErrorReason } =
            HydratedBeginJourney.isValidDestinationVillage(state, this.to, this.from)
        if (!validDestination) {
            throw Error(destErrorReason)
        }

        // Journey
        const sourceVillage = state.board.villages[this.from]
        const destVillage = state.board.villages[this.to]

        if (this.isSourceStronger(sourceVillage, destVillage)) {
            this.doStrongerSourceJourney(state, sourceVillage, destVillage)
        } else {
            this.doStrongerDestinationJourney(state, sourceVillage, destVillage)
        }

        // Break the bridge
        sourceVillage.neighbors = sourceVillage.neighbors.filter((v) => v !== this.to)
        destVillage.neighbors = destVillage.neighbors.filter((v) => v !== this.from)

        // Add stones if need be
        if (sourceVillage.neighbors.length === 0) {
            sourceVillage.stone = true
            state.stones--
        }

        if (destVillage.neighbors.length === 0) {
            destVillage.stone = true
            state.stones--
        }

        state.score()
    }

    doStrongerSourceJourney(
        state: HydratedBridgesGameState,
        sourceVillage: HydratedVillage,
        destVillage: HydratedVillage
    ) {
        for (const space of Object.values(sourceVillage.spaces)) {
            if (space === undefined || !space.student) {
                continue
            }

            space.student = false

            const displacedSpace = destVillage.spaces[space.masterType]
            let hasStudent = false
            if (displacedSpace !== undefined) {
                const displacedPlayer = state.getPlayerState(displacedSpace.playerId)
                if (space.playerId !== displacedSpace.playerId) {
                    displacedPlayer.addPiece(space.masterType)
                    if (displacedSpace.student) {
                        displacedPlayer.addPiece(space.masterType)
                    }
                } else {
                    if (displacedSpace.student) {
                        displacedPlayer.addPiece(space.masterType)
                    }
                    hasStudent = true
                }
            }

            destVillage.spaces[space.masterType] = {
                masterType: space.masterType,
                playerId: space.playerId,
                student: hasStudent
            }
        }
    }

    doStrongerDestinationJourney(
        state: HydratedBridgesGameState,
        sourceVillage: HydratedVillage,
        destVillage: HydratedVillage
    ) {
        for (const space of Object.values(sourceVillage.spaces)) {
            if (space === undefined || !space.student) {
                continue
            }

            space.student = false

            const destinationSpace = destVillage.spaces[space.masterType]
            if (destinationSpace === undefined) {
                destVillage.spaces[space.masterType] = {
                    masterType: space.masterType,
                    playerId: space.playerId,
                    student: false
                }
            } else {
                const sourcePlayer = state.getPlayerState(space.playerId)
                sourcePlayer.addPiece(space.masterType)
            }
        }
    }

    isSourceStronger(sourceVillage: HydratedVillage, destVillage: HydratedVillage): boolean {
        const sourceStrength = sourceVillage.strength()
        const destStrength = destVillage.strength()

        if (sourceStrength === destStrength) {
            return sourceVillage.numberOfMasters() > destVillage.numberOfMasters()
        } else {
            return sourceStrength > destStrength
        }
    }

    static isValidSourceVillage(
        state: HydratedBridgesGameState,
        playerId: string,
        village: number
    ): { valid: boolean; reason: string } {
        const board = state.board
        if (!board.hasVillage(village)) {
            return { valid: false, reason: `Invalid Village ${village}` }
        }

        const selectedVillage = board.villages[village]
        if (selectedVillage.isAtPeace()) {
            return { valid: false, reason: `Village ${village} is at peace` }
        }

        if (selectedVillage.numberOfStudentsForPlayer(playerId) === 0) {
            return {
                valid: false,
                reason: `Player ${playerId} has no students in village ${selectedVillage}`
            }
        }

        return { valid: true, reason: '' }
    }

    static isValidDestinationVillage(
        state: HydratedBridgesGameState,
        village: number,
        from: number
    ): { valid: boolean; reason: string } {
        const board = state.board
        if (!board.hasVillage(village)) {
            return { valid: false, reason: `Invalid Village ${village}` }
        }

        const sourceVillage = board.villages[from]
        if (!sourceVillage.neighbors.includes(village)) {
            return { valid: false, reason: `Village ${village} is not connected to ${from}` }
        }

        return { valid: true, reason: '' }
    }
}
