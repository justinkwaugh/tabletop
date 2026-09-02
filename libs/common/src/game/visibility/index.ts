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
export type { Perspective, Projector } from './valueProjector.js'
