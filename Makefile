install:
	rm -rf ~/.vscode/extensions/kite.vscode
	mkdir -p ~/.vscode/extensions/kite.vscode
	cp extension.js package.json README.md ~/.vscode/extensions/kite.vscode
