import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as docker from "@pulumi/docker";

const config = new pulumi.Config();
const pat = config.requireSecret("pat");

const appName = "grpc-timeout-repro";

const image = new docker.Image(appName, {
  imageName: `ghcr.io/abatilo/${appName}`,
  build: {
    context: "../",
    dockerfile: "../build/Dockerfile",
  },
  registry: {
    server: "ghcr.io/abatilo",
    username: "abatilo",
    password: pat,
  },
});

const clusterStackRef = new pulumi.StackReference("prod");
const kubeconfig = clusterStackRef.getOutput("kubeconfig");
const k8sProvider = new k8s.Provider("prod", {
  kubeconfig: kubeconfig.apply(JSON.stringify),
});

const appLabels = { app: appName };

const deployment = new k8s.apps.v1.Deployment(
  appName,
  {
    metadata: { labels: appLabels },
    spec: {
      selector: { matchLabels: appLabels },
      template: {
        metadata: { labels: appLabels },
        spec: {
          containers: [
            {
              name: appName,
              image: image.imageName,
              ports: [
                {
                  name: appName,
                  containerPort: 23456,
                  protocol: "TCP",
                },
              ],
            },
          ],
        },
      },
    },
  },
  { provider: k8sProvider }
);

const service = new k8s.core.v1.Service(
  appName,
  {
    metadata: { labels: appLabels },
    spec: {
      selector: appLabels,
      type: "ClusterIP",
      ports: [
        {
          name: "grpc",
          port: 80,
          targetPort: "yages",
          protocol: "TCP",
        },
      ],
    },
  },
  { provider: k8sProvider }
);
