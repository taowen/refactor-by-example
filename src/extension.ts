// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as childProcess from 'child_process'
import { PatchBlock, parsePatch } from './parsePatch';
import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'

type Example = { commit: string; symbol: string; }
type Examples = Record<string, Example>;

function getWorkspaceDir() {
	if (!vscode.workspace.workspaceFolders) {
		return undefined;
	}
	return vscode.workspace.workspaceFolders[0].uri.fsPath;
}

async function getExamples(): Promise<Examples> {
	const workspaceDir = getWorkspaceDir();
	if (!workspaceDir) {
		return {}
	}
	const configFile = path.join(workspaceDir, '.refactor-by-example.json');
	if (!fs.existsSync(configFile)) {
		await fs.promises.writeFile(configFile, '{}');
	}
	const configContent = await fs.promises.readFile(configFile, { encoding: 'utf-8' })
	return JSON.parse(configContent)
}

export class RefactoringExamplesProvider implements vscode.TreeDataProvider<string> {
	onDidChangeTreeData?: vscode.Event<string | void | string[] | null | undefined> | undefined;
	getTreeItem(exampleId: string): vscode.TreeItem | Thenable<vscode.TreeItem> {
		const treeItem = new vscode.TreeItem(exampleId);
		treeItem.command = {command:'refactor-by-example.refactor',title:'refactor',arguments:[exampleId]};
		return treeItem
	}
	async getChildren(exampleId?: string | undefined): Promise<string[]> {
		return Object.keys(await getExamples())
	}
	getParent?(exampleId: string): vscode.ProviderResult<string> {
		return null;
	}
	resolveTreeItem?(item: vscode.TreeItem, exampleId: string, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TreeItem> {
		return null;
	}
}

const execShell = (cmd: string, options: childProcess.ExecOptions) =>
    new Promise<string>((resolve, reject) => {
        childProcess.exec(cmd, options, (err, out) => {
            if (err) {
                return reject(err);
            }
            return resolve(out);
        });
    });


async function openaiComplete(content: string) {
	const conf = vscode.workspace.getConfiguration('refactorByExample');
	const apiUrl = conf.get<string>('apiUrl');
	const apiKey = conf.get<string>('apiKey');
	console.log({ apiUrl, apiKey })
	return new Promise<string>((resolve, reject) => {
		const req = https.request(`${apiUrl}/v1/chat/completions`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			},
		}, (res) => {
			if (res.statusCode !== 200) {
				reject(new Error(`unexpected response statusCode: ${res.statusCode}`))
			}
			res.setEncoding('utf8');
			const chunks: string[] = [];
			res.on('data', function (chunk) {
				chunks.push(chunk);
			});
			res.on('end', function() {
				const respText = chunks.join();
				console.log(respText);
				resolve(JSON.parse(respText).choices[0].message.content);
			})
		})
		const reqObj = {
			"model": "gpt-3.5-turbo",
			"temperature": 0,
			"messages": [
				{
					"role": "user",
					content,
				}
			]
		};
		console.log(content)
		req.write(JSON.stringify(reqObj));
		req.end();
	})
}

function generateSymbolExtractionPrompt(options: {
	blocks: PatchBlock[], 
	example: Example,
	selectionText: string,
}) {
	const { blocks, example, selectionText } = options;
	const promptLines = ['extract symbol from code snippets:', '===code snippets==='];
	for(const block of blocks) {
		if (block.oldContent) {
			promptLines.push('```')
			promptLines.push(block.oldContent);
			promptLines.push('```')
		}
	}
	promptLines.push('===symbol===')
	promptLines.push(example.symbol)
	promptLines.push('===code snippets===')
	promptLines.push('````')
	promptLines.push(selectionText)
	promptLines.push('````')
	promptLines.push('===symbol===')
	return promptLines.join('\n')
}

