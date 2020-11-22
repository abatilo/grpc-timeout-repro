import * as aws from "@pulumi/aws";
import * as docker from "@pulumi/docker";
import * as k8s from "@pulumi/kubernetes";
import * as kx from "@pulumi/kubernetesx";
import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config();
const pat = config.requireSecret("pat");

const appName = "grpc-timeout-repro";
const appLabels = { app: appName };

// Build and push docker image to GitHub Container Registry
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

// Parse kubeconfig for existing personal EKS cluster
const clusterStackRef = new pulumi.StackReference("prod");
const kubeconfig = clusterStackRef.getOutput("kubeconfig");
const k8sProvider = new k8s.Provider("prod", {
  kubeconfig: kubeconfig.apply(JSON.stringify),
});

// Create ACM cert for doing TLS termination at load balancer
const cert = new aws.acm.Certificate("cert", {
  domainName: "repro.public.abatilo.cloud",
  validationMethod: "DNS",
});

// Install traefik
const traefik = new k8s.helm.v3.Chart(
  "traefik",
  {
    namespace: "kube-system",
    fetchOpts: {
      repo: "https://charts.helm.sh/stable",
    },
    chart: "traefik",
    version: "1.78.4",
    values: {
      rbac: {
        enabled: true,
      },
      serviceType: "LoadBalancer",
      kubernetes: {
        ingressClass: "traefik",
        ingressEndpoint: {
          publishedService: "kube-system/traefik",
        },
        namespaces: ["default", "applications", "kube-system"],
      },
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
      resources: {
        requests: {
          cpu: "2",
          memory: "2Gi",
        },
        limits: {
          cpu: "2",
          memory: "2Gi",
        },
      },
    },
  },
  { provider: k8sProvider }
);

// Build Deployment spec
const deployment = new k8s.apps.v1.Deployment(
  appName,
  {
    metadata: {
      labels: appLabels,
    },
    spec: {
      replicas: 1,
      selector: { matchLabels: appLabels },
      template: {
        metadata: {
          labels: appLabels,
        },
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
              resources: {
                requests: {
                  cpu: "1",
                  memory: "1Gi",
                },
                limits: {
                  cpu: "1",
                  memory: "1Gi",
                },
              },
            },
          ],
        },
      },
    },
  },
  { provider: k8sProvider }
);

// Build Service spec
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

// Configure Ingress to register with Traefik
const ingress = new k8s.extensions.v1beta1.Ingress(
  appName,
  {
    metadata: {
      labels: appLabels,
      annotations: {
        "kubernetes.io/ingress.class": "traefik",
        "ingress.kubernetes.io/protocol": "h2c",
      },
    },
    spec: {
      rules: [
        {
          host: "repro.public.abatilo.cloud",
          http: {
            paths: [
              {
                path: "/",
                backend: {
                  serviceName: service.metadata.name,
                  servicePort: service.spec.ports[0].port,
                },
              },
            ],
          },
        },
      ],
    },
  },
  { provider: k8sProvider, dependsOn: [traefik] }
);
