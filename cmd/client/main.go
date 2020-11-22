package main

import (
	"context"
	"crypto/tls"
	"flag"
	"log"
	"time"

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

	go func() {
		elapsed := 10
		ticker := time.NewTicker(10 * time.Second)
		for {
			select {
			case <-ticker.C:
				log.Println(elapsed, "seconds have passed")
				elapsed += 10
				break
			}
		}
	}()

	// NLB has 350 second timeout
	time.Sleep(400 * time.Second)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	resp, err = c.Echo(ctx, &backend.BackendRequest{
		Msg: make([]byte, 4096),
	})

	log.Println("2nd Response: ", resp)
	if err != nil {
		log.Println("2nd Received error from c.Echo: ", err)
	}
}
