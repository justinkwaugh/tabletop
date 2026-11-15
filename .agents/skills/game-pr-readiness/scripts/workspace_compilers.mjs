// The compilers come from the workspace's shared library, never the title under review.
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'

export function workspaceRequire(uiRoot) {
    return createRequire(join(resolve(uiRoot), '../../libs/frontend-components/package.json'))
}
