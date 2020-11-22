FROM golang:1.15-alpine as builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY ./cmd ./cmd
COPY ./pkg ./pkg
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go install -ldflags="-w -s" ./cmd/...

FROM gcr.io/distroless/base:nonroot
COPY --from=builder /go/bin/client /go/bin/server \
  /usr/local/bin/
ENTRYPOINT ["server"]
