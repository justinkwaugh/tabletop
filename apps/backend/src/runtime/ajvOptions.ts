import { Visibility } from '@tabletop/common'
import type { AjvCompilerOptions } from './lazyValidation.js'

export const ajvOptions: AjvCompilerOptions = {
    customOptions: { keywords: [Visibility.MetadataKey, Visibility.ScopeKey] },
    plugins: []
}
