
import * as vscode from 'vscode';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const MAX_TEXT_LENGTH = 1024 * 1024 * 1024;

const execAsync = promisify(exec);

const getConfig = () => vscode.workspace.getConfiguration('usdc-viewer');

const getUsdRoot = () => {
    const usdRoot = getConfig().usdRoot;
    if (!usdRoot) {
        vscode.window.showErrorMessage('Failed to get usdRoot');
    }
    return usdRoot;
}

const getWorkerCount = () => {
    const workerCount = getConfig().workerCount;
    if (!workerCount) {
        vscode.window.showErrorMessage('Failed to get workerCount');
    }
    return workerCount;
}

const tryExec = async (command: string) => {
    const usdRoot = getUsdRoot();
    return execAsync(command, {
        env: {
            PYTHONPATH: `${usdRoot}/lib/python`,
            PATH: `${usdRoot}/bin;${usdRoot}/lib;${usdRoot}/python;${process.env.PATH}`,
        },
        maxBuffer: MAX_TEXT_LENGTH,
    }).catch(err => {
        vscode.window.showErrorMessage(err.message);
        throw err;
    });
}

const usdcat = async (usdRoot: string, inputPath: string, outputPath: string) => {
    return tryExec(`usdcat "${inputPath}" -o "${outputPath}"`);
}

const getAllUsdFilesInDirectory = async (root: string, extension: string): Promise<string[]> => {
    const contents = await fs.readdir(root, { withFileTypes: true });
    let usdcFiles: string[] = [];
    for (const content of contents) {
        if (content.isDirectory()) {
            usdcFiles = [...usdcFiles, ...await getAllUsdFilesInDirectory(path.resolve(root, content.name), extension)];
        } else if (path.extname(content.name) == extension) {
            usdcFiles.push(path.resolve(root, content.name));
        }
    }
    return usdcFiles;
}

const anotherExtension = (extension: string) => extension === ".usdc" ? ".usda" : ".usdc";

const getTargetName = (inputFile: string) => path.basename(inputFile, path.extname(inputFile)) + anotherExtension(path.extname(inputFile));
const getOutputPath = (inputFile: string) => path.join(path.dirname(inputFile), getTargetName(inputFile));

const convertDirectory = async (usdRoot: string, usdDirectory: string, sourceExtension: string) => {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath ?? '';
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Converting usd in ${path.relative(workspaceRoot, usdDirectory) || path.basename(usdDirectory)}`,
        cancellable: false
    }, async (progress, token) => {
        token.onCancellationRequested(() => { });
        progress.report({ increment: 0 });

        const startTime = Date.now();
        const sourceFiles = await getAllUsdFilesInDirectory(usdDirectory, sourceExtension);
        const totalCount = sourceFiles.length;

        // from 1 to THREAD_COUNT
        let context = {
            sourceFiles: sourceFiles,
            cursor: sourceFiles.length - 1
        };

        const nextTick = () => new Promise(resolve => process.nextTick(resolve));

        const worker = async (context: any) => {
            await nextTick();
            while (context.cursor >= 0) {
                const inputFile = context.sourceFiles[context.cursor];
                const outputFile = getOutputPath(inputFile);
                const relativePath = path.relative(usdDirectory, outputFile);
                progress.report(
                    { message: `(${totalCount - context.cursor}/${totalCount}) Converting ${relativePath}`, increment: 100 / totalCount });
                context.cursor--;
                await usdcat(usdRoot, inputFile, outputFile);
            }
        };

        let workers = [];
        const workerCount = getWorkerCount();
        for (let i = 1; i <= getWorkerCount(); i++) {
            workers.push(worker(context));
        }
        vscode.window.showInformationMessage(`Converting ${totalCount} files with ${workerCount} workers`);
        await Promise.all(workers);

        const endTime = Date.now();
        const time = (endTime - startTime) / 1000;
        vscode.window.showInformationMessage(`Converted ${totalCount} files in ${time.toFixed(2)} seconds`);
    });
}

export function activate(context: vscode.ExtensionContext) {

    const viewFileWithAnotherExtension = async (uri: any, outputPath: string) => {
        const inputPath = uri?.fsPath;
        await usdcat(getUsdRoot(), inputPath, outputPath);
        const doc = await vscode.workspace.openTextDocument(outputPath);
        await vscode.window.showTextDocument(doc, { preview: false });
    };

    const open = vscode.commands.registerCommand('usdc-viewer.open', async (uri) => {
        await viewFileWithAnotherExtension(uri, path.resolve(os.tmpdir(), getTargetName(uri?.fsPath)));
    });
    context.subscriptions.push(open);

    const convert = vscode.commands.registerCommand('usdc-viewer.convert', async (uri) => {
        await viewFileWithAnotherExtension(uri, getOutputPath(uri?.fsPath));
    });
    context.subscriptions.push(convert);

    const convertToUsdc = vscode.commands.registerCommand('usdc-viewer.convertToUsdc', async (uri) => {
        await viewFileWithAnotherExtension(uri, getOutputPath(uri?.fsPath));
    });
    context.subscriptions.push(convertToUsdc);

    const convertUsdcRecursively = vscode.commands.registerCommand('usdc-viewer.convertUsdcRecursively', async uri => {
        const usdDirectory = uri?.fsPath;
        await convertDirectory(getUsdRoot(), usdDirectory, ".usdc");
    })
    context.subscriptions.push(convertUsdcRecursively);

    const convertUsdaRecursively = vscode.commands.registerCommand('usdc-viewer.convertUsdaRecursively', async uri => {
        const usdDirectory = uri?.fsPath;
        await convertDirectory(getUsdRoot(), usdDirectory, ".usda");
    })
    context.subscriptions.push(convertUsdaRecursively);

    const openWithUsdView = vscode.commands.registerCommand('usdc-viewer.openWithUsdView', async uri => {
        const usdPath = uri?.fsPath;
        tryExec(`usdview ${usdPath}`);
    });
    context.subscriptions.push(openWithUsdView);
}

export function deactivate() { }
