# Explicit Save and independent service totals

Keep recoverable drafts separate from the shared daily report; only explicit Save publishes a change. The current form immediately overwrites stored reports while typing and resetting, which is unsafe for shared persistence. Detect stale report versions rather than silently replacing another editor's changes.

Enter total male and female service counts independently. Service categories may overlap, so summing categories cannot reliably derive the total. Reports remain one per reporting date for this unit and contain aggregate information without patient identifiers.

Admin deletion uses a tombstone on the unique reporting date. The row remains with its version incremented and `deletedAt` set, so a stale editor cannot recreate or update an older version after deletion. A deliberate new Save or import with expected version `0` can resurrect that tombstone and increments the version again. Drafts have a separate private `revision` CAS counter; `expectedVersion` continues to identify the published report version the draft was based on.
