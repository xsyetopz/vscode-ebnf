import {
	type Disposable,
	type FileSystemWatcher,
	type TextDocument,
	type Uri,
	workspace,
} from "vscode";
import type { GrammarDocument, Rule, SymbolTable } from "../types.ts";
import {
	buildGrammarSymbolTable,
	type GrammarDialect,
	grammarDialectFromLanguageId,
	grammarDialectFromPath,
	normalizeSymbolName,
	parseGrammar,
} from "./grammar.ts";

/**
 * Workspace index entry for a grammar rule definition.
 */
export interface IndexedRule {
	uri: Uri;
	dialect: GrammarDialect;
	rule: Rule;
}

interface CachedParse {
	version: number;
	dialect: GrammarDialect;
	document: GrammarDocument;
	symbolTable: SymbolTable;
}

interface IndexedFile {
	uri: Uri;
	dialect: GrammarDialect;
	rules: Rule[];
	symbolTable: SymbolTable;
}

/**
 * Owns parse caches and workspace-wide grammar indexes.
 */
export class GrammarWorkspace implements Disposable {
	readonly #parseCache = new Map<string, CachedParse>();
	readonly #debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
	readonly #index = new Map<string, IndexedRule[]>();
	readonly #fileToNames = new Map<string, Set<string>>();
	readonly #fileData = new Map<string, IndexedFile>();
	#watcher: FileSystemWatcher | undefined;

	async initialize(): Promise<void> {
		const files = await workspace.findFiles(FILE_GLOB);
		await Promise.all(files.map((uri) => this.#indexFile(uri)));
		this.#watcher = workspace.createFileSystemWatcher(FILE_GLOB);
		this.#watcher.onDidCreate((uri) => this.#indexFile(uri));
		this.#watcher.onDidChange((uri) => this.#reindexFile(uri));
		this.#watcher.onDidDelete((uri) => this.#removeIndexedFile(uri));
	}

	get(doc: TextDocument): {
		dialect: GrammarDialect;
		document: GrammarDocument;
		symbolTable: SymbolTable;
	} {
		const uri = doc.uri.toString();
		const dialect = grammarDialectFromLanguageId(doc.languageId);
		const cached = this.#parseCache.get(uri);
		if (
			cached &&
			cached.version === doc.version &&
			cached.dialect === dialect
		) {
			return {
				dialect: cached.dialect,
				document: cached.document,
				symbolTable: cached.symbolTable,
			};
		}
		const document = parseGrammar(doc.getText(), dialect);
		const symbolTable = buildGrammarSymbolTable(document, dialect);
		this.#parseCache.set(uri, {
			version: doc.version,
			dialect,
			document,
			symbolTable,
		});
		return { dialect, document, symbolTable };
	}

	scheduleReparse(
		doc: TextDocument,
		callback: (doc: TextDocument) => void,
	): void {
		const uri = doc.uri.toString();
		const existing = this.#debounceTimers.get(uri);
		if (existing) {
			clearTimeout(existing);
		}
		this.#debounceTimers.set(
			uri,
			setTimeout(() => {
				this.#debounceTimers.delete(uri);
				callback(doc);
			}, 200),
		);
	}

	removeDocument(uri: string): void {
		this.#parseCache.delete(uri);
		const timer = this.#debounceTimers.get(uri);
		if (timer) {
			clearTimeout(timer);
			this.#debounceTimers.delete(uri);
		}
	}

	findDefinitions(name: string, dialect: GrammarDialect): IndexedRule[] {
		return (
			this.#index.get(
				this.#indexKey(dialect, normalizeSymbolName(name, dialect)),
			) ?? []
		);
	}

	getAllFiles(dialect?: GrammarDialect): IndexedFile[] {
		const files = Array.from(this.#fileData.values());
		return dialect ? files.filter((file) => file.dialect === dialect) : files;
	}

	searchSymbols(query: string): IndexedRule[] {
		const lowerQuery = query.toLowerCase();
		const results: IndexedRule[] = [];
		for (const [name, entries] of this.#index) {
			if (name.toLowerCase().includes(lowerQuery)) {
				results.push(...entries);
			}
		}
		return results;
	}

	dispose(): void {
		this.#watcher?.dispose();
		for (const timer of this.#debounceTimers.values()) {
			clearTimeout(timer);
		}
		this.#debounceTimers.clear();
		this.#parseCache.clear();
		this.#index.clear();
		this.#fileToNames.clear();
		this.#fileData.clear();
	}

	async #indexFile(uri: Uri): Promise<void> {
		try {
			const dialect = grammarDialectFromPath(uri.path);
			if (!dialect) {
				return;
			}
			const text = new TextDecoder().decode(await workspace.fs.readFile(uri));
			const document = parseGrammar(text, dialect);
			const symbolTable = buildGrammarSymbolTable(document, dialect);
			const uriStr = uri.toString();
			const names = new Set<string>();
			for (const rule of document.rules) {
				const key = this.#indexKey(
					dialect,
					normalizeSymbolName(rule.name, dialect),
				);
				names.add(key);
				const existing = this.#index.get(key) ?? [];
				existing.push({ uri, dialect, rule });
				this.#index.set(key, existing);
			}
			this.#fileToNames.set(uriStr, names);
			this.#fileData.set(uriStr, {
				uri,
				dialect,
				rules: document.rules,
				symbolTable,
			});
		} catch {
			// File might not exist or be readable.
		}
	}

	async #reindexFile(uri: Uri): Promise<void> {
		this.#removeIndexedFile(uri);
		await this.#indexFile(uri);
	}

	#removeIndexedFile(uri: Uri): void {
		const uriStr = uri.toString();
		const names = this.#fileToNames.get(uriStr);
		if (names) {
			for (const name of names) {
				const entries = this.#index.get(name);
				const filtered =
					entries?.filter((entry) => entry.uri.toString() !== uriStr) ?? [];
				if (filtered.length > 0) {
					this.#index.set(name, filtered);
				} else {
					this.#index.delete(name);
				}
			}
			this.#fileToNames.delete(uriStr);
		}
		this.#fileData.delete(uriStr);
	}

	#indexKey(dialect: GrammarDialect, name: string): string {
		return `${dialect}:${name}`;
	}
}

const FILE_GLOB = "**/*.{abnf,bnf,ebnf,rbnf}";
