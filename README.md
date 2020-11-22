# grpc-timeout-repro

## Makefile

Typing `make proto` will utilize `asdf-vm` and the `.tool-versions` file and
the `tools/tools.go` file to install all of the tools necessary to compile the
proto definitions.

```
⇒  make help
help                           View help information
clean                          Delete protos
proto                          Compile Go code from protobuf definitions
```

## cmd

There are two applications under `cmd`. A simple gRPC server and a simple gRPC client.

## deployments

For end to end build and deployment, there's a Pulumi based `index.ts` which
includes building and pushing the Docker container for the server as well as
includes deployment definitions for deploying the application directly to a
Kubernetes cluster.

The Pulumi stack is automatically ran on every push to this repo via a GitHub
Action workflow that's defined under `.github/workflows/`
