import { Range } from "vscode";
import type { Rule } from "../types.ts";

const CORE_RANGE = new Range(0, 0, 0, 0);

function coreRule(name: string, definitionText: string): Rule {
	return {
		name,
		nameRange: CORE_RANGE,
		definitionRange: CORE_RANGE,
		definitionText,
		isCoreRule: true,
		references: [],
	};
}

/**
 * Ordered RFC 5234 Appendix B core rules.
 */
export const CORE_RULE_DEFINITIONS: readonly Rule[] = [
	coreRule("ALPHA", "%x41-5A / %x61-7A"),
	coreRule("BIT", '"0" / "1"'),
	coreRule("CHAR", "%x01-7F"),
	coreRule("CR", "%x0D"),
	coreRule("CRLF", "CR LF"),
	coreRule("CTL", "%x00-1F / %x7F"),
	coreRule("DIGIT", "%x30-39"),
	coreRule("DQUOTE", "%x22"),
	coreRule("HEXDIG", 'DIGIT / "A" / "B" / "C" / "D" / "E" / "F"'),
	coreRule("HTAB", "%x09"),
	coreRule("LF", "%x0A"),
	coreRule("LWSP", "*(WSP / CRLF WSP)"),
	coreRule("OCTET", "%x00-FF"),
	coreRule("SP", "%x20"),
	coreRule("VCHAR", "%x21-7E"),
	coreRule("WSP", "SP / HTAB"),
] as const;

/** Map of lowercase core rule name to Rule object */
export const CORE_RULES: ReadonlyMap<string, Rule> = new Map(
	CORE_RULE_DEFINITIONS.map((r) => [r.name.toLowerCase(), r]),
);

/** Set of lowercase core rule names for quick lookups */
export const CORE_RULE_NAMES: ReadonlySet<string> = new Set(
	CORE_RULE_DEFINITIONS.map((r) => r.name.toLowerCase()),
);
