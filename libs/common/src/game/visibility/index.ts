export {
    createProjectionSchema,
    MetadataKey,
    Policy,
    protect,
    redaction
} from './visibilitySchema.js'
export { createProjector } from './valueProjector.js'

export type {
    Metadata,
    OmitRedaction,
    ProjectedSchema,
    ProtectedSchema,
    ProtectionOptions,
    Redaction,
    ReplacementRedaction
} from './visibilitySchema.js'
export type {
    Perspective,
    PolicyContext,
    PolicyRegistry,
    PolicyResolver,
    Projector,
    ProjectorOptions
} from './valueProjector.js'
