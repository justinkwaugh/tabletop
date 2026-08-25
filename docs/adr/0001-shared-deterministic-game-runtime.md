# Run one deterministic Game Runtime on server and clients

The server and clients execute the same Game Runtime module rather than maintaining separate implementations. This avoids round-trip latency during play and permits hotseat games without a server; deterministic execution ensures that the same initial Game State and ordered Actions produce identical results and System Action cascades in every environment.