async function generateRefactoringPrompt(options: {
	blocks: PatchBlock[],
	language: string,
	locs: vscode.LocationLink[],
	workspaceDir: string,
	refs: vscode.Location[],
}) {
	const { blocks, language,locs, workspaceDir, refs } = options;
	const promptLines = ['refactor the code according to following example.', 'before refactoring:'];
	for(const block of blocks) {
		if (block.oldContent) {
			promptLines.push('```' + language)
			promptLines.push(`//${block.oldFile}:${block.oldFileLineNumber}`);
			promptLines.push(block.oldContent);
			promptLines.push('```')
		}
	}
	promptLines.push('after refactoring:')
	for(const block of blocks) {
		if (block.newContent) {
			promptLines.push('```' + language)
			promptLines.push(`//${block.oldContent ? '' : '+'}${block.oldFile}:${block.oldFileLineNumber}`);
			promptLines.push(block.newContent);
			promptLines.push('```')
		}
	}
	promptLines.push('apply the pattern in the example above to the code below')
	promptLines.push('before refactoring:')
	for (const loc of locs) {
		const locDoc = await vscode.workspace.openTextDocument(loc.targetUri);
		promptLines.push('```' + language)
		promptLines.push(`//${path.relative(workspaceDir, loc.targetUri.fsPath)}:${loc.targetRange.start.line+1}`);
		promptLines.push(locDoc.getText(loc.targetRange))
		promptLines.push('```')
	}
	for (const ref of await refs) {
		const refDoc = await vscode.workspace.openTextDocument(ref.uri);
		if (isCoveredBy(locs, ref)) {
			continue
		}
		const start = new vscode.Position(ref.range.start.line, 0);
		promptLines.push('```' + language)
		promptLines.push(`//${path.relative(workspaceDir, ref.uri.fsPath)}:${start.line+1}`);
		promptLines.push(refDoc.getText(new vscode.Range(start, start.translate(1))))
		promptLines.push('```')
	}
	promptLines.push('only markdown code blocks')
	promptLines.push('after refactoring:')
	return promptLines.join('\n')
}

function isCoveredBy(locs: vscode.LocationLink[], ref: vscode.Location) {
	for (const loc of locs) {
		if (loc.targetUri.path !== ref.uri.path) {
			continue
		}
		if (loc.targetRange.contains(ref.range)) {
			return true;
		}
	}
	return false;
}

async function refactor(exampleId: string) {
	const workspaceDir = getWorkspaceDir();
	if (!workspaceDir) {
		return;
	}
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return;
	}
	const selectionText = editor.document.getText(editor.selection)
	const examples = await getExamples();
	const example = examples[exampleId]
	if (!example?.commit) {
		console.log('missing commit from example')
		return;
	}
	if (!example?.symbol) {
		console.log('missing symbol from example')
		return;
	}
	const patchContent = await execShell(`git show ${example.commit}`, { cwd: workspaceDir })
	const blocks = parsePatch(patchContent);
	const symbolExtractionPrompt = generateSymbolExtractionPrompt({ blocks, example, selectionText });
	const toRefactorSymbol = await openaiComplete(symbolExtractionPrompt)
	const answer = await vscode.window.showInformationMessage(`Do you want to refactor ${toRefactorSymbol}`, "Yes", "No");
	if (answer !== "Yes") {
		return;
	}
	const relativePos = selectionText.indexOf(toRefactorSymbol);
	const absPos = editor.selection.start.translate(undefined, relativePos)
	const defs: Thenable<vscode.LocationLink[]> = vscode.commands.executeCommand('vscode.executeDefinitionProvider', editor.document.uri, absPos)
	const decls: Thenable<vscode.LocationLink[]> = vscode.commands.executeCommand('vscode.executeDeclarationProvider', editor.document.uri, absPos)
	const refs: Thenable<vscode.Location[]> = vscode.commands.executeCommand('vscode.executeReferenceProvider', editor.document.uri, absPos)
	const locs = [...await defs, ...await decls]
	const language = editor.document.languageId;
	const refactoringPrompt = await generateRefactoringPrompt({blocks, language, locs, workspaceDir, refs: await refs })
	console.log(await openaiComplete(refactoringPrompt))
}

/*
```typescript
//src/sample/vick-command.ts:1
import { ICommand } from "./a,pi";

export class VickCommand extends ICommand {
}
```
```typescript
//src/sample/app.ts:3
import { VickCommand } from "./vick-command";

```
```typescript
//src/sample/app.ts:7
    executeNewCommand(VickCommand);

```
```typescript
//+src/sample/registry.ts:2
import { VickCommand } from "./vick-command";

registerNewCommand(VickCommand)
```
*/

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('refactor-by-example.refactor', refactor);

	vscode.window.createTreeView('refactoringExamples', {
		treeDataProvider: new RefactoringExamplesProvider()
	  });

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
