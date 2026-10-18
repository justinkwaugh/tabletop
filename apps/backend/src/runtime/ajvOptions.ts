import { Visibility } from '@tabletop/common'
import type { AjvCompilerOptions } from './lazyValidation.js'

export const ajvOptions: AjvCompilerOptions = {
    customOptions: { keywords: [Visibility.MetadataKey, Visibility.ScopeKey] },
    plugins: []
}

// Action bodies are validated whole: removing additional properties while AJV tries each
// variant of a union strips the fields of the variant that matches.
export const actionAjvOptions: AjvCompilerOptions = {
    ...ajvOptions,
    customOptions: { ...ajvOptions.customOptions, removeAdditional: false }
}
