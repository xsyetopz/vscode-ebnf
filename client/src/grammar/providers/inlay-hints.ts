import {
	type CancellationToken,
	InlayHint,
	InlayHintKind,
	type InlayHintsProvider,
	type Range,
	type TextDocument,
	workspace,
} from "vscode";
import { normalizeSymbolName } from "../grammar.ts";
import { getSyntaxDetailInlays } from "../syntax-details.ts";
import type { GrammarWorkspace } from "../workspace.ts";

/**
 * VS Code inlay hint provider for grammar rule metadata.
 */
export class GrammarInlayHintsProvider implements InlayHintsProvider {
	readonly #grammarWorkspace: GrammarWorkspace;

	constructor(grammarWorkspace: GrammarWorkspace) {
		this.#grammarWorkspace = grammarWorkspace;
	}

	provideInlayHints(
		doc: TextDocument,
		range: Range,
		_token: CancellationToken,
	): InlayHint[] {
		const { dialect, document, symbolTable } = this.#grammarWorkspace.get(doc);
		const hints: InlayHint[] = [];
		const bnfConfig = workspace.getConfiguration("bnf");
		const abnfConfig = workspace.getConfiguration("abnf");
		const readConfig = <T>(key: string, fallback: T): T =>
			bnfConfig.get<T>(key) ?? abnfConfig.get<T>(key, fallback);

		const showRefCount = readConfig<boolean>(
			"inlayHints.referenceCount",
			false,
		);
		const showRecursion = readConfig<boolean>("inlayHints.recursion", false);
		const showUnused = readConfig<boolean>("inlayHints.unusedMarker", false);
		const showSyntaxDetails = readConfig<boolean>(
			"inlayHints.syntaxDetails",
			false,
		);

		if (!(showRefCount || showRecursion || showUnused || showSyntaxDetails)) {
			return hints;
		}

		for (const rule of document.rules) {
			if (!range.intersection(rule.definitionRange)) {
				continue;
			}

			const parts = buildHintParts(
				rule,
				symbolTable,
				dialect,
				showRefCount,
				showRecursion,
				showUnused,
			);

			if (parts.length > 0) {
				const hint = new InlayHint(
					rule.nameRange.end,
					` ${parts.join(", ")}`,
					InlayHintKind.Parameter,
				);
				hint.paddingLeft = true;
				hints.push(hint);
			}
			if (showSyntaxDetails) {
				hints.push(
					...getSyntaxDetailInlays(
						rule.nameRange.end.line,
						rule.nameRange.end.character,
						rule.definitionText,
						dialect,
					),
				);
			}
		}

		return hints;
	}
}

type ManagerResult = ReturnType<GrammarWorkspace["get"]>;
type GrammarRule = ManagerResult["document"]["rules"][number];

function buildHintParts(
	rule: GrammarRule,
	symbolTable: ManagerResult["symbolTable"],
	dialect: ManagerResult["dialect"],
	showRefCount: boolean,
	showRecursion: boolean,
	showUnused: boolean,
): string[] {
	const parts: string[] = [];

	const key = normalizeSymbolName(rule.name, dialect);
	const refCount = symbolTable.references.get(key)?.length ?? 0;

	if (showRefCount) {
		parts.push(`${refCount} ref${refCount === 1 ? "" : "s"}`);
	}

	if (showRecursion) {
		const isRecursive = rule.references.some(
			(r) => normalizeSymbolName(r.name, dialect) === key,
		);
		if (isRecursive) {
			parts.push("recursive");
		}
	}

	if (showUnused && refCount === 0) {
		parts.push("unused");
	}

	return parts;
}
