import {
	type CancellationToken,
	Hover,
	type HoverProvider,
	MarkdownString,
	type Position,
	type TextDocument,
} from "vscode";
import { CORE_RULES } from "../../abnf/core-rules.ts";
import { getGrammarDialectDescriptor } from "../dialects.ts";
import { normalizeSymbolName } from "../grammar.ts";
import { getSyntaxHover } from "../syntax-details.ts";
import type { GrammarWorkspace } from "../workspace.ts";
import { collectWorkspaceReferenceCount } from "./symbol-locations.ts";
import { getWordLookup } from "./word-at-position.ts";

/**
 * VS Code hover provider for grammar rule definitions.
 */
export class GrammarHoverProvider implements HoverProvider {
	readonly #grammarWorkspace: GrammarWorkspace;

	constructor(grammarWorkspace: GrammarWorkspace) {
		this.#grammarWorkspace = grammarWorkspace;
	}

	provideHover(
		doc: TextDocument,
		position: Position,
		_token: CancellationToken,
	): Hover | undefined {
		const syntaxHover = getSyntaxHover(
			doc.lineAt(position.line).text,
			position.line,
			position.character,
			doc.languageId as never,
		);
		if (syntaxHover) {
			return syntaxHover;
		}

		const lookup = getWordLookup(doc, position, this.#grammarWorkspace);
		if (!lookup) {
			return undefined;
		}

		const definitions = lookup.symbolTable.definitions.get(lookup.word);
		const workspaceDefinitions =
			definitions && definitions.length > 0
				? definitions
				: this.#grammarWorkspace
						.findDefinitions(lookup.word, lookup.dialect)
						.map((entry) => entry.rule);
		const coreRule =
			lookup.dialect === "abnf" && workspaceDefinitions.length === 0
				? CORE_RULES.get(lookup.word)
				: undefined;
		if (workspaceDefinitions.length === 0 && !coreRule) {
			return undefined;
		}

		const descriptor = getGrammarDialectDescriptor(lookup.dialect);
		const key = normalizeSymbolName(lookup.word, lookup.dialect);
		const refCount = collectWorkspaceReferenceCount(
			this.#grammarWorkspace,
			key,
			lookup.dialect,
			doc.uri.toString(),
			lookup.symbolTable,
		);
		const parts = [
			`**${descriptor.displayName} rule** · ${descriptor.standardName}`,
			`References: ${refCount}`,
		];
		if (coreRule) {
			parts.push("Built-in ABNF core rule.");
			parts.push("Not user-defined. Create/rename actions do not apply.");
		}

		const fence = "```";
		for (const rule of coreRule ? [coreRule] : workspaceDefinitions) {
			parts.push(
				`${fence}${lookup.dialect}\n${rule.name} ${descriptor.assignmentOperator} ${rule.definitionText}\n${fence}`,
			);
			if (rule.precedingComment) {
				parts.push(rule.precedingComment);
			}
		}

		return new Hover(
			new MarkdownString(parts.join("\n\n---\n\n")),
			lookup.wordRange,
		);
	}
}
