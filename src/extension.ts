
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const MAX_TEXT_LENGTH = 1024 * 1024 * 1024;
const execAsync = promisify(exec);
const getPlainText = async (usdRoot: string, usdcPath: string) => {
    const { stdout } = await execAsync(`usdcat ${usdcPath}`, {
        env: {
            PYTHONPATH: `${usdRoot}/lib/python`,
            PATH: `${process.env.PATH};${usdRoot}/bin;${usdRoot}/lib`,
        },
        maxBuffer: MAX_TEXT_LENGTH,
    });
    return stdout.toString();
}

const getAllUsdcFilesInDirectory = async (root: string): Promise<string[]> => {
    const contents = await fs.readdir(root, { withFileTypes: true });
    let usdcFiles: string[] = [];
    for (const content of contents) {
        if (content.isDirectory()) {
            usdcFiles = [...usdcFiles, ...await getAllUsdcFilesInDirectory(path.resolve(root, content.name))];
        } else if (path.extname(content.name) == ".usdc") {
            usdcFiles.push(path.resolve(root, content.name));
        }
    }
    return usdcFiles;
}

const convertDirectory = async (usdRoot: string, usdDirectory: string) => {
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Converting usdc to usda in ${usdDirectory}`,
        cancellable: true
    }, async (progress, token) => {
        token.onCancellationRequested(() => { });
        progress.report({ increment: 0 });

        const usdcFiles = await getAllUsdcFilesInDirectory(usdDirectory);
        const totalCount = usdcFiles.length;
        for (const usdcFile of usdcFiles) {
            const usdaFile = path.join(path.dirname(usdcFile), path.basename(usdcFile, ".usdc") + ".usda");
            const plainText = await getPlainText(usdRoot, usdcFile);
            progress.report({ message: `Converting ${usdaFile}`, increment: 100 / totalCount });
            await fs.writeFile(usdaFile, plainText);
        }
    });
}

export function activate(context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration('usdc-viewer');
    const usdRoot = config.usdRoot;

    if (!usdRoot) {
        vscode.window.showErrorMessage('Failed to get usdRoot');
        return;
    }

    const usdcProvider = new class implements vscode.TextDocumentContentProvider {
        async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
            const usdcPath = uri.path;
            return await getPlainText(usdRoot, usdcPath);
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
        const plainText = await getPlainText(usdRoot, usdcPath);
        const usdaPath = path.resolve(usdcPath, '../', path.basename(usdcPath, '.usdc') + '.usda');
        await fs.writeFile(usdaPath, plainText);
        const doc = await vscode.workspace.openTextDocument(usdaPath);
        await vscode.window.showTextDocument(doc, { preview: false });
    });
    context.subscriptions.push(convert);

    const convertRecursively = vscode.commands.registerCommand('usdc-viewer.convertRecursively', async uri => {
        const usdDirectory = uri?.fsPath;
        await convertDirectory(usdRoot, usdDirectory);
    })
}

export function deactivate() { }
