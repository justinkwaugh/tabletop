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
    GameVisibility,
    Perspective,
    PolicyContext,
    PolicyRegistry,
    PolicyResolver,
    Projector,
    ProjectorOptions,
    ValueProjector
} from './valueProjector.js'
