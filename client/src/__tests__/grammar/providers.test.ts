import { beforeAll, describe, expect, test } from "bun:test";
import "../vscode-mock.ts";
import type { TextDocument } from "vscode";
import type { GrammarDialect } from "../../grammar/dialects.ts";
import type { GrammarWorkspace } from "../../grammar/workspace.ts";
import {
	PositionMock,
	RangeMock,
	resetConfigurationValues,
	setConfigurationValue,
	type WorkspaceEditMock,
} from "../vscode-mock.ts";

let buildGrammarSymbolTable: typeof import("../../grammar/grammar.ts").buildGrammarSymbolTable;
let parseGrammar: typeof import("../../grammar/grammar.ts").parseGrammar;
let GrammarCodeActionProvider: typeof import("../../grammar/code-actions.ts").GrammarCodeActionProvider;
let GrammarCompletionProvider: typeof import("../../grammar/completion.ts").GrammarCompletionProvider;
let GrammarDefinitionProvider: typeof import("../../grammar/providers/definition.ts").GrammarDefinitionProvider;
let GrammarDocumentHighlightProvider: typeof import("../../grammar/providers/highlighting.ts").GrammarDocumentHighlightProvider;
let GrammarSemanticTokensProvider: typeof import("../../grammar/semantic-tokens.ts").GrammarSemanticTokensProvider;
let GrammarHoverProvider: typeof import("../../grammar/providers/hover.ts").GrammarHoverProvider;
let GrammarInlayHintsProvider: typeof import("../../grammar/providers/inlay-hints.ts").GrammarInlayHintsProvider;
let GrammarReferenceProvider: typeof import("../../grammar/providers/references.ts").GrammarReferenceProvider;
let GrammarRenameProvider: typeof import("../../grammar/providers/rename.ts").GrammarRenameProvider;

type MockUri = {
	path: string;
	toString(): string;
};

class DocumentMock {
	readonly uri: MockUri;
	readonly version = 1;
	readonly languageId: GrammarDialect;
	readonly lineCount: number;
	readonly fileName: string;
	readonly isUntitled = false;
	readonly encoding = "utf-8";
	readonly isDirty = false;
	readonly isClosed = false;
	readonly eol = 1;
	readonly save = async () => true;
	readonly validateRange = (range: RangeMock) => range;
	readonly validatePosition = (position: PositionMock) => position;
	readonly #text: string;
	readonly #lines: string[];
	readonly #lineOffsets: number[];

	constructor(path: string, text: string, languageId: GrammarDialect) {
		this.uri = {
			path,
			toString: () => `file://${path}`,
		};
		this.#text = text;
		this.languageId = languageId;
		this.fileName = path;
		this.#lines = text.replace(/\r\n/g, "\n").split("\n");
		this.lineCount = this.#lines.length;
		this.#lineOffsets = [];
		let offset = 0;
		for (const line of this.#lines) {
			this.#lineOffsets.push(offset);
			offset += line.length + 1;
		}
	}

