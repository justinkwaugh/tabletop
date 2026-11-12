import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import {
    buildOrRepair,
    chronicleOf,
    edificeChoiceNamed,
    reasonCannotBuildOrRepair
} from '../util/chronicleChoices.js'

export type BuildOrRepairEdificeMetadata = Type.Static<typeof BuildOrRepairEdificeMetadata>
export const BuildOrRepairEdificeMetadata = Type.Object({
    edificeId: Type.String(),
    /** The site card in the chosen slot as it was built: R-8.3.5 may move it. */
    siteCardId: Type.String(),
    repaired: Type.Boolean(),
    /** A build's replaced denizen, bound for the world deck. */
    returnedDenizenId: Type.Optional(Type.String())
})

/** R-8.3.1 — build at a site the winner rules, repair a ruin there, or neither (no `siteId`). */
export type BuildOrRepairEdifice = Type.Static<typeof BuildOrRepairEdifice>
export const BuildOrRepairEdifice = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.BuildOrRepairEdifice),
            playerId: Type.String(),
            /** The site, and the denizen to replace or the ruin to repair; absent for neither. */
            choice: Type.Optional(Type.Object({ siteId: Type.String(), cardId: Type.String() })),
            metadata: Type.Optional(BuildOrRepairEdificeMetadata)
        })
    ])
)

export const BuildOrRepairEdificeValidator = Compile(BuildOrRepairEdifice)

export function isBuildOrRepairEdifice(action?: GameAction): action is BuildOrRepairEdifice {
    return action?.type === ActionType.BuildOrRepairEdifice
}

export class HydratedBuildOrRepairEdifice
    extends HydratableAction<typeof BuildOrRepairEdifice>
    implements BuildOrRepairEdifice
{
    declare type: ActionType.BuildOrRepairEdifice
    declare playerId: string
    declare choice?: { siteId: string; cardId: string }
    declare metadata?: BuildOrRepairEdificeMetadata

    constructor(data: BuildOrRepairEdifice) {
        super(data, BuildOrRepairEdificeValidator)
    }

    apply(state: HydratedOathGameState, _context?: MachineContext) {
        const reason = reasonCannotBuildOrRepair(state, this.playerId, this.choice)
        if (reason) throw Error(reason)
        this.revealsInfo = false
        if (!this.choice) return
        const choice = edificeChoiceNamed(state, this.choice)
        buildOrRepair(state, choice)
        const siteCardId = chronicleOf(state).built?.siteCardId
        assertExists(siteCardId, 'R-8.3.1 — the build names the site it was made at')
        this.metadata = {
            edificeId: choice.edificeId,
            siteCardId,
            repaired: choice.repair,
            ...(choice.repair ? {} : { returnedDenizenId: choice.cardId })
        }
    }

    static canDoBuildOrRepairEdifice(state: HydratedOathGameState, playerId: string): boolean {
        return reasonCannotBuildOrRepair(state, playerId) === undefined
    }
}
