import { DrawBag, HydratedDrawBag, Visibility, type RandomFunction } from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { RAILROAD_IDS, type RailroadId } from '../components/railroads.js'
import { TRACK_PIECES_PER_RAILROAD } from '../components/trackPieces.js'
import { RailroadIdSchema } from './schemas.js'

// R-1.3 step 6, R-5: items host-only, remaining public.
export type TrackBag = Type.Static<typeof TrackBag>
export const TrackBag = DrawBag(RailroadIdSchema)

export const ProjectedTrackBag = Visibility.createProjectionSchema(TrackBag)
export type ProjectedTrackBag = Type.Static<typeof ProjectedTrackBag>
const ProjectedTrackBagValidator = Compile(ProjectedTrackBag)

export class HydratedTrackBag
    extends HydratedDrawBag<RailroadId, typeof ProjectedTrackBag>
    implements ProjectedTrackBag
{
    // R-1.1, R-1.3 step 6
    static create(random: RandomFunction): HydratedTrackBag {
        const items = RAILROAD_IDS.flatMap((railroadId) =>
            Array.from({ length: TRACK_PIECES_PER_RAILROAD }, () => railroadId)
        )
        const bag = new HydratedTrackBag({ items, remaining: items.length })
        bag.shuffle(random)
        return bag
    }

    constructor(data: ProjectedTrackBag) {
        super(data, ProjectedTrackBagValidator)
    }
}
