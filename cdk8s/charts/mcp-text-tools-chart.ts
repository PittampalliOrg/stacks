import { Chart, ChartProps } from 'cdk8s';
import { Construct } from 'constructs';
import * as k8s from '../imports/k8s';
import { Quantity } from '../imports/k8s';

export class MCPTextToolsChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    const namespace = 'mcp-servers';

    // Create ConfigMap with TypeScript MCP server implementation
    new k8s.KubeConfigMap(this, 'text-tools-server', {
      metadata: {
        name: 'mcp-text-tools-server',
        namespace: namespace,
      },
      data: {
        'package.json': JSON.stringify({
          name: 'mcp-text-tools',
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

// Enable CORS for all origins
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
            name: 'mcp-text-tools',
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
              name: 'uppercase',
              description: 'Convert text to uppercase',
              inputSchema: {
                type: 'object',
                properties: {
                  text: { type: 'string', description: 'Text to convert' }
                },
                required: ['text']
              }
            },
            {
              name: 'lowercase',
              description: 'Convert text to lowercase',
              inputSchema: {
                type: 'object',
                properties: {
                  text: { type: 'string', description: 'Text to convert' }
                },
                required: ['text']
              }
            },
            {
              name: 'reverse',
              description: 'Reverse text',
              inputSchema: {
                type: 'object',
                properties: {
                  text: { type: 'string', description: 'Text to reverse' }
                },
                required: ['text']
              }
            },
            {
              name: 'word_count',
              description: 'Count words in text',
              inputSchema: {
                type: 'object',
                properties: {
                  text: { type: 'string', description: 'Text to count words in' }
                },
                required: ['text']
              }
            },
            {
              name: 'base64_encode',
              description: 'Encode text to base64',
              inputSchema: {
                type: 'object',
                properties: {
                  text: { type: 'string', description: 'Text to encode' }
                },
                required: ['text']
              }
            },
            {
              name: 'base64_decode',
              description: 'Decode base64 text',
              inputSchema: {
                type: 'object',
                properties: {
                  text: { type: 'string', description: 'Base64 text to decode' }
                },
                required: ['text']
              }
            }
          ]
        };
        break;

      case 'tools/call':
        const { name, arguments: args } = params;
        const text = args.text;

        switch (name) {
          case 'uppercase':
            result = { content: [{ type: 'text', text: text.toUpperCase() }] };
            break;
          case 'lowercase':
            result = { content: [{ type: 'text', text: text.toLowerCase() }] };
            break;
          case 'reverse':
            result = { content: [{ type: 'text', text: text.split('').reverse().join('') }] };
            break;
          case 'word_count':
            const wordCount = text.trim().split(/\\s+/).filter(word => word.length > 0).length;
            result = { content: [{ type: 'text', text: \`Word count: \${wordCount}\` }] };
            break;
          case 'base64_encode':
            result = { content: [{ type: 'text', text: Buffer.from(text).toString('base64') }] };
            break;
          case 'base64_decode':
            try {
              const decoded = Buffer.from(text, 'base64').toString('utf8');
              result = { content: [{ type: 'text', text: decoded }] };
            } catch (e) {
              throw new Error('Invalid base64 input');
            }
            break;
          default:
            throw new Error(\`Unknown tool: \${name}\`);
        }
        break;

      default:
        throw new Error(\`Unknown method: \${method}\`);
    }

    // Always return JSON response (no streaming needed for text tools)
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
  res.write(\`data: {"jsonrpc":"2.0","method":"server.ready","params":{"name":"mcp-text-tools","version":"1.0.0"}}\\n\\n\`);

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
  console.log(\`MCP Text Tools server (Streamable HTTP) listening on 0.0.0.0:\${PORT}\`);
});
`,
      },
    });

    // MCP Text Tools Deployment
    new k8s.KubeDeployment(this, 'text-tools-deployment', {
      metadata: {
        name: 'mcp-text-tools',
        namespace: namespace,
        labels: {
          'app': 'mcp-text-tools',
          'app.kubernetes.io/name': 'mcp-text-tools',
          'app.kubernetes.io/component': 'mcp-server',
          'mcp.kgateway.dev/enabled': 'true',
        },
      },
      spec: {
        replicas: 2,
        selector: {
          matchLabels: {
            'app': 'mcp-text-tools',
          },
        },
        template: {
          metadata: {
            labels: {
              'app': 'mcp-text-tools',
              'app.kubernetes.io/name': 'mcp-text-tools',
              'app.kubernetes.io/component': 'mcp-server',
            },
          },
          spec: {
            containers: [{
              name: 'mcp-server',
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
                  cpu: Quantity.fromString('100m'),
                  memory: Quantity.fromString('128Mi'),
                },
                limits: {
                  cpu: Quantity.fromString('500m'),
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
                name: 'mcp-text-tools-server',
                defaultMode: 0o644,
              },
            }],
          },
        },
      },
    });

    // MCP Text Tools Service
    new k8s.KubeService(this, 'text-tools-service', {
      metadata: {
        name: 'mcp-text-tools',
        namespace: namespace,
        labels: {
          'app': 'mcp-text-tools',
          'app.kubernetes.io/name': 'mcp-text-tools',
          'app.kubernetes.io/component': 'mcp-server',
        },
        annotations: {
          'mcp.kgateway.dev/tools': 'uppercase,lowercase,reverse,word_count,base64_encode,base64_decode',
          'mcp.kgateway.dev/discovery': 'enabled',
        },
      },
      spec: {
        selector: {
          'app': 'mcp-text-tools',
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

    // Create Ingress for direct access (useful for testing)
    new k8s.KubeIngress(this, 'text-tools-ingress', {
      metadata: {
        name: 'mcp-text-tools',
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
            host: `text-tools.${process.env.INGRESS_HOST || 'localtest.me'}`,
            http: {
              paths: [{
                path: '/',
                pathType: 'Prefix',
                backend: {
                  service: {
                    name: 'mcp-text-tools',
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