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
export { projectActionCascade } from './gameVisibility.js'

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
    CanonicalActionCascade,
    CanonicalCascadeTransition,
    CascadeProjectionOptions,
    GameVisibility,
    VisibleActionCascade,
    VisibleActionTransition
} from './gameVisibility.js'
