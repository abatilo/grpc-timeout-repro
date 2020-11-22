import * as aws from "@pulumi/aws";
import * as docker from "@pulumi/docker";
import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

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

const cert = new aws.acm.Certificate("cert", {
  domainName: "repro.public.abatilo.cloud",
  validationMethod: "DNS",
});

const traefik = new k8s.helm.v3.Chart(
  "traefik",
  {
    fetchOpts: {
      repo: "https://charts.helm.sh/stable",
    },
    chart: "traefik",
    version: "1.78.4",
    values: {
      service: {
        annotations: {
          // "service.beta.kubernetes.io/aws-load-balancer-backend-protocol": "tcp",
          "service.beta.kubernetes.io/aws-load-balancer-ssl-cert": cert.arn,
          "external-dns.alpha.kubernetes.io/hostname": cert.domainName,
          "service.beta.kubernetes.io/aws-load-balancer-type": "nlb",
          "service.beta.kubernetes.io/aws-load-balancer-ssl-negotiation-policy":
            "ELBSecurityPolicy-TLS-1-1-2017-01",
        },
      },
    },
  },
  { provider: k8sProvider }
);

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
              name: "repro",
              image: image.imageName,
              ports: [
                {
                  name: "grpc",
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
          targetPort: "grpc",
          protocol: "TCP",
        },
      ],
    },
  },
  { provider: k8sProvider }
);
