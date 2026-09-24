import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assert, assertExists } from '@tabletop/common'
import type { TrainDepot } from '../trains/trainDepot.js'

const Id = Type.String({ minLength: 1 })
export const PhaseDefinition = Type.Object(
    {
        id: Id,
        startedBy: Type.Array(Id, { uniqueItems: true }),
        tileColors: Type.Array(Id, { uniqueItems: true }),
        operatingRounds: Type.Integer({ minimum: 1 }),
        trainLimit: Type.Integer({ minimum: 0 })
    },
    { additionalProperties: false }
)
export type PhaseDefinition = Type.Static<typeof PhaseDefinition>
const Validator = Compile(Type.Array(PhaseDefinition, { minItems: 1 }))

export class PhaseTable {
    constructor(
        readonly phases: readonly PhaseDefinition[],
        private readonly depot: TrainDepot
    ) {
        assert(Validator.Check(phases), 'Invalid phase table')
        assert(new Set(phases.map((phase) => phase.id)).size === phases.length, 'Duplicate phase')
        assert(phases[0].startedBy.length === 0, 'The first phase is not started by a train')
        for (const phase of phases)
            for (const definitionId of phase.startedBy) depot.trainDefinition(definitionId)
        for (const { id, rustsOn } of depot.definition.trains) {
            if (!rustsOn) continue
            depot.trainDefinition(rustsOn)
            assert(
                phases.some((phase) => phase.startedBy.includes(rustsOn)),
                `${id} rusts on a train that starts no phase`
            )
        }
    }
    get firstPhaseId(): string {
        return this.phases[0].id
    }
    has(phaseId: string): boolean {
        return this.phases.some((phase) => phase.id === phaseId)
    }
    phase(phaseId: string): PhaseDefinition {
        const phase = this.phases.find((phase) => phase.id === phaseId)
        assertExists(phase, `Unknown phase ${phaseId}`)
        return phase
    }
    isAtLeast(currentPhaseId: string, phaseId: string): boolean {
        return this.position(currentPhaseId) >= this.position(phaseId)
    }
    phaseAfterPurchase(currentPhaseId: string, trainDefinitionId: string): string {
        const current = this.position(currentPhaseId)
        const started = this.phases.findLastIndex(
            (phase, position) => position > current && phase.startedBy.includes(trainDefinitionId)
        )
        return this.phases[Math.max(current, started)].id
    }
    rustPhaseId(trainDefinitionId: string): string | undefined {
        const rustsOn = this.depot.trainDefinition(trainDefinitionId).rustsOn
        return rustsOn && this.phases.find((phase) => phase.startedBy.includes(rustsOn))?.id
    }
    rustTiming(currentPhaseId: string, trainDefinitionId: string): 'immediate' | undefined {
        const rustPhaseId = this.rustPhaseId(trainDefinitionId)
        return rustPhaseId && this.isAtLeast(currentPhaseId, rustPhaseId) ? 'immediate' : undefined
    }
    private position(phaseId: string): number {
        const position = this.phases.findIndex((phase) => phase.id === phaseId)
        assert(position >= 0, `Unknown phase ${phaseId}`)
        return position
    }
}
