
import * as vscode from 'vscode';
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import * as path from 'path';

const MAX_TEXT_LENGTH = 1024 * 1024 * 1024;

const getPlainText = (usdRoot: string, usdcPath: string) => {
    const plainResult = execSync(`usdcat ${usdcPath}`, {
        env: {
            PYTHONPATH: `${usdRoot}/lib/python`,
            PATH: `${process.env.PATH};${usdRoot}/bin;${usdRoot}/lib`,
        },
        maxBuffer: MAX_TEXT_LENGTH,
    });
    return plainResult.toString();
}

export function activate(context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration('usdc-viewer');
    const usdRoot = config.usdRoot;

    if (!usdRoot) {
        vscode.window.showErrorMessage('Failed to get usdRoot');
        return;
    }

    const usdcProvider = new class implements vscode.TextDocumentContentProvider {
        provideTextDocumentContent(uri: vscode.Uri): string {
            const usdcPath = uri.path;
            return getPlainText(usdRoot, usdcPath);
        }
    };
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('usdc', usdcProvider));

    const open = vscode.commands.registerCommand('usdc-viewer.open', async (uri) => {
        const usdcPath = uri?.fsPath;
        const usdcUri = vscode.Uri.parse('usdc:' + usdcPath);
        const doc = await vscode.workspace.openTextDocument(usdcUri);
        await vscode.window.showTextDocument(doc, { preview: false });
    });
    context.subscriptions.push(open);

    const convert = vscode.commands.registerCommand('usdc-viewer.convert', async (uri) => {
        const usdcPath = uri?.fsPath;
        const plainText = getPlainText(usdRoot, usdcPath);
        const usdaPath = path.resolve(usdcPath, '../', path.basename(usdcPath, '.usdc') + '.usda');
        writeFileSync(usdaPath, plainText);
        const doc = await vscode.workspace.openTextDocument(usdaPath);
        await vscode.window.showTextDocument(doc, { preview: false });
    });
    context.subscriptions.push(convert);
}

export function deactivate() { }
