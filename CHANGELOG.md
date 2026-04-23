# Changelog

All notable changes to this extension will be documented in this file.

## [0.1.0] - 2026-04-23

Whole-extension reset release.

### Added

- Support for four grammar families:
  - ABNF (`.abnf`) via RFC 5234 and RFC 7405
  - BNF (`.bnf`) via W3C BNF notation
  - EBNF (`.ebnf`) via strict W3C XML EBNF
  - RBNF (`.rbnf`) via RFC 5511
- Syntax highlighting, semantic highlighting, hover, definition, references, rename, symbols, inlay hints, diagnostics, formatting, and snippets across supported dialects.
- Workspace-aware rule navigation and completion.
- Built-in ABNF core-rule hover and navigation support.
- JSON example grammars for all four supported notations.

### Changed

- Extension renamed and repositioned as a BNF-family grammar extension.
- EBNF support now targets W3C XML EBNF only.
- New primary settings namespace uses `bnf.*`, with `abnf.*` kept as legacy aliases where applicable.

### Fixed

- W3C EBNF character syntax like `#x20` and `[#x20-#x21]` no longer reports false undefined-rule diagnostics.
- Highlighting and tokenization for spaced rule names and mixed grammar constructs made consistent across dialects.
- Formatter behavior aligned across grammar families with configurable layout controls.
