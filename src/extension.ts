// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

export class RefactoringExamplesProvider implements vscode.TreeDataProvider<string> {
	onDidChangeTreeData?: vscode.Event<string | void | string[] | null | undefined> | undefined;
	getTreeItem(exampleId: string): vscode.TreeItem | Thenable<vscode.TreeItem> {
		const treeItem = new vscode.TreeItem(exampleId);
		treeItem.command = {command:'refactor-by-example.refactor',title:'refactor',arguments:[exampleId]};
		return treeItem
	}
	getChildren(exampleId?: string | undefined): vscode.ProviderResult<string[]> {
		return ['a', 'b', 'c']
	}
	getParent?(exampleId: string): vscode.ProviderResult<string> {
		return null;
	}
	resolveTreeItem?(item: vscode.TreeItem, exampleId: string, token: vscode.CancellationToken): vscode.ProviderResult<vscode.TreeItem> {
		return null;
	}
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "refactor-by-example" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('refactor-by-example.refactor', (exampleId) => {
		console.log(exampleId)
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from refactor-by-example!');
	});

	vscode.window.createTreeView('refactoringExamples', {
		treeDataProvider: new RefactoringExamplesProvider()
	  });

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
