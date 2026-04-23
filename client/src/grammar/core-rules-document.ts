import { Location, Range, Uri } from "vscode";
import { CORE_RULE_DEFINITIONS } from "../abnf/core-rules.ts";

/**
 * URI scheme for synthetic ABNF core-rule documents.
 */
export const BNF_CORE_RULES_SCHEME = "bnf-core";

const CORE_RULES_URI = Uri.parse(
	`${BNF_CORE_RULES_SCHEME}:/abnf-core-rules.abnf`,
);

/**
 * Returns the readonly virtual document URI for ABNF core rules.
 */
export function coreRulesDocumentUri(): Uri {
	return CORE_RULES_URI;
}

/**
 * Renders the synthetic ABNF core-rule document contents.
 */
export function renderCoreRulesDocument(): string {
	return CORE_RULE_DEFINITIONS.map(
		(rule) => `${rule.name} = ${rule.definitionText}`,
	).join("\n");
}

/**
 * Returns the virtual definition location for one ABNF core rule.
 */
export function coreRuleDefinitionLocation(name: string): Location | undefined {
	const line = CORE_RULE_DEFINITIONS.findIndex(
		(rule) => rule.name.toLowerCase() === name.toLowerCase(),
	);
	if (line < 0) {
		return undefined;
	}
	return new Location(
		CORE_RULES_URI,
		new Range(line, 0, line, CORE_RULE_DEFINITIONS[line]?.name.length ?? 0),
	);
}