	getText(range?: RangeMock): string {
		if (!range) {
			return this.#text;
		}
		return this.#text.slice(
			this.offsetAt(range.start.line, range.start.character),
			this.offsetAt(range.end.line, range.end.character),
		);
	}

	lineAt(line: number): { text: string } {
		return { text: this.#lines[line] ?? "" };
	}

	getWordRangeAtPosition(
		position: PositionMock,
		pattern: RegExp,
	): RangeMock | undefined {
		const line = this.lineAt(position.line).text;
		for (const match of line.matchAll(new RegExp(pattern.source, "g"))) {
			const start = match.index ?? 0;
			const text = match[0] ?? "";
			const end = start + text.length;
			if (position.character >= start && position.character <= end) {
				return new RangeMock(position.line, start, position.line, end);
			}
		}
		return undefined;
	}

	positionAt(offset: number): PositionMock {
		let line = 0;
		while (
			line + 1 < this.#lineOffsets.length &&
			(this.#lineOffsets[line + 1] ?? Number.POSITIVE_INFINITY) <= offset
		) {
			line++;
		}
		return new PositionMock(line, offset - (this.#lineOffsets[line] ?? 0));
	}

	offsetAt(line: number, character: number): number {
		return (this.#lineOffsets[line] ?? 0) + character;
	}
}

function createDocument(
	path: string,
	text: string,
	languageId: GrammarDialect,
): DocumentMock {
	return new DocumentMock(path, text, languageId);
}

function asTextDocument(doc: DocumentMock): TextDocument {
	return doc as unknown as TextDocument;
}

function createWorkspace(
	files: Array<{ path: string; text: string; dialect: GrammarDialect }> = [],
): GrammarWorkspace {
	const indexedFiles = files.map(({ path, text, dialect }) => {
		const document = parseGrammar(text, dialect);
		return {
			uri: {
				path,
				toString: () => `file://${path}`,
			},
			dialect,
			rules: document.rules,
			symbolTable: buildGrammarSymbolTable(document, dialect),
		};
	});

	return {
		findDefinitions(name: string, dialect: GrammarDialect) {
			return indexedFiles.flatMap((file) =>
				file.dialect === dialect
					? file.rules
							.filter((rule) => rule.name.toLowerCase() === name.toLowerCase())
							.map((rule) => ({ uri: file.uri, dialect, rule }))
					: [],
			);
		},
		get(doc: DocumentMock) {
			const dialect = doc.languageId;
			const document = parseGrammar(doc.getText(), dialect);
			return {
				dialect,
				document,
				symbolTable: buildGrammarSymbolTable(document, dialect),
			};
		},
		getAllFiles(dialect?: GrammarDialect) {
			return dialect
				? indexedFiles.filter((file) => file.dialect === dialect)
				: indexedFiles;
		},
	} as unknown as GrammarWorkspace;
}

beforeAll(async () => {
	({ buildGrammarSymbolTable, parseGrammar } = await import(
		"../../grammar/grammar.ts"
	));
	({ GrammarCodeActionProvider } = await import(
		"../../grammar/code-actions.ts"
	));
	({ GrammarCompletionProvider } = await import("../../grammar/completion.ts"));
	({ GrammarDefinitionProvider } = await import(
		"../../grammar/providers/definition.ts"
	));
	({ GrammarDocumentHighlightProvider } = await import(
		"../../grammar/providers/highlighting.ts"
	));
	({ GrammarInlayHintsProvider } = await import(
		"../../grammar/providers/inlay-hints.ts"
	));
	({ GrammarSemanticTokensProvider } = await import(
		"../../grammar/semantic-tokens.ts"
	));
	({ GrammarHoverProvider } = await import("../../grammar/providers/hover.ts"));
	({ GrammarReferenceProvider } = await import(
		"../../grammar/providers/references.ts"
	));
	({ GrammarRenameProvider } = await import(
		"../../grammar/providers/rename.ts"
	));
});

describe("grammar providers", () => {
	test("shows provider-level syntax inlays only when enabled", () => {
		resetConfigurationValues();
		const workspace = createWorkspace();
		const provider = new GrammarInlayHintsProvider(workspace);
		const doc = createDocument(
			"/workspace/main.abnf",
			'root = %x41-5A / %i"abc"\n',
			"abnf",
		);
		const range = new RangeMock(0, 0, 0, 24);

		expect(
			provider.provideInlayHints(
				asTextDocument(doc),
				range as never,
				{} as never,
			),
		).toHaveLength(0);

		setConfigurationValue("bnf.inlayHints.syntaxDetails", true);
		const hints = provider.provideInlayHints(
			asTextDocument(doc),
			range as never,
			{} as never,
		) as Array<{ label: string }>;

		expect(hints).toHaveLength(1);
		expect(hints[0]?.label ?? "").toContain("range");
		expect(hints[0]?.label ?? "").toContain("case-insensitive");
		resetConfigurationValues();
	});

	test("combines metadata and syntax-detail inlays on one rule line", () => {
		resetConfigurationValues();
		setConfigurationValue("bnf.inlayHints.syntaxDetails", true);
		setConfigurationValue("bnf.inlayHints.referenceCount", true);
		const workspace = createWorkspace();
		const provider = new GrammarInlayHintsProvider(workspace);
		const doc = createDocument(
			"/workspace/main.abnf",
			"root = 1*2ALPHA root\n",
			"abnf",
		);
		const hints = provider.provideInlayHints(
			asTextDocument(doc),
			new RangeMock(0, 0, 0, 20) as never,
			{} as never,
		) as Array<{ label: string }>;

		expect(hints).toHaveLength(2);
		expect(hints.some((hint) => hint.label.includes("1 ref"))).toBe(true);
		expect(hints.some((hint) => hint.label.includes("repetition"))).toBe(true);
		resetConfigurationValues();
	});

	test("offers workspace-aware completions and dialect snippets", () => {
		const workspace = createWorkspace([
			{
				path: "/workspace/shared.ebnf",
				text: "shared ::= item\n",
				dialect: "ebnf",
			},
		]);
		const provider = new GrammarCompletionProvider(workspace);
		const doc = createDocument(
			"/workspace/main.ebnf",
			"root ::= shared | local\nlocal ::= 'x'\n",
			"ebnf",
		);
		const items = provider.provideCompletionItems(
			asTextDocument(doc),
			new PositionMock(0, 10) as never,
			{} as never,
		);

		expect(items.some((item) => item.label === "shared")).toBe(true);
		expect(items.find((item) => item.label === "shared")?.detail).toContain(
			"(workspace)",
		);
		expect(items.some((item) => item.label === "production")).toBe(true);
		expect(
			(
				items.find((item) => item.label === "character range")?.insertText as {
					value: string;
				}
			).value,
		).toContain("#x");
	});

	test("shows EBNF character hover and workspace fallback hovers", () => {
		const workspace = createWorkspace([
			{
				path: "/workspace/shared.ebnf",
				text: "shared ::= #x20\n",
				dialect: "ebnf",
			},
		]);
		const provider = new GrammarHoverProvider(workspace);
		const charDoc = createDocument(
			"/workspace/char.ebnf",
			"char ::= #x20\n",
			"ebnf",
		);
		const charHover = provider.provideHover(
			asTextDocument(charDoc),
			new PositionMock(0, 10) as never,
			{} as never,
		);

		expect(
			(charHover?.contents as unknown as { value: string }).value,
		).toContain("not a rule reference");

		const refDoc = createDocument(
			"/workspace/root.ebnf",
			"root ::= shared\n",
			"ebnf",
		);
		const ruleHover = provider.provideHover(
			asTextDocument(refDoc),
			new PositionMock(0, 10) as never,
			{} as never,
		);

		expect(
			(ruleHover?.contents as unknown as { value: string }).value,
		).toContain("shared ::= #x20");
	});

	test("shows built-in ABNF core-rule hover with workspace reference count", () => {
		const workspace = createWorkspace([
			{
				path: "/workspace/other.abnf",
				text: "other = ALPHA\n",
				dialect: "abnf",
			},
		]);
		const provider = new GrammarHoverProvider(workspace);
		const doc = createDocument(
			"/workspace/main.abnf",
			"root = ALPHA\n",
			"abnf",
		);
		const hover = provider.provideHover(
			asTextDocument(doc),
			new PositionMock(0, 8) as never,
			{} as never,
		);
		const text = (hover?.contents as unknown as { value: string }).value;

		expect(text).toContain("Built-in ABNF core rule.");
		expect(text).toContain("References: 2");
		expect(text).toContain("ALPHA = %x41-5A / %x61-7A");
	});

	test("navigates built-in ABNF core-rule definitions and references", () => {
		const workspace = createWorkspace([
			{
				path: "/workspace/other.abnf",
				text: "other = ALPHA\n",
				dialect: "abnf",
			},
		]);
		const definitionProvider = new GrammarDefinitionProvider(workspace);
		const referenceProvider = new GrammarReferenceProvider(workspace);
		const doc = createDocument(
			"/workspace/main.abnf",
			"root = ALPHA\n",
			"abnf",
		);

		const definitions = definitionProvider.provideDefinition(
			asTextDocument(doc),
			new PositionMock(0, 8) as never,
			{} as never,
		) as Array<{ uri: { toString(): string } }>;
		const references = referenceProvider.provideReferences(
			asTextDocument(doc),
			new PositionMock(0, 8) as never,
			{ includeDeclaration: true } as never,
			{} as never,
		) as Array<{ uri: { toString(): string } }>;

		expect(definitions).toHaveLength(1);
		expect(definitions[0]?.uri.toString()).toContain("bnf-core:");
		expect(references).toHaveLength(3);
		expect(references[0]?.uri.toString()).toContain("bnf-core:");
	});

	test("prefers local ABNF rules over core-rule fallback", () => {
		const workspace = createWorkspace();
		const provider = new GrammarHoverProvider(workspace);
		const doc = createDocument(
			"/workspace/main.abnf",
			'root = ALPHA\nALPHA = "x"\n',
			"abnf",
		);
		const hover = provider.provideHover(
			asTextDocument(doc),
			new PositionMock(0, 8) as never,
			{} as never,
		);
		const text = (hover?.contents as unknown as { value: string }).value;

		expect(text).toContain('ALPHA = "x"');
		expect(text).not.toContain("Built-in ABNF core rule.");
		expect(text).not.toContain("Not user-defined.");
	});

	test("produces semantic tokens for operators, strings, classes, and references", () => {
		const workspace = createWorkspace();
		const provider = new GrammarSemanticTokensProvider(workspace);
		const doc = createDocument(
			"/workspace/semantic.ebnf",
			'root ::= [#x20-#x21] | "x" | other\nother ::= #xA\n',
			"ebnf",
		);
		const result = provider.provideDocumentSemanticTokens(
			asTextDocument(doc),
			{} as never,
		) as unknown as {
			data: Array<{ tokenType: string; tokenModifiers: readonly string[] }>;
		};

		expect(result.data.some((entry) => entry.tokenType === "operator")).toBe(
			true,
		);
		expect(result.data.some((entry) => entry.tokenType === "string")).toBe(
			true,
		);
		expect(result.data.some((entry) => entry.tokenType === "regexp")).toBe(
			true,
		);
		expect(result.data.some((entry) => entry.tokenType === "number")).toBe(
			true,
		);
		expect(result.data.some((entry) => entry.tokenType === "parameter")).toBe(
			true,
		);
		expect(
			result.data.some(
				(entry) =>
					entry.tokenType === "type" &&
					entry.tokenModifiers.includes("definition"),
			),
		).toBe(true);
	});

	test("offers ISO assignment replacement quick fix", () => {
		const provider = new GrammarCodeActionProvider();
		const doc = createDocument(
			"/workspace/root.ebnf",
			"root = value\n",
			"ebnf",
		);
		const diagnostic = {
			message: "W3C XML EBNF requires '::=' instead of '='",
			range: new RangeMock(0, 5, 0, 6),
		};
		const actions =
			provider.provideCodeActions(
				asTextDocument(doc),
				new RangeMock(0, 0, 0, 0) as never,
				{ diagnostics: [diagnostic] } as never,
				{} as never,
			) ?? [];
		const edit = actions[0]?.edit as unknown as WorkspaceEditMock;

		expect(actions[0]?.title).toBe("Replace '=' with '::='");
		expect(edit.replacements[0]?.text).toBe("::=");
	});

	test("renames one symbol across same-dialect workspace files", () => {
		const workspace = createWorkspace([
			{
				path: "/workspace/shared.ebnf",
				text: "shared ::= item\n",
				dialect: "ebnf",
			},
			{
				path: "/workspace/other.ebnf",
				text: "entry ::= shared\n",
				dialect: "ebnf",
			},
		]);
		const provider = new GrammarRenameProvider(workspace);
		const doc = createDocument(
			"/workspace/main.ebnf",
			"root ::= shared\nshared ::= item\n",
			"ebnf",
		);
		const edit = provider.provideRenameEdits(
			asTextDocument(doc),
			new PositionMock(0, 10) as never,
			"renamed",
			{} as never,
		) as unknown as WorkspaceEditMock;

		expect(edit.replacements).toHaveLength(4);
		expect(
			edit.replacements.every((replacement) => replacement.text === "renamed"),
		).toBe(true);
	});

	test("collects references across files and can omit declarations", () => {
		const workspace = createWorkspace([
			{
				path: "/workspace/other.ebnf",
				text: "entry ::= shared\n",
				dialect: "ebnf",
			},
		]);
		const provider = new GrammarReferenceProvider(workspace);
		const doc = createDocument(
			"/workspace/main.ebnf",
			"root ::= shared\nshared ::= item\n",
			"ebnf",
		);

		const withDeclarations = provider.provideReferences(
			asTextDocument(doc),
			new PositionMock(0, 10) as never,
			{ includeDeclaration: true } as never,
			{} as never,
		);
		const withoutDeclarations = provider.provideReferences(
			asTextDocument(doc),
			new PositionMock(0, 10) as never,
			{ includeDeclaration: false } as never,
			{} as never,
		);

		expect(withDeclarations).toHaveLength(3);
		expect(withoutDeclarations).toHaveLength(2);
	});

	test("finds workspace definitions but keeps highlights document-local", () => {
		const workspace = createWorkspace([
			{
				path: "/workspace/shared.ebnf",
				text: "shared ::= item\n",
				dialect: "ebnf",
			},
		]);
		const definitionProvider = new GrammarDefinitionProvider(workspace);
		const highlightProvider = new GrammarDocumentHighlightProvider(workspace);
		const doc = createDocument(
			"/workspace/main.ebnf",
			"root ::= shared\n",
			"ebnf",
		);

		const definitions = definitionProvider.provideDefinition(
			asTextDocument(doc),
			new PositionMock(0, 10) as never,
			{} as never,
		) as Array<{ uri: { toString(): string } }>;
		const highlights = highlightProvider.provideDocumentHighlights(
			asTextDocument(doc),
			new PositionMock(0, 10) as never,
			{} as never,
		) as Array<{ kind: number }>;

		expect(definitions).toHaveLength(1);
		expect(definitions[0]?.uri.toString()).toBe(
			"file:///workspace/shared.ebnf",
		);
		expect(highlights).toHaveLength(1);
	});

	test("rejects invalid rename targets and syntax-only positions", () => {
		const workspace = createWorkspace();
		const provider = new GrammarRenameProvider(workspace);
		const doc = createDocument(
			"/workspace/main.ebnf",
			"root ::= #x20 shared\nshared ::= item\n",
			"ebnf",
		);

		expect(
			provider.prepareRename(
				asTextDocument(doc),
				new PositionMock(0, 10) as never,
				{} as never,
			),
		).toBeUndefined();
		expect(
			provider.provideRenameEdits(
				asTextDocument(doc),
				new PositionMock(0, 18) as never,
				"bad name",
				{} as never,
			),
		).toBeUndefined();
	});
});
