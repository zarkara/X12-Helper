# ADR-0002: Separate meaning (dictionaries and profiles) from rendering code

Status: Accepted    Date: 2026-09-16

## Context
Every healthcare interface deviates from the base standard: Z-segments, repurposed fields, site-defined code tables, companion-guide rules. Companies that fork this project need to add that knowledge without learning or modifying the rendering code, and without merge conflicts when pulling upstream improvements.

## Decision
- Each standard has a **base dictionary** (plain data: segments, fields, data types, tables, message types).
- Vendor differences are expressed as **profiles**: partial dictionaries with `id`, `standard` and `name`, merged on top of the base in activation order.
- The merge is field-level for segments and code-level for tables. Profile-provided entries carry `source` (the profile name), and the page shows it as a badge.
- Profiles load either by `<script>` tag (committed in a fork) or at runtime from a JSON file (kept private).
- The page can generate a **profile stub** listing everything it couldn't explain. The stub contains structure and site-defined code values only, never field contents.
- The shared shell talks to each standard through a small adapter: `parse`, `recordLabel`, `renderRecord`, `renderEnvelope`, `collectUnknowns`.

## Consequences
- The dictionary and profile schema is a **public contract**. Changing key names breaks forks, so changes must be additive or come with a migration note.
- Forks typically touch only `profiles/` and one script tag, so pulling upstream stays conflict-free.
- Profiles can't change rendering behavior. If a vendor needs custom rendering, that's a signal to extend the schema, not to add plug-in code.

## Schema additions since this decision

- `typeFrom` (2026-09-18): a field whose data type is named by another field in the same segment, added for OBX-5, which takes its type from OBX-2. Additive, so existing profiles keep working.

## Alternatives considered
- **Forks edit `dictionary.js` directly:** simple, but it creates merge conflicts and hides which meanings are vendor-specific.
- **Plug-in rendering hooks per vendor:** more flexible, but speculative. There's no second consumer yet, and it would let untrusted code into a PHI-handling page.
