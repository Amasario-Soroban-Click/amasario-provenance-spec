# Amasario Specification Versioning

This document is normative for `amasario-provenance-spec`. It defines how the
specification itself is versioned, what counts as a breaking change, and how the
`amasario-provenance-engine` determines which specification version produced a
given document.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHOULD**,
**SHOULD NOT**, **RECOMMENDED**, **MAY** and **OPTIONAL** in this document are to
be interpreted as described in
[RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

---

## 1. Two independent version numbers

Amasario uses two version numbers that MUST NOT be conflated.

| Version                   | Meaning                                                                          | Where it lives                                                              |
| ------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Specification version** | The version of the normative model: schemas, taxonomies, models, rules, vectors. | `package.json` → `version`; `specVersion` field on every produced document. |
| **`apiVersion`**          | The major-version compatibility family of a document.                            | The `apiVersion` field on every Amasario document.                          |

The specification version follows Semantic Versioning 2.0.0. The `apiVersion` is
the compatibility family and changes **only** on a major specification release.

`apiVersion` is always the string `amasario.dev/v1` for specification `1.y.z`.
It exists so that a consumer can reject a document from an incompatible family
_before_ attempting to interpret any field, including fields it does not know.

---

## 2. Semantic versioning rules

Given `MAJOR.MINOR.PATCH`:

### MAJOR — breaking change

A release MUST increment `MAJOR` and MUST change `apiVersion` when any of the
following occurs:

- A required property is added, removed or renamed.
- A property's type or the meaning of a property changes.
- An enumeration term is removed, or its meaning is narrowed.
- A file is removed from `schema/`, `models/`, `taxonomies/` or `rules/`.
- An existing rule is replaced with one that rejects content previously accepted.
- A canonical serialisation or digest input changes, so previously published
  digests no longer reproduce.

### MINOR — additive change

A release MUST increment `MINOR` when the specification is extended without
invalidating existing valid content:

- A new optional property is added.
- A new enumeration term is added to a taxonomy that is documented as _open_.
- A new schema, model, taxonomy, rule, fixture, vector or example is added.
- An existing rule is relaxed so it accepts strictly more content.

### PATCH — editorial change

A release MUST increment `PATCH` for changes that cannot affect validation
outcomes or digests:

- Documentation improvements, typo fixes, clarifications.
- Formatting-only changes to YAML/JSON artefacts that preserve semantics.
- Dependency bumps inside the validation toolchain that do not alter results.

---

## 3. Open and closed taxonomies

Each taxonomy in `taxonomies/` declares a `openness` field:

| Value    | Meaning                                                                                                                                                                          |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `closed` | Consumers MAY rely on the term set being exhaustive. Adding a term is a **MAJOR** change.                                                                                        |
| `open`   | Consumers MUST handle unknown terms without failing, and MUST treat them as `UNKNOWN` for the purpose of confidence and impact calculation. Adding a term is a **MINOR** change. |

A consumer that encounters an unknown term in a `closed` taxonomy MUST reject the
document rather than guess. Silently interpreting an unknown term as a known one
is prohibited, because doing so could corrupt an impact analysis.

---

## 4. How the engine identifies the producing specification version

Every Amasario document that is produced by tooling MUST carry:

```yaml
apiVersion: amasario.dev/v1
specVersion: 1.0.0
```

- `apiVersion` is checked first. An unknown family is a hard rejection.
- `specVersion` is then compared against the version the consumer supports.
- `specVersion` MUST be a valid SemVer string. A consumer MUST NOT assume
  ordering across an `apiVersion` boundary.

A consumer that supports `1.0.0` MUST accept `1.4.2` and MUST NOT accept
`2.0.0`, because the minor version is additive by definition.

---

## 5. Unknown fields

Amasario schemas are deliberately **closed** for objects that carry normative
meaning: they set `additionalProperties: false` unless a field is explicitly
documented as an extension point.

Extension points are named explicitly and are the only places where unknown
fields are permitted. An extension point is always an object whose properties are
documented as consumer-defined. Unknown fields anywhere else MUST cause
validation failure.

This rule exists because a silently ignored field is indistinguishable from a
correctly handled one, and an analysis that quietly drops evidence is worse than
an analysis that refuses to run.

---

## 6. Deprecation

1. A field or term MUST be documented as deprecated in `CHANGELOG.md` for at
   least one MINOR release before it may be removed.
2. A deprecated field MUST remain accepted and MUST remain valid for the whole
   deprecation window.
3. Removal is a MAJOR change and MUST be listed under the `Removed` heading with
   the replacement documented.

---

## 7. Digests and canonicalisation

Where a digest is defined over an Amasario document, the digest MUST be computed
over the **canonical JSON serialisation** defined by this specification:

1. Object keys sorted by Unicode code point.
2. No insignificant whitespace.
3. Numbers serialised in shortest round-trippable form.
4. `null` retained; absent properties omitted (not emitted as `null`).
5. UTF-8 encoding, no BOM.

Because rule 1 and rule 3 are part of the digest definition, no PATCH release may
change them, and changing them is a MAJOR change. This is what allows the
`vectors/` suite to be deterministic across implementations.

---

## 8. Release process

A release MUST be produced only from a commit where all of the following hold:

1. `npm run validate` passes.
2. `npm run test` passes.
3. `npm run docs:check` passes.
4. `scripts/release-check.ts` passes, verifying that `package.json#version`,
   `CHANGELOG.md` and `VERSIONING.md` agree.
5. The published schema `$id` values are stable for the release family.

The authoritative record of what changed is `CHANGELOG.md`.
