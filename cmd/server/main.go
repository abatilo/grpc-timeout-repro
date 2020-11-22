package main

import (
	"context"
	"log"
	"net"

	"github.com/abatilo/grpc-timeout-repro/pkg/proto/v1/backend/api/proto/v1/backend"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

// BackendService is the service struct
type BackendService struct {
	backend.UnimplementedBackendServer
}

// Echo does nothing
func (b *BackendService) Echo(ctx context.Context, r *backend.BackendRequest) (*backend.BackendResponse, error) {
	log.Printf("Received %d bytes\n", len(r.Msg))
	return &backend.BackendResponse{Msg: r.Msg}, nil
}

func main() {
	s := grpc.NewServer()
	backend.RegisterBackendServer(s, &BackendService{})
	lis, err := net.Listen("tcp", ":23456")
	if err != nil {
		log.Println("Failed to listen")
	}

	log.Println("Listening...")
	reflection.Register(s)
	err = s.Serve(lis)
	if err != nil {
		log.Println("Failed to serve")
	}
}
