// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as childProcess from 'child_process'
import { parsePatch } from './parsePatch';
import * as fs from 'fs'
import * as path from 'path'


function getWorkspaceDir() {
	if (!vscode.workspace.workspaceFolders) {
		return undefined;
	}
	return vscode.workspace.workspaceFolders[0].uri.fsPath;
}

async function getExamples() {
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

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	const conf = vscode.workspace.getConfiguration('refactorByExample');
	const apiUrl = conf.get<string>('apiUrl');
	const apiKey = conf.get<string>('apiKey');
	console.log({ apiUrl, apiKey })

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('refactor-by-example.refactor', async (exampleId) => {
		const workspaceDir = getWorkspaceDir();
		if (!workspaceDir) {
			return;
		}
		const examples = await getExamples();
		const example = examples[exampleId]
		if (!example?.commit) {
			console.log('missing commit from example')
			return;
		}
		const patchContent = await execShell(`git show ${example.commit}`, { cwd: workspaceDir })
		const blocks = parsePatch(patchContent);
		console.log(blocks)
	});

	vscode.window.createTreeView('refactoringExamples', {
		treeDataProvider: new RefactoringExamplesProvider()
	  });

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
