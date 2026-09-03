export {
    createProjectionSchema,
    MetadataKey,
    Policy,
    protect,
    redaction,
    scope,
    ScopeKey
} from './visibilitySchema.js'
export { createProjector } from './valueProjector.js'
export { createActionProjector } from './actionProjector.js'
export {
    projectActionCascade,
    projectActionHistory,
    projectActionResult
} from './gameVisibility.js'

export type {
    Metadata,
    OmitRedaction,
    ProjectedSchema,
    ProtectedSchema,
    ProtectionOptions,
    Redaction,
    ReplacementRedaction,
    ScopedSchema,
    ScopeMetadata
} from './visibilitySchema.js'
export type {
    Perspective,
    PolicyContext,
    PolicyRegistry,
    PolicyResolver,
    Projector,
    ProjectorOptions,
    ValueProjector
} from './valueProjector.js'
export type {
    ActionProjector,
    ActionProjectorOptions,
    ActionSchemaRegistry
} from './actionProjector.js'
export type {
    ActionCascadeProjectionOptions,
    ActionHistoryProjectionOptions,
    ActionResultProjectionOptions,
    GameVisibility,
    VisibleActionCascade,
    VisibleActionHistory
} from './gameVisibility.js'
export type { CanonicalActionCascade, CanonicalActionTransition } from '../engine/gameEngine.js'
