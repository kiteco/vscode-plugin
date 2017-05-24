install:
	rm -rf ~/.vscode/extensions/kite.vscode
	mkdir -p ~/.vscode/extensions/kite.vscode
	cp extension.js package.json README.md ~/.vscode/extensions/kite.vscode

build-production:
	docker pull kiteco/build-vscode-plugin
	docker run --rm -v "$(PWD)":/vscode-plugin -w /vscode-plugin -t kiteco/build-vscode-plugin npm install --production