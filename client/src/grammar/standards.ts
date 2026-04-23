import type { GrammarDialect } from "./dialects.ts";

/**
 * Metadata for a grammar notation standard exposed by the extension.
 */
export interface GrammarStandardDefinition {
	dialect: GrammarDialect;
	name: string;
	url: string;
	supportedNotation: string;
	exampleFile: string;
}

/**
 * Explanation shown when ISO 14977 EBNF syntax is detected.
 */
export const ISO_14977_NON_SUPPORT =
	"ISO/IEC 14977 EBNF is intentionally unsupported; this extension targets W3C XML EBNF. See https://dwheeler.com/essays/dont-use-iso-14977-ebnf.html";

/**
 * Registry of supported grammar standards and examples.
 */
export const GRAMMAR_STANDARDS: Record<
	GrammarDialect,
	GrammarStandardDefinition
> = {
	abnf: {
		dialect: "abnf",
		name: "ABNF (RFC 5234 + RFC 7405)",
		url: "https://www.rfc-editor.org/rfc/rfc5234",
		supportedNotation:
			"RFC rule names, =, =/, / alternatives, repetition, numeric values, prose values, and RFC 7405 %s/%i strings.",
		exampleFile: "examples/json.abnf",
	},
	bnf: {
		dialect: "bnf",
		name: "BNF (W3C notation)",
		url: "https://www.w3.org/Notation.html",
		supportedNotation:
			"W3C ::=-based productions with | alternatives, literals, grouping, optional, and repetition notation.",
		exampleFile: "examples/json.bnf",
	},
	ebnf: {
		dialect: "ebnf",
		name: "EBNF (W3C XML notation)",
		url: "https://www.w3.org/TR/xml/#sec-notation",
		supportedNotation:
			"W3C XML-style productions with optional production numbers, ::=, |, ?, +, *, character ranges, and /* */ comments.",
		exampleFile: "examples/json.ebnf",
	},
	rbnf: {
		dialect: "rbnf",
		name: "RBNF (RFC 5511)",
		url: "https://datatracker.ietf.org/doc/html/rfc5511",
		supportedNotation:
			"RFC 5511-style ::=-based productions with angle-bracket rule names, including names with spaces.",
		exampleFile: "examples/json.rbnf",
	},
};
