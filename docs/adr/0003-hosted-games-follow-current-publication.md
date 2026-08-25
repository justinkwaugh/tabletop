# Hosted Games follow the current Game Title Publication

Hosted Games reference a stable Game Title and always run its current Publication rather than pinning Logic or UI Artifact versions. This avoids retaining and routing historical runtimes, but makes every new Logic Artifact responsible for operational compatibility with surviving Games’ latest canonical State; patch-based Undo and backward History Navigation remain reliable, while forward replay and Fork compatibility are not guaranteed.
