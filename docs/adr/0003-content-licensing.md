# ADR-0003: Only ship standards content we are free to publish

Status: Accepted    Date: 2026-09-16

## Context
The project's value is explaining what data means, but much of the authoritative text lives in licensed documents: HL7 specifications, X12 TR3 implementation guides and code lists, AMA CPT, and NUBC UB-04 manuals. A public repository that copies that content creates legal risk for the maintainer and for every company that forks it.

## Decision
- Use standard **identifiers and names** (segment IDs, field positions and names, data type and table IDs) as references.
- Write every **explanation** (`meaning`, `purpose`, `rcm`) in original words. Don't paste specification text.
- Include **code table values** only when they're commonly published (for example HL7 processing ID P/T/D). Mark organization-configured tables `siteDefined`.
- Mark licensed or very large external code systems `external` (CPT, CPT/HCPCS modifiers, ICD-10-CM, ICD-10-PCS) and don't bundle their descriptions. NUBC-derived HL7 tables (admit source, discharge disposition) are `siteDefined`, with a note pointing users to private profiles.
- For X12 pages (future): use segment and element IDs with original explanations, and treat X12 code list descriptions (e.g. CARC/RARC) as an optional user-loaded pack until redistribution terms are confirmed under X12's licensing program.
- Use only synthetic sample data.
- Code is licensed Apache-2.0, which is enterprise-friendly and includes a patent grant.

## Consequences
- Some values appear as codes without descriptions, and users can add descriptions through private profiles.
- Contributors must follow the rules in CONTRIBUTING.md, and reviewers should reject pasted specification text.
- This isn't legal advice. Maintainers should confirm the HL7 and X12 positions before promoting the project widely.

## Alternatives considered
- **Bundle full code sets and specification text:** best out-of-the-box experience, but unacceptable licensing risk.
- **Keep the repository private:** avoids the question, but defeats the goal of a community resource.
