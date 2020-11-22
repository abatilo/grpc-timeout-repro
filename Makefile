SHELL := bash
.SHELLFLAGS := -eu -o pipefail -c
.ONESHELL:
MAKEFLAGS += --warn-undefined-variables
MAKEFLAGS += --no-builtin-rules

PROJECT_NAME = grpc-timeout-repro

.PHONY: help
help: ## View help information
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

.PHONY: clean
clean: ## Delete protos
	@-rm -rf tmp/
	@-rm -rf pkg/proto/v1/backend/*

tmp/.asdf-installs: .tool-versions
	@-mkdir -p $(@D)
	@-asdf plugin-add golang  || asdf install golang
	@-asdf plugin-add grpcurl  || asdf install grpcurl
	@-asdf plugin-add nodejs  || asdf install nodejs
	@-asdf plugin-add protoc  || asdf install protoc
	@-asdf plugin-add pulumi  || asdf install pulumi
	@-touch $@

tmp/.go-installs: tmp/.asdf-installs tools/tools.go tools/install.sh
	@-mkdir -p $(@D)
	./tools/install.sh
	@-touch $@

tmp/.bootstrap: tmp/.asdf-installs tmp/.go-installs
	@-mkdir -p $(@D)
	@-touch $@

.PHONY: proto
proto: tmp/.bootstrap ## Compile Go code from protobuf definitions
	protoc --go_out=pkg/proto/v1/backend --go_opt=paths=source_relative \
    --go-grpc_out=pkg/proto/v1/backend --go-grpc_opt=paths=source_relative \
		api/proto/v1/backend/backend.proto
