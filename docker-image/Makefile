build: Dockerfile
	docker build -t kiteco/build-vscode-plugin .

push: build
	docker push kiteco/build-vscode-plugin

deploy: push
	ssh build.kite.com docker pull kiteco/build-vscode-plugin
