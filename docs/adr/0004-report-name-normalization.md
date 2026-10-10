# Preserve raw reports and normalize statistical views

Daily reports preserve the disease and procedure names entered by staff, while Dashboard statistics resolve these names through a shared Admin-approved mapping to standardized names and symptom or service groups. Rewriting historical report names would lose source evidence, so mappings are stored separately and applied when reading statistics; mapping changes recalculate historical statistics without changing published report versions or drafts.

Mappings match the exact stored name within either diseases or procedures. Suggested mappings remain inactive until an Admin confirms them, and unclassified entries retain their raw names and counts. Historical views lead with raw values; exports retain raw columns for lossless re-import and add separate derived normalization columns. Mapping changes require version checks and an audit record to avoid silently overwriting another Admin's work.
