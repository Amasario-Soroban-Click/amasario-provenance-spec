# Pull request

## What this changes

<!-- One or two sentences. What is now representable, or what is now correct. -->

## Why

<!--
The motivation matters more than the diff here. If something could not be
represented before, say what went wrong as a result. If something was wrong,
quote the statement it contradicts.
-->

## Kind of change

- [ ] Normative — alters what the specification means (`schema/`, `models/`, `taxonomies/`, `rules/`, `fixtures/`, `vectors/`, `examples/`)
- [ ] Tooling — validation, CI, or documentation (does not alter meaning)
- [ ] Editorial — typos, clarifications, formatting (no effect on validation or digests)

## Versioning classification

<!-- Required for a normative change. See VERSIONING.md for the rules. -->

- [ ] **Breaking (MAJOR)** — required property added, removed or renamed; a type or meaning changed; an enumeration term removed or narrowed; a rule now rejects previously valid content; canonical serialisation or digest input changed.
- [ ] **Additive (MINOR)** — new optional property; new term in an **open** taxonomy; new schema, model, taxonomy, rule, fixture, vector or example; a rule relaxed to accept strictly more.
- [ ] **Editorial (PATCH)** — documentation, formatting, or a toolchain bump that cannot change a result.
- [ ] Not applicable (no normative content touched).

If you selected breaking: what existing valid documents stop validating, and what
replaces them?

## Consistency across the layers

<!-- CI enforces all four; confirming here saves a review round. -->

- [ ] Every term I added to a schema exists in the taxonomy that owns it.
- [ ] Every rule id I referenced exists as a file in `rules/`.
- [ ] Every model I added or changed describes only fields the schema defines.
- [ ] Every new normative artefact is exercised by a fixture, vector or example.
- [ ] `npm run docs:generate` has been run, and `docs/generated/` is committed.

## Evidence for a new relationship or claim

<!--
Only if this PR introduces or widens a dependency, provenance or impact claim.
A dependency that does not state its basis will be rejected, so state it here too.
-->

- **Basis:** <!-- DECLARED_MANIFEST / RESOLVED_LOCKFILE / OBSERVED_INVOCATION / OBSERVED_EVENT / EMBEDDED_DIGEST / CONFIGURED_ENDPOINT / ATTESTED / INFERRED_INTERFACE -->
- **Evidence:** <!-- the fixture, vector or example that carries it -->
- **Confidence ceiling:** <!-- why this basis cannot support more, if it cannot -->

## Verification

- [ ] `npm run format:check`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run validate`
- [ ] `npm run docs:check`
- [ ] `npm run test`
- [ ] `npm run release:check`

<!-- Paste the final lines of each command if any of them printed something other than PASS. -->

## Boundaries

- [ ] This change does **not** introduce a security judgement. No term means `secure`, `safe`, `malicious`, `vulnerable`, `audited` or `certified`.
- [ ] This change does **not** add execution logic or network access to the specification.
- [ ] This change does **not** add a placeholder, stub, empty directory, simulated result or documentation describing a feature that does not exist as an artefact.
- [ ] No credential, private key, seed phrase or private source code is included.
