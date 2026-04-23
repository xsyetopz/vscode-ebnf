# BNF-family Syntax Highlighting and Intellisense

VS Code support for BNF-family grammar files: ABNF, BNF, EBNF, and RBNF.

## Supported standards

| Language | Files   | Standard                                                                                                       | Scope                                                                                                                         |
| -------- | ------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| ABNF     | `.abnf` | [RFC 5234](https://www.rfc-editor.org/rfc/rfc5234) + [RFC 7405](https://datatracker.ietf.org/doc/html/rfc7405) | Protocol grammar notation with core rules, numeric values, repetitions, incremental alternatives, and case-sensitive strings. |
| BNF      | `.bnf`  | [W3C BNF notation](https://www.w3.org/Notation.html)                                                           | `::=` productions with alternatives, grouping, optional parts, repetitions, and literals.                                     |
| EBNF     | `.ebnf` | [W3C XML 1.0 EBNF notation](https://www.w3.org/TR/xml/#sec-notation)                                           | Strict XML-style notation with production numbers, `::=`, `?`, `+`, `*`, char classes, and exclusions.                        |
| RBNF     | `.rbnf` | [RFC 5511](https://datatracker.ietf.org/doc/html/rfc5511)                                                      | Routing BNF notation with angle-bracket rule names, including names with spaces.                                              |

ISO/IEC 14977 EBNF is intentionally unsupported. This extension targets W3C XML EBNF and reports ISO-style `=` productions in `.ebnf` files. Rationale: https://dwheeler.com/essays/dont-use-iso-14977-ebnf.html

## Features

- Syntax highlighting for `.abnf`, `.bnf`, `.ebnf`, and `.rbnf`.
- Semantic highlighting for full rule definition/reference ranges.
- Go to Definition, Find References, Rename, Hover, Document Symbols, Workspace Symbols.
- Diagnostics for undefined references, duplicate definitions, unused rules, empty bodies, and dialect-specific syntax mistakes.
- Formatting with aligned assignments and grammar-safe preservation.
- Markdown fenced code block highlighting for `abnf`, `bnf`, `ebnf`, and `rbnf`.

RBNF angle-bracket identifiers are one symbol, even when names contain spaces. Rules like `<WF flow descriptor>` and `<SE flow descriptor>` highlight, rename, and resolve independently.

## Equal JSON examples

Full examples live in:

- [`examples/json.abnf`](examples/json.abnf)
- [`examples/json.bnf`](examples/json.bnf)
- [`examples/json.ebnf`](examples/json.ebnf)
- [`examples/json.rbnf`](examples/json.rbnf)

### ABNF

```abnf
json-text = ws value ws
value = object / array / string / number / true / false / null
object = begin-object ws [member *(ws value-separator ws member)] ws end-object
```

### W3C BNF

```bnf
<json-text> ::= <ws> <value> <ws>
<value> ::= <object> | <array> | <string> | <number> | "true" | "false" | "null"
<object> ::= "{" <ws> [<member> {<ws> "," <ws> <member>}] <ws> "}"
```

### W3C XML EBNF

```ebnf
[1] json-text ::= ws value ws
[2] value ::= object | array | string | number | "true" | "false" | "null"
[3] object ::= "{" ws (member (ws "," ws member)*)? ws "}"
```

### RBNF

```rbnf
<JSON text> ::= <WS> <value> <WS>
<value> ::= <object> | <array> | <string> | <number> | "true" | "false" | "null"
<object> ::= "{" <WS> [<member> *(<WS> "," <WS> <member>)] <WS> "}"
```

## Settings

New settings use the `bnf.*` prefix. Existing `abnf.*` settings remain as legacy aliases for ABNF users.

| Setting                                 | Default | Description                              |
| --------------------------------------- | ------- | ---------------------------------------- |
| `bnf.diagnostics.enable`                | `true`  | Enable diagnostics.                      |
| `bnf.diagnostics.unusedRules`           | `true`  | Mark unused rules.                       |
| `bnf.diagnostics.undefinedReferences`   | `true`  | Report undefined references.             |
| `bnf.formatting.alignEquals`            | `true`  | Align assignment operators across rules. |
| `bnf.formatting.blankLinesBetweenRules` | `1`     | Blank lines between consecutive rules.   |
| `bnf.formatting.insertFinalNewline`     | `true`  | Insert final newline.                    |
| `bnf.inlayHints.referenceCount`         | `false` | Show reference counts.                   |
| `bnf.inlayHints.recursion`              | `false` | Mark directly recursive rules.           |
| `bnf.inlayHints.unusedMarker`           | `false` | Mark unused rules inline.                |

## Development

```bash
bun install
bun test
bun run typecheck
bun run build
```

## License

[MIT](LICENSE)
