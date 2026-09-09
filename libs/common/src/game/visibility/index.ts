export {
    createProjectionSchema,
    MetadataKey,
    Policy,
    protect,
    redaction,
    scope,
    ScopeKey
} from './visibilitySchema.js'
export {
    createProjector,
    isUnavailableProjectedValueError,
    Perspective,
    UnavailableProjectedValueError
} from './valueProjector.js'
export {
    createActionProjector,
    isRedactedAction,
    isUnavailableProjectedActionError,
    protectAction,
    RedactedActionType,
    UnavailableProjectedActionError
} from './actionProjector.js'
export {
    getGameVisibility,
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
    ProjectionContext,
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
    ActionReplayContext,
    ActionResultProjectionOptions,
    GameVisibility,
    VisibleActionCascade,
    VisibleActionHistory
} from './gameVisibility.js'
export type { CanonicalActionCascade, CanonicalActionTransition } from '../engine/gameEngine.js'

export type {
    PolicyExpression,
    PolicyValue,
    AnyOfPolicy,
    ConfigEqualsPolicy,
    StateEqualsPolicy
} from './policyExpression.js'
