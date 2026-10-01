import { actionFiles } from './imageManifest.generated.js'

import { ActionType } from '@tabletop/oath'
import { indexByName } from './manifestIndex.js'

// Only R-5's six major actions print a symbol; R-6's minor actions share one block, so `undefined` is normal.
const byActionType = new Map(
    [...indexByName(actionFiles)].map(([name, url]) => [name.replace(/^action\./, ''), url])
)

export function actionImage(type: ActionType): string | undefined {
    return byActionType.get(type)
}

export function actionImageKeys(): string[] {
    return [...byActionType.keys()]
}
