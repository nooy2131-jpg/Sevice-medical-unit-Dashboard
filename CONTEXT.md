# Medical Unit Reporting

The temporary service unit records daily aggregate activity. Reports contain counts rather than individual patient records.

## Language

**Daily report**:
The unit's aggregate service report for one calendar date. There is one report per date.

**Admin**:
An account with full application access, including managing account roles, importing reports, and deleting reports. The last active Admin cannot be demoted or removed.

**Member**:
An account that can create, edit, view, and export daily reports. Members cannot import or delete reports or manage account roles.

**Invitation**:
An Admin's grant of access to a specific email address. Public registration does not grant access.

**Draft**:
A recoverable, unfinished report belonging to its editor. Editing a draft does not change the shared daily report until Save succeeds.

**Total service count**:
An independently entered count for the reporting date. Service categories may overlap, so their sum does not determine this total.

**Aggregate data**:
Service counts and summary observations without patient identifiers.

**Raw report name**:
The disease or procedure name stored in a daily report as entered by its reporter. Normalization does not replace this historical name.

**Standardized name**:
An Admin-approved name used to combine equivalent raw report names for statistics. A disease name and a procedure name belong to separate sets of mappings.

**Symptom or service group**:
A reporting category that brings related standardized disease or procedure names together. Group membership does not mean that the original entries describe an identical diagnosis or an individual patient.

**Approved mapping**:
An Admin's assignment of one raw report name to a standardized name and group. Suggested assignments have no effect on statistics until approved.

**Unclassified entry**:
A report item without an approved mapping. Its original name and count remain visible in statistics.
