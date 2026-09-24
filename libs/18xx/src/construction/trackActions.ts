import { defineAction, type ActionDefinition } from '../actions/actionDefinition.js'
import type { TrackRules } from './trackConstruction.js'
import {
    RequestTrackConsent,
    HydratedRequestTrackConsent,
    RespondToTrackConsent,
    HydratedRespondToTrackConsent,
    isRequestTrackConsent,
    isRespondToTrackConsent
} from './trackConsent.js'
import { LayTile, HydratedLayTile, isLayTile } from './layTile.js'
import { FinishTrack, HydratedFinishTrack, isFinishTrack } from './finishTrack.js'

export function trackActions(rules: TrackRules): ActionDefinition[] {
    return [
        defineAction(
            RespondToTrackConsent,
            isRespondToTrackConsent,
            (action) => new HydratedRespondToTrackConsent(action, rules)
        ),
        defineAction(
            RequestTrackConsent,
            isRequestTrackConsent,
            (action) => new HydratedRequestTrackConsent(action, rules)
        ),
        defineAction(LayTile, isLayTile, (action) => new HydratedLayTile(action, rules)),
        defineAction(FinishTrack, isFinishTrack, (action) => new HydratedFinishTrack(action))
    ]
}
