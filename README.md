# usdc-viewer

This extension provides a viewer for USD binary files(.usdc). It is based on the usdcat command line tool.

## Features

- View a usdc file as plain text format
- Save usdc file as plain text format (.usda) or vice versa
- Save usdc files inside a folder as plain text format (.usda) or vice versa

## Requirements

You should install the OpenUsd library first.

## Extension Settings

- `usdc-viewer.usdRoot`: The root path of the OpenUsd library. If you has no environment to compile it from source, you can download the precompiled binaries from the [NVIDIA's official website](https://developer.nvidia.com/usd#libraries-and-tools)

## Usage

- To view or convert a single usdc file:
    - Open a usdc file in VSCode.
    - Right-click on the file and select "Open With Usdc Viewer" or "Save As Usda".
- To convert a usda file to usdc:
    - Right-click on a usda file and select "Save As Usdc".
- To convert all usdc files in a folder or vice versa:
    - Right-click on the folder and select "Convert Usdc to Usda In Folder" or "Convert Usda to Usdc In Folder".
- To convert all usdc files in the workspace folder or vice versa:
    - Right-click on the blank area in the explorer and select "Convert Usdc to Usda In Folder" or "Convert Usda to Usdc In Folder".
- To open with usdview:
    - Right-click on a usd file and select "Open With Usdview".

