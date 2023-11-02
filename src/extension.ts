
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const MAX_TEXT_LENGTH = 1024 * 1024 * 1024;
const TASK_CHUNK_SIZE = 32;
const execAsync = promisify(exec);

const usdcToUsda = async (usdRoot: string, usdcPath: string, outputPath: string) => {
    return execAsync(`usdcat ${usdcPath} -o ${outputPath}`, {
        env: {
            PYTHONPATH: `${usdRoot}/lib/python`,
            PATH: `${process.env.PATH};${usdRoot}/bin;${usdRoot}/lib`,
        },
        maxBuffer: MAX_TEXT_LENGTH,
    }).catch(err => {
        vscode.window.showErrorMessage(err.message);
        throw err;
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

const intoChunks = <T>(array: T[], chunkSize: number): (T[])[] => {
    let chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}

const getUsdaName = (usdcFile: string) => path.basename(usdcFile, ".usdc") + ".usda";
const getUsdaPath = (usdcFile: string) => path.join(path.dirname(usdcFile), getUsdaName(usdcFile));

const convertDirectory = async (usdRoot: string, usdDirectory: string) => {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath ?? '';
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Converting usdc in ${path.relative(workspaceRoot, usdDirectory) ?? 'Worldspace folder'}`,
        cancellable: false
    }, async (progress, token) => {
        token.onCancellationRequested(() => { });
        progress.report({ increment: 0 });

        const startTime = Date.now();
        const usdcFiles = await getAllUsdcFilesInDirectory(usdDirectory);
        const totalCount = usdcFiles.length;
        let convertedCount = 0;

        const chunks = intoChunks(usdcFiles, TASK_CHUNK_SIZE);
        for (const chunk of chunks) {
            let promises = [];
            for (const usdcFile of chunk) {
                const usdaFile = getUsdaPath(usdcFile);
                const relativePath = path.relative(usdDirectory, usdaFile);
                const finished = () => {
                    convertedCount++;
                    progress.report(
                        { message: `(${convertedCount}/${totalCount}) Converting ${relativePath}`, increment: 100 / totalCount })
                };
                const promise = usdcToUsda(usdRoot, usdcFile, usdaFile).then(() => finished());
                promises.push(promise);
            }

            await Promise.all(promises);
        }
        const endTime = Date.now();
        const time = (endTime - startTime) / 1000;
        vscode.window.showInformationMessage(`Converted ${totalCount} files in ${time.toFixed(2)} seconds`);
    });
}

const getConfig = () => vscode.workspace.getConfiguration('usdc-viewer');

const getUsdRoot = () => {
    const usdRoot = getConfig().usdRoot;
    if (!usdRoot) {
        vscode.window.showErrorMessage('Failed to get usdRoot');
    }
    return usdRoot;
}

export function activate(context: vscode.ExtensionContext) {
    const usdcProvider = new class implements vscode.TextDocumentContentProvider {
        async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
            const usdcPath = uri.path;
            const tmpUsda = path.resolve(os.tmpdir(), getUsdaName(usdcPath));
            await usdcToUsda(getUsdRoot(), usdcPath, tmpUsda);
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
        const usdaPath = getUsdaPath(usdcPath);
        await usdcToUsda(getUsdRoot(), usdcPath, usdaPath);
        const doc = await vscode.workspace.openTextDocument(usdaPath);
        await vscode.window.showTextDocument(doc, { preview: false });
    });
    context.subscriptions.push(convert);

    const convertRecursively = vscode.commands.registerCommand('usdc-viewer.convertRecursively', async uri => {
        const usdDirectory = uri?.fsPath;
        await convertDirectory(getUsdRoot(), usdDirectory);
    })
    context.subscriptions.push(convertRecursively);
}

export function deactivate() { }
