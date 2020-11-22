package main

import (
	"context"
	"crypto/tls"
	"flag"
	"log"

	"github.com/abatilo/grpc-timeout-repro/pkg/proto/v1/backend/api/proto/v1/backend"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
)

// Send connections
func main() {
	targetFlag := flag.String("target", "localhost:23456", "Host and port combination to target. Defaults to localhost:23456")
	useTLSFlag := flag.Bool("tls", false, "Whether or not to use a secure dialer. Defaults to false")
	flag.Parse()

	target := *targetFlag
	useTLS := *useTLSFlag

	dialOptions := make([]grpc.DialOption, 0)

	if useTLS {
		dialOptions = append(dialOptions, grpc.WithTransportCredentials(credentials.NewTLS(&tls.Config{})))
	} else {
		dialOptions = append(dialOptions, grpc.WithInsecure())
	}

	conn, err := grpc.Dial(target, dialOptions...)
	if err != nil {
		log.Println("Couldn't dial")
	}
	defer conn.Close()
	c := backend.NewBackendClient(conn)

	resp, err := c.Echo(context.Background(), &backend.BackendRequest{
		Msg: make([]byte, 4096),
	})

	log.Println("Response: ", resp)
	if err != nil {
		log.Println("Received error from c.Echo: ", err)
	}
}
