import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    MachineContext,
    assertExists
} from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MAX_OFFICES_PER_CITY } from '../components/cities.js'
import type { HydratedKoggeGameState } from '../model/gameState.js'

export type RevealStartCities = Type.Static<typeof RevealStartCities>
export const RevealStartCities = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['source']),
        Type.Object({
            type: Type.Literal(ActionType.RevealStartCities),
            source: Type.Literal(ActionSource.System),
            metadata: Type.Optional(
                Type.Object({
                    choices: Type.Record(Type.String(), Type.Integer({ minimum: 0 })),
                    founded: Type.Array(Type.String()),
                    contested: Type.Array(Type.Integer({ minimum: 0 })),
                    turnOrder: Type.Optional(Type.Array(Type.String()))
                })
            )
        })
    ])
)

export const RevealStartCitiesValidator = Compile(RevealStartCities)

export function isRevealStartCities(action?: GameAction): action is RevealStartCities {
    return action?.type === ActionType.RevealStartCities
}

// Rulebook "Start Position": choices are revealed together; when more players pick a city
// than it has office sites left, all of them choose again, never repeating a choice.
export class HydratedRevealStartCities
    extends HydratableAction<typeof RevealStartCities>
    implements RevealStartCities
{
    declare type: ActionType.RevealStartCities
    declare source: ActionSource.System
    declare metadata?: {
        choices: Record<string, number>
        founded: string[]
        contested: number[]
        turnOrder?: string[]
    }

    constructor(data: RevealStartCities) {
        super(data, RevealStartCitiesValidator)
    }

    apply(state: HydratedKoggeGameState, _context?: MachineContext) {
        const choices = state.startChoices
        assertExists(choices, 'No start cities are being chosen')
        const pending = choices.filter((choice) => choice.submitted)
        const chosenCities = pending.map((choice) => {
            assertExists(choice.city, 'A submitted start city is unavailable')
            return { playerId: choice.playerId, city: choice.city }
        })
        const contested = [...new Set(chosenCities.map(({ city }) => city))].filter(
            (city) =>
                state.city(city).offices.length +
                    chosenCities.filter((choice) => choice.city === city).length >
                MAX_OFFICES_PER_CITY
        )
        const founded: string[] = []
        for (const { playerId, city } of chosenCities) {
            const choice = pending.find((candidate) => candidate.playerId === playerId)
            assertExists(choice, `No start choice for ${playerId}`)
            if (contested.includes(city)) {
                choice.excluded.push(city)
                choice.submitted = false
                delete choice.city
                continue
            }
            this.foundStartingOffice(state, playerId, city)
            choices.splice(choices.indexOf(choice), 1)
            founded.push(playerId)
        }
        this.metadata = {
            choices: Object.fromEntries(chosenCities.map(({ playerId, city }) => [playerId, city])),
            founded,
            contested
        }
        if (choices.length === 0) {
            delete state.startChoices
            this.metadata.turnOrder = this.establishTurnOrder(state)
        }
    }

    private foundStartingOffice(state: HydratedKoggeGameState, playerId: string, city: number) {
        const player = state.getPlayerState(playerId)
        state.city(city).offices.push({ playerId, goods: 0 })
        player.city = city
        player.giveMarkers([city])
        state.reserve.returnMarkers([city])
    }

    // Rulebook: the lowest-numbered start city moves first; a shared city is ordered at random.
    private establishTurnOrder(state: HydratedKoggeGameState): string[] {
        const random = state.getPublicPrng().random
        const tieBreak = new Map(state.players.map((player) => [player.playerId, random()]))
        const order = state.players
            .toSorted(
                (a, b) =>
                    a.location() - b.location() ||
                    (tieBreak.get(a.playerId) ?? 0) - (tieBreak.get(b.playerId) ?? 0)
            )
            .map((player) => player.playerId)
        state.turnManager.turnOrder = order
        return order
    }
}
