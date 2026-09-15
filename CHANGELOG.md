# Changelog

All notable changes to the Amasario provenance specification are documented in
this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this specification adheres to [Semantic Versioning](https://semver.org/).
The meaning of `MAJOR`, `MINOR` and `PATCH` for this repository is defined
normatively in `VERSIONING.md`; it is stricter than generic SemVer because
removing a taxonomy term or changing a canonical digest input is a breaking
change.

## [Unreleased]

### Added

- Repository foundations: Apache-2.0 license, specification versioning strategy
  (`VERSIONING.md`), governance model (`GOVERNANCE.md`), contribution guide
  (`CONTRIBUTING.md`) and security posture (`SECURITY.md`).
- Strict TypeScript validation toolchain: NodeNext type checking with
  `verbatimModuleSyntax` and `noUncheckedIndexedAccess`, type-aware ESLint using
  the typescript-eslint strict rule set, and Prettier formatting, wired into a
  single `npm run ci` aggregate that mirrors the GitHub Actions pipeline.

### Notes

- Nothing in this changelog claims functionality that is not present in the
  repository. Each entry is added by the commit that introduces the artefact it
  describes.
