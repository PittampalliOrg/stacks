import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';
import { Quantity } from '../imports/k8s';

export class MCPEchoServerChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    const namespace = 'mcp-servers';

    // Create ConfigMap with TypeScript Echo MCP server
    new k8s.KubeConfigMap(this, 'echo-server-code', {
      metadata: {
        name: 'mcp-echo-server',
        namespace: namespace,
      },
      data: {
        'package.json': JSON.stringify({
          name: 'mcp-echo-server',
          version: '1.0.0',
          main: 'server.js',
          scripts: {
            start: 'node server.js'
          },
          dependencies: {
            express: '^4.18.0',
            cors: '^2.8.5'
          }
        }, null, 2),
        'server.js': `const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8080;

// Enable CORS
app.use(cors());
app.use(express.json());

// Session management
const sessions = new Map();

// Generate secure session ID
function generateSessionId() {
  return crypto.randomBytes(16).toString('hex');
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Main MCP endpoint - Streamable HTTP transport
app.post('/', async (req, res) => {
  console.log('Received request:', JSON.stringify(req.body));
  const { method, params, id } = req.body;
  
  // Get or create session
  let sessionId = req.headers['mcp-session-id'];
  if (!sessionId && method === 'initialize') {
    sessionId = generateSessionId();
    sessions.set(sessionId, { created: Date.now() });
    res.setHeader('Mcp-Session-Id', sessionId);
  }

  try {
    let result;
    
    // Handle different methods
    switch (method) {
      case 'initialize':
        result = {
          protocolVersion: '2024-11-05',
          serverInfo: {
            name: 'mcp-echo-server',
            version: '1.0.0'
          },
          capabilities: {
            tools: {
              listTools: true,
              callTool: true
            }
          }
        };
        break;
      case 'tools/list':
        result = {
          tools: [
            {
              name: 'echo',
              description: 'Echo back the input text',
              inputSchema: {
                type: 'object',
                properties: {
                  message: { 
                    type: 'string', 
                    description: 'Message to echo back' 
                  }
                },
                required: ['message']
              }
            },
            {
              name: 'echo_json',
              description: 'Echo back the entire request as JSON',
              inputSchema: {
                type: 'object',
                properties: {
                  data: { 
                    type: 'object',
                    description: 'Any JSON data to echo back'
                  }
                },
                required: ['data']
              }
            }
          ]
        };
        break;

      case 'tools/call':
        const { name, arguments: args } = params;

        switch (name) {
          case 'echo':
            result = {
              content: [{
                type: 'text',
                text: \`Echo: \${args.message}\`
              }]
            };
            break;
            
          case 'echo_json':
            result = {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  echo: true,
                  timestamp: new Date().toISOString(),
                  received: args.data
                }, null, 2)
              }]
            };
            break;
            
          default:
            throw new Error(\`Unknown tool: \${name}\`);
        }
        break;

      default:
        // For unknown methods, echo the entire request
        result = {
          echo: true,
          method_received: method,
          params_received: params
        };
    }

    // For now, always return JSON response (no streaming needed for echo server)
    const response = {
      jsonrpc: '2.0',
      id,
      result
    };

    console.log('Sending response:', JSON.stringify(response));
    res.json(response);
  } catch (error) {
    console.error('Error processing request:', error);
    res.json({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32000,
        message: error.message
      }
    });
  }
});

// Optional: Support SSE for server-initiated messages
app.get('/', (req, res) => {
  console.log('SSE connection requested');
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no'
  });

  // Send server info
  res.write(\`data: {"jsonrpc":"2.0","method":"server.ready","params":{"name":"mcp-echo-server","version":"1.0.0"}}\\n\\n\`);

  // Keep connection alive
  const heartbeat = setInterval(() => {
    res.write(':heartbeat\\n\\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
  });
});

// Handle session cleanup (DELETE request)
app.delete('/', (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  if (sessionId && sessions.has(sessionId)) {
    sessions.delete(sessionId);
    res.status(204).send();
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

// Catch-all for debugging
app.use((req, res) => {
  console.log(\`Unhandled request: \${req.method} \${req.url}\`);
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(\`MCP Echo server (Streamable HTTP) listening on 0.0.0.0:\${PORT}\`);
});
`,
      },
    });

    // Echo MCP Server Deployment
    new k8s.KubeDeployment(this, 'echo-deployment', {
      metadata: {
        name: 'echo-mcp',
        namespace: namespace,
        labels: {
          'app': 'echo-mcp',
          'app.kubernetes.io/name': 'echo-mcp',
          'app.kubernetes.io/component': 'mcp-server',
          'mcp.kgateway.dev/enabled': 'true',
        },
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            'app': 'echo-mcp',
          },
        },
        template: {
          metadata: {
            labels: {
              'app': 'echo-mcp',
              'app.kubernetes.io/name': 'echo-mcp',
              'app.kubernetes.io/component': 'mcp-server',
            },
          },
          spec: {
            containers: [{
              name: 'echo-server',
              image: 'node:20-alpine',
              command: ['sh', '-c'],
              args: [
                'mkdir -p /app && cp /config/* /app/ && cd /app && npm install --production && npm start'
              ],
              workingDir: '/app',
              volumeMounts: [{
                name: 'server-code',
                mountPath: '/config',
              }],
              ports: [{
                name: 'http',
                containerPort: 8080,
                protocol: 'TCP',
              }],
              env: [{
                name: 'NODE_ENV',
                value: 'production',
              }],
              resources: {
                requests: {
                  cpu: Quantity.fromString('50m'),
                  memory: Quantity.fromString('128Mi'),
                },
                limits: {
                  cpu: Quantity.fromString('200m'),
                  memory: Quantity.fromString('256Mi'),
                },
              },
              readinessProbe: {
                httpGet: {
                  path: '/health',
                  port: k8s.IntOrString.fromNumber(8080),
                },
                initialDelaySeconds: 15,
                periodSeconds: 10,
                timeoutSeconds: 5,
              },
              livenessProbe: {
                httpGet: {
                  path: '/health',
                  port: k8s.IntOrString.fromNumber(8080),
                },
                initialDelaySeconds: 30,
                periodSeconds: 30,
                timeoutSeconds: 5,
              },
            }],
            volumes: [{
              name: 'server-code',
              configMap: {
                name: 'mcp-echo-server',
                defaultMode: 0o644,
              },
            }],
          },
        },
      },
    });

    // Echo MCP Service
    new k8s.KubeService(this, 'echo-service', {
      metadata: {
        name: 'echo-mcp',
        namespace: namespace,
        labels: {
          'app': 'echo-mcp',
          'app.kubernetes.io/name': 'echo-mcp',
          'app.kubernetes.io/component': 'mcp-server',
        },
        annotations: {
          'mcp.kgateway.dev/tools': 'echo,echo_json',
          'mcp.kgateway.dev/discovery': 'enabled',
        },
      },
      spec: {
        selector: {
          'app': 'echo-mcp',
        },
        type: 'ClusterIP',
        ports: [{
          name: 'http',
          protocol: 'TCP',
          port: 8080,
          targetPort: k8s.IntOrString.fromNumber(8080),
          appProtocol: 'kgateway.dev/mcp',
        }],
      },
    });

    // Create Ingress for direct access
    new k8s.KubeIngress(this, 'echo-ingress', {
      metadata: {
        name: 'echo-mcp',
        namespace: namespace,
        annotations: {
          'nginx.ingress.kubernetes.io/proxy-body-size': '10m',
          'nginx.ingress.kubernetes.io/proxy-read-timeout': '600',
          'nginx.ingress.kubernetes.io/proxy-send-timeout': '600',
          'nginx.ingress.kubernetes.io/proxy-http-version': '1.1',
          // Enable WebSocket/SSE support for streamable HTTP
          'nginx.ingress.kubernetes.io/proxy-buffering': 'off',
          'nginx.ingress.kubernetes.io/configuration-snippet': `
            proxy_set_header Accept-Encoding "";
            proxy_set_header Connection "";
            proxy_cache off;
            proxy_set_header X-Accel-Buffering no;
            proxy_set_header Accept "application/json, text/event-stream";
          `,
        },
      },
      spec: {
        ingressClassName: 'nginx',
        rules: [
          {
            host: `echo-mcp.${process.env.INGRESS_HOST || 'localtest.me'}`,
            http: {
              paths: [{
                path: '/',
                pathType: 'Prefix',
                backend: {
                  service: {
                    name: 'echo-mcp',
                    port: {
                      number: 8080,
                    },
                  },
                },
              }],
            },
          },
        ],
      },
    });
  }
}