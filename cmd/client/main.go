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
	"google.golang.org/grpc/keepalive"
)

// Send connections
func main() {
	targetFlag := flag.String("target", "localhost:23456", "Host and port combination to target. Defaults to localhost:23456")
	useTLSFlag := flag.Bool("tls", false, "Whether or not to use a secure dialer. Defaults to false")
	flag.Parse()

	target := *targetFlag
	useTLS := *useTLSFlag

	dialOptions := make([]grpc.DialOption, 0)

	keepAlive := grpc.WithKeepaliveParams(keepalive.ClientParameters{
		Time: 600 * time.Second,
	})
	dialOptions = append(dialOptions, keepAlive)

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

	log.Println("Making a request")
	_, err = c.Echo(context.Background(), &backend.BackendRequest{
		Msg: make([]byte, 4096),
	})
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

	for i := 0; i < 20; i++ {
		// NLB has 350 second timeout
		time.Sleep(600 * time.Second)

		log.Println("Making another request")
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		_, err = c.Echo(ctx, &backend.BackendRequest{
			Msg: make([]byte, 4096),
		})
		if err != nil {
			log.Panicf("%d: Received error from c.Echo: %#v\n", i, err)
		}
		cancel()
	}
}
