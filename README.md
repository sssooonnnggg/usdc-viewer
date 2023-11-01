# usdc-viewer

This extension provides a viewer for USD binary files(.usdc). It is based on the usdcat command line tool.

## Features

- View a usdc file as plain text format
- Save usdc file as plain text format (.usda)
- Save usdc files inside a folder as plain text format (.usda)

## Requirements

You should install the OpenUsd library first.

## Extension Settings

- `usdc-viewer.usdRoot`: The root path of the OpenUsd library.

## Usage

- View or convert a single usdc file:
    - Open a usdc file in vscode
    - Right click on the file and select "Open With Usdc Viewer" or "Save As Usda"
- Convert all usdc files in a folder
    - Right click on a folder, and select "Convert Usdc to Usda In Folder"
- Convert all usdc files in workspace folder
    - Right click on the blank area in explorer, adn select "Convert Usdc to Usda In Folder"

