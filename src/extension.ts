
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const MAX_TEXT_LENGTH = 1024 * 1024 * 1024;
const execAsync = promisify(exec);
const usdcToUsda = async (usdRoot: string, usdcPath: string, outputPath: string) => {
    await execAsync(`usdcat ${usdcPath} -o ${outputPath}`, {
        env: {
            PYTHONPATH: `${usdRoot}/lib/python`,
            PATH: `${process.env.PATH};${usdRoot}/bin;${usdRoot}/lib`,
        },
        maxBuffer: MAX_TEXT_LENGTH,
    });
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
            await usdcToUsda(usdRoot, usdcFile, usdaFile);
            progress.report({ message: `Converting ${usdaFile}`, increment: 100 / totalCount });
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
            const tmpUsda = path.resolve(os.tmpdir(), path.basename(usdcPath, '.usdc') + '.usda');
            await usdcToUsda(usdRoot, usdcPath, tmpUsda);
            const content = await fs.readFile(tmpUsda);
            return content.toString();
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
        const usdaPath = path.resolve(usdcPath, '../', path.basename(usdcPath, '.usdc') + '.usda');
        await usdcToUsda(usdRoot, usdcPath, usdaPath);
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
