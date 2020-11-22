SHELL := bash
.SHELLFLAGS := -eu -o pipefail -c
.ONESHELL:
MAKEFLAGS += --warn-undefined-variables
MAKEFLAGS += --no-builtin-rules

PROJECT_NAME = grpc-timeout-repro

.PHONY: help
help: ## View help information
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

tmp/.asdf-installs: .tool-versions ## Install all tools through asdf-vm
	@-mkdir -p $(@D)
	@-asdf plugin-add golang  || asdf install golang
	@-asdf plugin-add protoc  || asdf install protoc
	@-touch $@

tmp/.go-installs: tmp/.asdf-installs tools/tools.go tools/install.sh
	@-mkdir -p $(@D)
	./tools/install.sh
	@-touch $@

tmp/.bootstrap: tmp/.asdf-installs tmp/.go-installs
	@-mkdir -p $(@D)
	@-touch $@

.PHONY: proto
proto: tmp/.bootstrap
	protoc --go_out=pkg/proto/v1/backend --go_opt=paths=source_relative \
    --go-grpc_out=pkg/proto/v1/backend --go-grpc_opt=paths=source_relative \
		api/proto/v1/backend/backend.proto

.PHONY: clean
clean: ## Delete local dev environment
	@-rm -rf tmp/
	@-rm -rf pkg/proto/v1/backend/*

.PHONY: build
build: proto
	docker build -t $(PROJECT_NAME) -f build/Dockerfile .

.PHONY: server
server: build
	docker run --rm -it -p 23456:23456 $(PROJECT_NAME)

.PHONY: client
client: build
	docker run --rm -it --net host --entrypoint client $(PROJECT_NAME)
