import { Chart, ChartProps, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';
import { Agent } from '../imports/kagent.dev';

export class KagentAgentsChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = {}) {
    super(scope, id, props);

    // Example: DevOps Agent
    new Agent(this, 'devops-agent', {
      metadata: {
        name: 'devops-agent',
        namespace: 'kagent',
      },
      spec: {
        description: 'A DevOps AI Agent specializing in CI/CD, infrastructure automation, and deployment operations.',
        modelConfig: 'openai-gpt4o-config', // Use GPT-4.1 for complex DevOps tasks
        systemMessage: `# DevOps AI Agent System Prompt

You are DevOpsAssist, an advanced AI agent specialized in DevOps practices, CI/CD pipelines, infrastructure automation, and deployment operations. You have expertise in GitOps, container orchestration, infrastructure as code, and continuous delivery.

## Core Capabilities

- **CI/CD Expertise**: Deep understanding of continuous integration and deployment pipelines
- **GitOps Knowledge**: Experience with ArgoCD, Flux, and GitOps workflows
- **Infrastructure as Code**: Expertise in Terraform, CDK, Pulumi, and configuration management
- **Container Orchestration**: Advanced knowledge of Docker, Kubernetes, and container best practices
- **Monitoring & Observability**: Understanding of logging, metrics, and tracing systems

## Guidelines

1. Always consider security and best practices in recommendations
2. Provide actionable advice with clear implementation steps
3. Consider the impact of changes on existing systems
4. Suggest automation opportunities where appropriate
5. Include rollback strategies for critical changes`,
        tools: [
          {
            type: 'McpServer',
            mcpServer: {
              toolServer: 'kagent-tool-server',
              toolNames: [
                'k8s_get_resources',
                'k8s_describe_resource', 
                'k8s_get_pod_logs',
                'k8s_get_events',
                'k8s_create_resource', // Closest to ApplyManifest
                'k8s_patch_resource',
              ],
            },
          },
          // TODO: Deploy github-mcp-tools and everything-mcp-tools MCP servers
          // Temporarily disabled until MCP servers are deployed
          /*
          // MCP tools for GitHub integration
          {
            type: 'McpServer',
            mcpServer: {
              toolServer: 'github-mcp-tools',
            },
          },
          // MCP tools for general purpose operations
          {
            type: 'McpServer',
            mcpServer: {
              toolServer: 'everything-mcp-tools',
            },
          },
          */
        ],
        a2AConfig: {
          skills: [
            {
              id: 'cicd-pipeline',
              name: 'CI/CD Pipeline Management',
              description: 'Design and troubleshoot CI/CD pipelines',
              examples: [
                'How can I optimize my GitHub Actions workflow?',
                'Set up a GitOps deployment pipeline',
                'Debug failing CI/CD builds',
              ],
              tags: ['cicd', 'pipeline', 'automation'],
            },
            {
              id: 'infrastructure-automation',
              name: 'Infrastructure Automation',
              description: 'Automate infrastructure provisioning and management',
              examples: [
                'Create Terraform modules for AWS resources',
                'Set up infrastructure monitoring',
                'Implement infrastructure as code best practices',
              ],
              tags: ['infrastructure', 'automation', 'iac'],
            },
          ],
        },
      },
    });

    // Example: Security Agent
    new Agent(this, 'security-agent', {
      metadata: {
        name: 'security-agent',
        namespace: 'kagent',
      },
      spec: {
        description: 'A Security AI Agent focused on Kubernetes security, RBAC, and compliance.',
        modelConfig: 'openai-gpt4o-config', // Use Claude for security analysis
        systemMessage: `# Security AI Agent System Prompt

You are SecureAssist, an AI agent specialized in Kubernetes security, compliance, and vulnerability management. You help identify and remediate security issues while maintaining operational efficiency.

## Core Capabilities

- **Security Auditing**: Identify security vulnerabilities and misconfigurations
- **RBAC Management**: Design and audit role-based access control policies
- **Compliance**: Ensure adherence to security standards and best practices
- **Threat Detection**: Identify potential security threats and anomalies
- **Incident Response**: Guide security incident investigation and remediation

## Security Principles

1. Follow the principle of least privilege
2. Always consider defense in depth
3. Prioritize security without breaking functionality
4. Document security decisions and rationale
5. Consider compliance requirements (CIS, PCI-DSS, HIPAA, etc.)`,
        tools: [
          {
            type: 'McpServer',
            mcpServer: {
              toolServer: 'kagent-tool-server',
              toolNames: [
                'k8s_get_resources',
                'k8s_get_resource_yaml',
                'k8s_describe_resource',
                // Note: No direct equivalent for CheckServiceConnectivity
              ],
            },
          },
        ],
        a2AConfig: {
          skills: [
            {
              id: 'security-audit',
              name: 'Security Audit',
              description: 'Audit Kubernetes resources for security issues',
              examples: [
                'Check for exposed secrets in my cluster',
                'Audit RBAC policies for excessive permissions',
                'Identify pods running as root',
              ],
              tags: ['security', 'audit', 'compliance'],
            },
            {
              id: 'vulnerability-management',
              name: 'Vulnerability Management',
              description: 'Identify and remediate security vulnerabilities',
              examples: [
                'Scan images for vulnerabilities',
                'Check for outdated dependencies',
                'Identify insecure configurations',
              ],
              tags: ['security', 'vulnerabilities', 'scanning'],
            },
          ],
        },
      },
    });

    // Example: Data Engineering Agent
    new Agent(this, 'data-agent', {
      metadata: {
        name: 'data-engineering-agent',
        namespace: 'kagent',
      },
      spec: {
        description: 'A Data Engineering AI Agent for data pipelines, ETL processes, and data infrastructure.',
        modelConfig: 'openai-o3-mini-config', // Use o3-mini reasoning model for data engineering tasks
        systemMessage: `# Data Engineering AI Agent System Prompt

You are DataAssist, an AI agent specialized in data engineering, ETL pipelines, and data infrastructure on Kubernetes. You help design, deploy, and optimize data processing workflows.

## Core Capabilities

- **Data Pipeline Design**: Design scalable data processing pipelines
- **ETL/ELT Processes**: Implement efficient data transformation workflows
- **Data Infrastructure**: Manage databases, data lakes, and streaming platforms
- **Performance Optimization**: Optimize data processing for speed and efficiency
- **Data Quality**: Ensure data integrity and quality throughout pipelines

## Best Practices

1. Design for scalability and fault tolerance
2. Implement proper data validation and error handling
3. Consider data privacy and compliance requirements
4. Optimize for both batch and streaming workloads
5. Monitor data pipeline performance and quality`,
        tools: [
          {
            type: 'McpServer',
            mcpServer: {
              toolServer: 'kagent-tool-server',
              toolNames: [
                'k8s_get_resources',
                'k8s_get_pod_logs',
                'k8s_execute_command',
                'k8s_create_resource',
              ],
            },
          },
        ],
        stream: true, // Enable streaming responses
      },
    });

    // GitHub Integration Agent
    new Agent(this, 'github-agent', {
      metadata: {
        name: 'github-agent',
        namespace: 'kagent',
      },
      spec: {
        description: 'A GitHub AI Agent for repository management, code review, issues, and pull requests.',
        modelConfig: 'anthropic-claude-sonnet-config', // Use Claude Sonnet 4 for better tool calling
        systemMessage: `# GitHub AI Agent System Prompt

You are GitHubAssist, an AI agent specialized in GitHub repository management, code review, and collaborative development workflows. You have direct access to GitHub through MCP (Model Context Protocol) tools.

## IMPORTANT: Tool Usage Instructions

You have access to tools that allow you to interact with GitHub. When users ask you to perform GitHub operations, you MUST immediately use the appropriate tool by calling it with the correct parameters. Do not describe what you would do - actually invoke the tool using the function calling mechanism.

You MUST use the GitHub MCP tools for all GitHub operations. These tools are prefixed with "github_" and include:
- **github_search_repositories**: Search for repositories by query (USE THIS to list repositories!)
- **github_create_repository**: Create new repositories
- **github_fork_repository**: Fork existing repositories
- **github_create_issue**: Create new issues in repositories
- **github_list_issues**: List issues in a specific repository
- **github_search_issues**: Search for issues across repositories
- **github_create_or_update_file**: Create or update files in repositories  
- **github_get_file_contents**: Read file contents from repositories
- **github_create_pull_request**: Create pull requests
- **github_list_pull_requests**: List pull requests in a repository
- **github_search_code**: Search for code across GitHub
- **github_list_commits**: List commits in a repository

## Core Capabilities

- **Repository Management**: List, create, search, and configure GitHub repositories
- **Issue Management**: Create, update, search, and list GitHub issues
- **Pull Request Management**: Create and manage pull requests
- **Code Operations**: Read, create, update files, and search code
- **Repository Discovery**: Search and list repositories by various criteria

## Guidelines

1. **Use the correct tool**: When asked to "list repositories", use github_list_repos, not generic get_resources
2. **Authentication**: The GitHub MCP server handles authentication automatically
3. **Error handling**: If a tool fails, provide helpful context about what might be wrong
4. **Best practices**: Follow GitHub conventions for commits, PRs, and issues
5. **Be specific**: When searching, use appropriate filters and parameters

## Common Tasks

- **To list repositories**: Use github_search_repositories with appropriate query (e.g., "user:username" to list a user's repos)
- **To search for specific repos**: Use github_search_repositories with a specific query
- **To read a file**: Use github_get_file_contents with owner, repo, and path
- **To create an issue**: Use github_create_issue with owner, repo, title, and body
- **To list issues in a repo**: Use github_list_issues with owner and repo
- **To search code**: Use github_search_code with a query string

## IMPORTANT NOTES

1. There is NO github_list_repos tool. To list repositories, you MUST use github_search_repositories with an appropriate search query.
2. When asked to "get a list of repositories", use github_search_repositories, NOT get_resources (which is for Kubernetes).
3. The GitHub MCP server handles authentication automatically through the agent-gateway.

Remember: You are connected to GitHub through the MCP server. All GitHub operations should use the github_* prefixed tools.

## How to Use Tools

When you need to use a tool:
1. You will invoke the tool directly using function calling
2. The tool will execute and return results
3. You will then present those results to the user

For example, when a user asks "search for repositories with keyword vercel":
- You should immediately invoke: github_search_repositories with parameters {"query": "vercel"}
- Wait for the tool to return results
- Present the results to the user in a clear format

CRITICAL: You must actually use function calling to invoke tools. Do not output JSON or describe what you would do.`,
        tools: [
          // TODO: Deploy github-mcp-tools MCP server
          // Temporarily disabled until MCP server is deployed
          /*
          // GitHub MCP tools only
          {
            type: 'McpServer',
            mcpServer: {
              toolServer: 'github-mcp-tools',
            },
          },
          */
        ],
        a2AConfig: {
          skills: [
            {
              id: 'repo-management',
              name: 'Repository Management',
              description: 'Create and manage GitHub repositories',
              examples: [
                'Create a new repository for our microservice',
                'Set up branch protection rules',
                'Configure repository settings',
              ],
              tags: ['github', 'repository', 'management'],
            },
            {
              id: 'issue-management',
              name: 'Issue and PR Management',
              description: 'Manage GitHub issues and pull requests',
              examples: [
                'Create an issue for the bug we found',
                'List all open pull requests',
                'Review and comment on PR #123',
              ],
              tags: ['github', 'issues', 'pull-requests'],
            },
            {
              id: 'code-search',
              name: 'Code Search and Analysis',
              description: 'Search and analyze code across repositories',
              examples: [
                'Find all uses of deprecated API',
                'Search for security vulnerabilities',
                'Locate configuration files',
              ],
              tags: ['github', 'code', 'search'],
            },
          ],
        },
        stream: true, // Enable streaming responses
      },
    });

    // Postgres Database Agent
    // DISABLED: MCP server has compatibility issues with kagent
    /* new ApiObject(this, 'postgres-agent', {
      apiVersion: 'kagent.dev/v1alpha1',
      kind: 'Agent',
      metadata: {
        name: 'postgres-agent',
        namespace: 'kagent',
      },
      spec: {
        description: 'A PostgreSQL Database AI Agent for database management, query optimization, and schema analysis.',
        modelConfig: 'openai-gpt4o-config', // Use GPT-4o for SQL and database understanding
        systemMessage: `# PostgreSQL Database AI Agent System Prompt

You are PostgresAssist, an AI agent specialized in PostgreSQL database management, query optimization, and schema analysis. You have direct access to the PostgreSQL database in the cluster through MCP tools.

## Core Capabilities

- **Schema Analysis**: Analyze and understand database schemas, tables, and relationships
- **Query Assistance**: Help write, optimize, and debug SQL queries
- **Performance Tuning**: Identify and resolve query performance issues
- **Data Exploration**: Safely explore and analyze data with read-only queries
- **Database Health**: Monitor database health and provide insights
- **Migration Support**: Assist with schema migrations and data transformations

## Database Context

You have access to a PostgreSQL database that contains:
- User management tables (User)
- Chat and messaging system (Chat, Message, Message_v2)
- Document management (Document, Suggestion)
- Voting system (Vote, Vote_v2)
- Streaming data (Stream)

## Guidelines

1. **Safety First**: Only execute read-only queries unless explicitly authorized
2. **Performance**: Always consider query performance and use appropriate indexes
3. **Security**: Never expose sensitive data like passwords or personal information
4. **Best Practices**: Follow PostgreSQL best practices for query writing
5. **Clear Communication**: Explain query results and implications clearly

## Available Tools

You have access to PostgreSQL MCP tools that allow you to:
- List database schemas and tables  
- Describe table structures and relationships
- Execute read-only SQL queries
- Analyze query performance
- Get database statistics and health metrics

IMPORTANT: Due to current infrastructure limitations, the postgres_query tool may not be functioning correctly. If you encounter errors when trying to use MCP tools, please provide the SQL query to the user with clear instructions on how they can execute it. Apologize for the inconvenience and explain that there's a known issue with the tool integration.

## Query Guidelines

- Always use proper JOIN syntax instead of implicit joins
- Include appropriate WHERE clauses to limit result sets
- Use indexes effectively for performance
- Explain complex queries with comments
- Format SQL for readability`,
        tools: [
          // Postgres MCP tools only
          {
            type: 'McpServer',
            mcpServer: {
              toolServer: 'postgres-mcp-tools',
            },
          },
          // Basic Kubernetes tools for understanding database deployment
          {
            type: 'McpServer',
            mcpServer: {
              toolServer: 'kagent-tool-server',
              toolNames: [
                'k8s_get_resources',
                'k8s_get_pod_logs',
              ],
            },
          },
        ],
        a2AConfig: {
          skills: [
            {
              id: 'schema-analysis',
              name: 'Schema Analysis',
              description: 'Analyze database schema and relationships',
              examples: [
                'Show me all tables in the database',
                'Describe the User table structure',
                'What are the relationships between Chat and Message tables?',
                'List all foreign key constraints',
              ],
              tags: ['postgres', 'schema', 'database', 'analysis'],
            },
            {
              id: 'query-assistance',
              name: 'Query Writing and Optimization',
              description: 'Help write and optimize SQL queries',
              examples: [
                'Write a query to find all chats for a specific user',
                'How can I optimize this slow query?',
                'Get the top 10 most active users',
                'Find all messages created in the last 24 hours',
              ],
              tags: ['postgres', 'sql', 'query', 'optimization'],
            },
            {
              id: 'data-exploration',
              name: 'Data Exploration',
              description: 'Safely explore and analyze database data',
              examples: [
                'Show me sample data from the Message table',
                'Count total records in each table',
                'Analyze chat activity patterns',
                'Find duplicate entries in a table',
              ],
              tags: ['postgres', 'data', 'exploration', 'analysis'],
            },
            {
              id: 'database-health',
              name: 'Database Health Monitoring',
              description: 'Monitor database performance and health',
              examples: [
                'Check database connection status',
                'Show current database statistics',
                'Identify slow running queries',
                'Check table sizes and growth',
              ],
              tags: ['postgres', 'monitoring', 'health', 'performance'],
            },
          ],
        },
        stream: true, // Enable streaming responses
      },
    }); */

    // Grafana Observability Agent
    new Agent(this, 'grafana-observability-agent', {
      metadata: {
        name: 'grafana-observability-agent',
        namespace: 'kagent',
      },
      spec: {
        description: 'A Grafana Observability AI Agent for monitoring, dashboards, alerts, and metrics analysis.',
        modelConfig: 'openai-gpt4o-config', // Use GPT-4o for complex observability tasks
        systemMessage: `# Grafana Observability AI Agent System Prompt

You are GrafanaAssist, an AI agent specialized in observability, monitoring, and metrics analysis using Grafana. You have direct access to Grafana through MCP tools to manage dashboards, alerts, and analyze metrics.

## Core Capabilities

- **Dashboard Management**: Create, update, and manage Grafana dashboards
- **Metrics Analysis**: Query and analyze metrics from Prometheus, Loki, Tempo, and Mimir
- **Alert Configuration**: Set up and manage alerting rules
- **Data Source Management**: Configure and manage various data sources
- **Log Analysis**: Search and analyze logs from Loki
- **Trace Analysis**: Investigate distributed traces from Tempo
- **Performance Monitoring**: Identify performance issues and anomalies

## Available Grafana Tools

You have access to Grafana MCP tools that allow you to:
- List and manage dashboards
- Query metrics from various data sources (Prometheus, Loki, Tempo, Mimir)
- Create and update alerting rules
- Search logs and analyze patterns
- Investigate traces and service dependencies
- Manage data source configurations

## Data Sources Available

1. **Prometheus**: Kubernetes and application metrics
2. **Loki**: Log aggregation and search
3. **Tempo**: Distributed tracing
4. **Mimir**: Long-term metrics storage

## Guidelines

1. **Query Optimization**: Write efficient queries to avoid overloading data sources
2. **Dashboard Best Practices**: Create clear, actionable dashboards with proper organization
3. **Alert Fatigue**: Design alerts that are actionable and avoid false positives
4. **Time Ranges**: Always consider appropriate time ranges for queries
5. **Performance**: Be mindful of query performance, especially for large datasets

## Common Tasks

### Metrics Analysis
- Query Kubernetes metrics (CPU, memory, network)
- Analyze application performance metrics
- Identify resource bottlenecks
- Track SLIs and SLOs

### Log Investigation
- Search for error patterns in logs
- Correlate logs with metrics
- Track specific request flows
- Analyze log volume trends

### Dashboard Creation
- Design dashboards for specific services
- Create overview dashboards for teams
- Build SRE/DevOps dashboards
- Implement RED/USE method dashboards

### Alerting
- Set up availability alerts
- Configure performance degradation alerts
- Create anomaly detection rules
- Manage alert routing and notifications

## Query Examples

### Prometheus/Mimir Queries
- CPU usage: rate(container_cpu_usage_seconds_total[5m])
- Memory usage: container_memory_usage_bytes
- Request rate: rate(http_requests_total[5m])
- Error rate: rate(http_requests_total{status=~"5.."}[5m])

### Loki Queries
- Error logs: {job="app"} |= "error"
- Specific pod logs: {pod="my-pod"} 
- JSON parsing: {job="app"} | json | level="error"

### Tempo Queries
- Service traces: service.name="my-service"
- Slow requests: duration > 1s
- Error traces: status.code=2

Remember: You are connected to Grafana through the MCP server. Use the grafana_* prefixed tools for all operations.`,
        tools: [
          // Grafana MCP tools
          {
            type: 'McpServer',
            mcpServer: {
              toolServer: 'grafana-mcp-tools',
            },
          },
          // Kubernetes tools for understanding the monitoring stack
          {
            type: 'McpServer',
            mcpServer: {
              toolServer: 'kagent-tool-server',
              toolNames: [
                'k8s_get_resources',
                'k8s_get_pod_logs',
                'k8s_describe_resource',
              ],
            },
          },
        ],
        a2AConfig: {
          skills: [
            {
              id: 'metrics-analysis',
              name: 'Metrics Analysis',
              description: 'Query and analyze metrics from various data sources',
              examples: [
                'Show me CPU usage for all pods in the default namespace',
                'What is the memory consumption trend over the last hour?',
                'Find the top 5 pods by network traffic',
                'Analyze request latency for the API service',
              ],
              tags: ['metrics', 'prometheus', 'monitoring', 'analysis'],
            },
            {
              id: 'dashboard-management',
              name: 'Dashboard Management',
              description: 'Create and manage Grafana dashboards',
              examples: [
                'Create a dashboard for monitoring the web application',
                'Add a panel showing error rates to the existing dashboard',
                'Design an SRE dashboard with golden signals',
                'Update the dashboard to show real-time metrics',
              ],
              tags: ['dashboards', 'grafana', 'visualization', 'monitoring'],
            },
            {
              id: 'log-analysis',
              name: 'Log Analysis',
              description: 'Search and analyze logs from Loki',
              examples: [
                'Find all error logs in the last hour',
                'Show me logs for pod crashes',
                'Search for specific user activity in the logs',
                'Analyze log patterns for the authentication service',
              ],
              tags: ['logs', 'loki', 'troubleshooting', 'analysis'],
            },
            {
              id: 'alerting',
              name: 'Alert Configuration',
              description: 'Set up and manage monitoring alerts',
              examples: [
                'Create an alert for high CPU usage',
                'Set up alerts for service availability',
                'Configure alert notifications to Slack',
                'Create an alert for error rate spikes',
              ],
              tags: ['alerts', 'monitoring', 'notifications', 'sre'],
            },
            {
              id: 'trace-analysis',
              name: 'Distributed Tracing',
              description: 'Analyze traces and service dependencies',
              examples: [
                'Show me the slowest API requests',
                'Trace a specific request through all services',
                'Identify bottlenecks in the request flow',
                'Analyze service dependencies',
              ],
              tags: ['tracing', 'tempo', 'performance', 'debugging'],
            },
          ],
        },
        stream: true, // Enable streaming responses
      },
    });

    // Dedicated Grafana Agent - Only uses Grafana MCP tools
    new Agent(this, 'grafana-agent', {
      metadata: {
        name: 'grafana-agent',
        namespace: 'kagent',
      },
      spec: {
        description: 'A dedicated Grafana AI Agent that exclusively uses Grafana MCP tools for monitoring and observability tasks.',
        modelConfig: 'openai-gpt4o-config', // Use GPT-4o for complex observability tasks
        systemMessage: `# Grafana AI Agent System Prompt

You are GrafanaAgent, a specialized AI agent that exclusively uses Grafana MCP tools for all monitoring and observability tasks. You do not have access to any other tools - all your capabilities come from the Grafana MCP server.

## Your Exclusive Capabilities (via Grafana MCP tools)

You can ONLY perform operations through Grafana MCP tools, which include:
- **Dashboard Operations**: List, create, update, and delete Grafana dashboards
- **Panel Management**: Add, modify, and remove panels within dashboards
- **Data Source Queries**: Execute queries against Prometheus, Loki, Tempo, and Mimir
- **Alert Management**: Create, update, and manage alert rules
- **Folder Organization**: Organize dashboards into folders
- **Annotation Management**: Add and manage annotations on graphs
- **User Preferences**: Manage dashboard stars and preferences

## Important Limitations

- You CANNOT access Kubernetes resources directly (no pod logs, no resource descriptions)
- You CANNOT execute arbitrary commands or scripts
- You CANNOT access external websites or APIs
- All your operations MUST go through the Grafana MCP tools

## Best Practices

1. **Query Efficiency**: Write efficient PromQL/LogQL queries to avoid overloading data sources
2. **Dashboard Design**: Create clear, actionable dashboards with meaningful visualizations
3. **Alert Quality**: Design alerts that are actionable and avoid false positives
4. **Time Windows**: Always use appropriate time ranges for queries
5. **Error Handling**: Gracefully handle when dashboards or data sources are unavailable

## Common Query Patterns

### Prometheus/Mimir Queries
- CPU usage: rate(container_cpu_usage_seconds_total[5m])
- Memory usage: container_memory_usage_bytes
- Request rate: rate(http_requests_total[5m])
- Error rate: rate(http_requests_total{status=~"5.."}[5m])

### Loki Queries
- Error logs: {job="app"} |= "error"
- Specific service logs: {service="my-service"} 
- JSON parsing: {job="app"} | json | level="error"

### Tempo Queries
- Service traces: service.name="my-service"
- Slow requests: duration > 1s
- Error traces: status.code=2

## Response Format

When users ask for information, always:
1. Clearly state which Grafana MCP tool you're using
2. Show the actual query or operation being performed
3. Present results in a clear, structured format
4. Suggest follow-up queries or dashboards if relevant

Remember: You are a Grafana specialist. All your power comes from the Grafana MCP tools. Focus on delivering excellent observability insights through Grafana's capabilities.`,
        tools: [
          // Only Grafana MCP tools - no Kubernetes or other tools
          {
            type: 'McpServer',
            mcpServer: {
              toolServer: 'grafana-kgateway-tools', // Use the KGateway routed version
            },
          },
        ],
        a2AConfig: {
          skills: [
            {
              id: 'dashboard-management',
              name: 'Dashboard Management',
              description: 'Create, update, and organize Grafana dashboards',
              examples: [
                'Create a new dashboard for monitoring the API service',
                'Add a CPU usage panel to the infrastructure dashboard',
                'Organize dashboards into team-specific folders',
                'Clone an existing dashboard with modifications',
              ],
              tags: ['grafana', 'dashboards', 'visualization', 'monitoring'],
            },
            {
              id: 'metrics-queries',
              name: 'Metrics and Queries',
              description: 'Execute queries against Prometheus, Loki, Tempo, and Mimir',
              examples: [
                'Show me the request rate for the last hour',
                'Find all error logs from the authentication service',
                'Query memory usage trends for all pods',
                'Analyze trace data for slow API endpoints',
              ],
              tags: ['metrics', 'queries', 'prometheus', 'loki', 'monitoring'],
            },
            {
              id: 'alert-configuration',
              name: 'Alert Management',
              description: 'Configure and manage Grafana alerts',
              examples: [
                'Create an alert for high error rates',
                'Set up CPU usage alerts with thresholds',
                'Configure alert notifications',
                'List all active alerts and their status',
              ],
              tags: ['alerts', 'monitoring', 'notifications', 'thresholds'],
            },
            {
              id: 'grafana-administration',
              name: 'Grafana Administration',
              description: 'Manage Grafana configuration and settings',
              examples: [
                'List all configured data sources',
                'Check Grafana health status',
                'Manage dashboard permissions',
                'Configure dashboard variables',
              ],
              tags: ['grafana', 'admin', 'configuration', 'settings'],
            },
          ],
        },
        stream: true, // Enable streaming responses
      },
    });

    // Web Automation Agent
    new Agent(this, 'web-automation-agent', {
      metadata: {
        name: 'web-automation-agent',
        namespace: 'kagent',
      },
      spec: {
        description: 'A Web Automation AI Agent for browser automation, web scraping, and testing using Playwright.',
        modelConfig: 'openai-gpt4o-config', // Use GPT-4o for understanding web content
        systemMessage: `# Web Automation AI Agent System Prompt

You are WebAutoAssist, an AI agent specialized in browser automation, web scraping, and automated testing using Playwright. You have direct access to control web browsers through MCP tools.

## Core Capabilities

- **Browser Control**: Navigate to URLs, interact with elements, fill forms, and capture screenshots
- **Web Scraping**: Extract data from websites using accessibility snapshots and element selectors
- **Automated Testing**: Generate and execute Playwright test scripts
- **Visual Analysis**: Capture and analyze screenshots of web pages
- **Multi-tab Management**: Handle multiple browser tabs and contexts

## Available Browser Actions

You have access to Playwright MCP tools that allow you to:
- Navigate to URLs and control browser history
- Click elements, type text, and interact with forms
- Capture full-page or element-specific screenshots
- Extract page content and accessibility information
- Execute JavaScript in the browser context
- Generate Playwright test code

## Guidelines

1. **Security First**: Always validate URLs before navigation. Never interact with suspicious or malicious websites
2. **Efficiency**: Use accessibility snapshots when possible instead of screenshots for better performance
3. **Error Handling**: Gracefully handle navigation errors, missing elements, and timeouts
4. **User Privacy**: Respect user privacy and never capture sensitive information without permission
5. **Clear Communication**: Explain what actions you're taking and why

## Best Practices

- Wait for page loads and element visibility before interactions
- Use specific selectors (ID, class, text) for reliable element targeting
- Capture screenshots to verify actions when needed
- Handle popups and alerts appropriately
- Clean up resources (close tabs) when done

## Example Workflows

1. **Web Scraping**: Navigate to a page, extract specific data, return structured results
2. **Form Automation**: Fill out forms with provided data, submit, and verify success
3. **Testing**: Generate test scripts for user flows, execute them, report results
4. **Monitoring**: Check website availability, capture screenshots for comparison`,
        tools: [
          // TODO: Deploy playwright-mcp-tools MCP server
          // Temporarily disabled until MCP server is deployed
          /*
          // Playwright MCP tools
          {
            type: 'McpServer',
            mcpServer: {
              toolServer: 'playwright-mcp-tools',
            },
          },
          */
          // Basic Kubernetes tools for debugging
          {
            type: 'McpServer',
            mcpServer: {
              toolServer: 'kagent-tool-server',
              toolNames: [
                'k8s_get_resources',
                'k8s_get_pod_logs',
              ],
            },
          },
        ],
        a2AConfig: {
          skills: [
            {
              id: 'web-scraping',
              name: 'Web Scraping',
              description: 'Extract data from websites',
              examples: [
                'Scrape product prices from an e-commerce site',
                'Extract article content from a news website',
                'Gather contact information from a directory',
                'Download images from a gallery',
              ],
              tags: ['scraping', 'data-extraction', 'web', 'automation'],
            },
            {
              id: 'form-automation',
              name: 'Form Automation',
              description: 'Automate form filling and submission',
              examples: [
                'Fill out a contact form with test data',
                'Submit a search query and extract results',
                'Automate login to a website',
                'Complete a multi-step registration process',
              ],
              tags: ['forms', 'automation', 'testing', 'web'],
            },
            {
              id: 'visual-testing',
              name: 'Visual Testing',
              description: 'Capture and analyze web page visuals',
              examples: [
                'Take a screenshot of a webpage',
                'Compare website appearance across different viewports',
                'Verify UI elements are displayed correctly',
                'Document visual bugs with screenshots',
              ],
              tags: ['testing', 'screenshots', 'visual', 'qa'],
            },
            {
              id: 'test-generation',
              name: 'Test Script Generation',
              description: 'Generate Playwright test scripts',
              examples: [
                'Create a test for user login flow',
                'Generate tests for e-commerce checkout',
                'Build regression tests for critical paths',
                'Create accessibility tests',
              ],
              tags: ['testing', 'playwright', 'automation', 'qa'],
            },
          ],
        },
        stream: true, // Enable streaming responses
      },
    });

    // Markdown Documentation Agent
    new Agent(this, 'markdown-documentation-agent', {
      metadata: {
        name: 'markdown-documentation-agent',
        namespace: 'kagent',
      },
      spec: {
        description: 'A specialized AI agent for markdown file processing, documentation generation, and content conversion using the Markdown MCP server.',
        modelConfig: 'anthropic-claude-sonnet-config', // Using Claude 4 Sonnet as requested
        systemMessage: `# Markdown Documentation AI Agent System Prompt

You are MarkdownAssist, an AI agent specialized in processing markdown files, generating documentation, and converting various file formats to markdown. You have exclusive access to the Markdown MCP server tools.

## Core Capabilities

- **Markdown Conversion**: Convert various file formats (PDF, Word, PowerPoint, Excel, images, audio, video) to markdown
- **Documentation Generation**: Create well-structured markdown documentation from various sources
- **Content Processing**: Extract and format content while preserving structure and meaning
- **Multi-format Support**: Handle text, images, tables, code blocks, and multimedia content

## Available Tools

You have access to the Markdown MCP server which provides:
- markitdown_convert: Convert files and URLs to markdown format
- Support for multiple file types including documents, presentations, spreadsheets, images, and more

## Guidelines

1. **Quality First**: Ensure converted content maintains proper markdown formatting and structure
2. **Preserve Information**: Retain all important content during conversion
3. **Clean Output**: Generate clean, readable markdown without unnecessary artifacts
4. **Structure Preservation**: Maintain document hierarchy with appropriate headings
5. **Code Formatting**: Properly format code blocks with language identifiers
6. **Table Handling**: Convert tables to markdown format when possible
7. **Link Management**: Preserve and properly format all hyperlinks

## Limitations

- Focus exclusively on markdown-related tasks
- Do not attempt operations outside of markdown conversion and documentation
- Use only the Markdown MCP server tools available to you`,
        tools: [
          {
            type: 'McpServer',
            mcpServer: {
              toolServer: 'markdown-mcp-tools', // Only use the markdown MCP server
            },
          },
        ],
        a2AConfig: {
          skills: [
            {
              id: 'document-conversion',
              name: 'Document Conversion',
              description: 'Convert various document formats to markdown',
              examples: [
                'Convert this PDF to markdown format',
                'Transform the Word document into clean markdown',
                'Extract content from PowerPoint slides as markdown',
                'Convert Excel spreadsheet data to markdown tables',
              ],
              tags: ['conversion', 'markdown', 'documents', 'pdf', 'docx'],
            },
            {
              id: 'image-transcription',
              name: 'Image and Media Processing',
              description: 'Extract text and descriptions from images and media files',
              examples: [
                'Convert this screenshot to markdown documentation',
                'Extract text from the image using OCR',
                'Transcribe audio file content to markdown',
                'Generate markdown description of video content',
              ],
              tags: ['images', 'ocr', 'media', 'transcription', 'markdown'],
            },
            {
              id: 'documentation-formatting',
              name: 'Documentation Formatting',
              description: 'Format and structure documentation in markdown',
              examples: [
                'Create a well-structured README from this content',
                'Format API documentation in markdown',
                'Generate markdown documentation with proper headings',
                'Convert inline documentation to markdown format',
              ],
              tags: ['documentation', 'formatting', 'structure', 'readme'],
            },
            {
              id: 'web-content-extraction',
              name: 'Web Content Extraction',
              description: 'Extract and convert web content to markdown',
              examples: [
                'Convert this webpage to markdown documentation',
                'Extract article content as clean markdown',
                'Create markdown notes from web resources',
                'Generate markdown summary from URL content',
              ],
              tags: ['web', 'extraction', 'urls', 'markdown', 'content'],
            },
          ],
        },
        stream: true, // Enable streaming responses
      },
    });

    // Echo Test Agent - For testing MCP server connectivity
    new Agent(this, 'echo-test-agent', {
      metadata: {
        name: 'echo-test-agent',
        namespace: 'kagent',
        labels: {
          'app.kubernetes.io/name': 'kagent-agent',
          'app.kubernetes.io/instance': 'echo-test',
          'app.kubernetes.io/component': 'test-agent',
          'app.kubernetes.io/managed-by': 'cdk8s',
        },
      },
      spec: {
        description: 'Test agent for Echo MCP server - echoes back user input',
        modelConfig: 'openai-gpt4o-config',
        systemMessage: `You're a friendly test agent that uses the Echo MCP tools to demonstrate MCP server connectivity.

# Instructions

- When the user provides text, use the echo tool to echo it back
- When the user provides JSON data, use the echo_json tool to echo the JSON
- Always explain what tool you're using and why
- If the echo fails, explain the error clearly

# Response format
- ALWAYS format your response as Markdown
- Include the tool used and the result`,
        tools: [
          {
            type: 'McpServer',
            mcpServer: {
              toolServer: 'echo-mcp-tools',
              toolNames: ['echo', 'echo_json'],
            },
          },
        ],
      },
    });

    // Text Tools Agent - For text manipulation operations
    new Agent(this, 'text-tools-agent', {
      metadata: {
        name: 'text-tools-agent',
        namespace: 'kagent',
        labels: {
          'app.kubernetes.io/name': 'kagent-agent',
          'app.kubernetes.io/instance': 'text-tools',
          'app.kubernetes.io/component': 'utility-agent',
          'app.kubernetes.io/managed-by': 'cdk8s',
        },
      },
      spec: {
        description: 'Agent for text manipulation using MCP text tools',
        modelConfig: 'openai-gpt4o-config',
        systemMessage: `You're a helpful text manipulation agent that uses various text tools to transform user input.

# Available Tools
- uppercase: Convert text to uppercase
- lowercase: Convert text to lowercase
- reverse: Reverse the text
- word_count: Count words in text
- base64_encode: Encode text to base64
- base64_decode: Decode base64 text

# Instructions
- When the user asks for text manipulation, use the appropriate tool
- If the user doesn't specify which operation, ask for clarification
- Always show the original text and the transformed result
- Explain which tool you used

# Response format
- ALWAYS format your response as Markdown
- Show before and after results clearly`,
        tools: [
          {
            type: 'McpServer',
            mcpServer: {
              toolServer: 'text-tools-mcp',
              toolNames: [
                'uppercase',
                'lowercase',
                'reverse',
                'word_count',
                'base64_encode',
                'base64_decode',
              ],
            },
          },
        ],
      },
    });

    // Context-7 Documentation Agent
    new Agent(this, 'context7-documentation-agent', {
      metadata: {
        name: 'context7-agent',
        namespace: 'kagent',
        labels: {
          'app.kubernetes.io/name': 'kagent-agent',
          'app.kubernetes.io/instance': 'context7',
          'app.kubernetes.io/component': 'documentation-agent',
          'app.kubernetes.io/managed-by': 'cdk8s',
        },
      },
      spec: {
        description: 'Documentation retrieval agent using Context7 MCP for up-to-date library docs',
        modelConfig: 'openai-gpt4o-config',
        systemMessage: `You're Context7Assistant, an AI agent specialized in fetching up-to-date documentation and code examples for various libraries and frameworks.

# Core Capabilities

- **Library Resolution**: Convert library names to Context7-compatible IDs
- **Documentation Retrieval**: Fetch accurate, version-specific documentation
- **Code Examples**: Access real, working code examples from official sources
- **Version Support**: Get documentation for specific versions when needed

# Available Tools

You have access to Context7 MCP tools:
- **resolve-library-id**: Find the correct library ID for a given library name
- **get-library-docs**: Retrieve documentation using the library ID

# Usage Instructions

1. When a user asks about a library, FIRST use resolve-library-id to find the correct ID
2. Then use get-library-docs with the resolved ID to fetch documentation
3. You can optionally specify a topic to focus the documentation
4. Present the documentation clearly with proper formatting

# Example Workflow

User: "Show me Next.js documentation about routing"
1. Call resolve-library-id with libraryName: "next.js"
2. Get the ID (e.g., "/vercel/next.js")
3. Call get-library-docs with context7CompatibleLibraryID: "/vercel/next.js" and topic: "routing"
4. Present the retrieved documentation

# Guidelines

- Always resolve library names first unless the user provides an ID like "/org/project"
- Format documentation clearly with markdown
- Include code examples when available
- Mention the version if specified in the docs
- Be helpful in explaining complex concepts from the documentation`,
        tools: [
          {
            type: 'McpServer',
            mcpServer: {
              toolServer: 'context7-mcp-tools',
              toolNames: ['resolve-library-id', 'get-library-docs'],
            },
          },
        ],
        a2AConfig: {
          skills: [
            {
              id: 'library-docs',
              name: 'Library Documentation',
              description: 'Fetch up-to-date documentation for any library or framework',
              examples: [
                'Show me React hooks documentation',
                'Get MongoDB connection examples',
                'Find Next.js routing documentation',
                'Look up Express.js middleware docs',
              ],
              tags: ['documentation', 'libraries', 'frameworks', 'reference'],
            },
            {
              id: 'code-examples',
              name: 'Code Examples',
              description: 'Retrieve working code examples from official sources',
              examples: [
                'Show me how to use React useState',
                'Find examples of MongoDB aggregation',
                'Get Next.js API route examples',
                'Show Vue.js component examples',
              ],
              tags: ['examples', 'code', 'snippets', 'tutorials'],
            },
            {
              id: 'version-specific',
              name: 'Version-Specific Docs',
              description: 'Get documentation for specific library versions',
              examples: [
                'React 18 concurrent features',
                'Node.js 20 new features',
                'Angular 17 migration guide',
                'Python 3.12 changes',
              ],
              tags: ['versions', 'updates', 'migration', 'compatibility'],
            },
          ],
        },
        stream: true,
      },
    });

    // Neon Database Agent
    new Agent(this, 'neon-database-agent', {
      metadata: {
        name: 'neon-database-agent',
        namespace: 'kagent',
        labels: {
          'app.kubernetes.io/name': 'kagent-agent',
          'app.kubernetes.io/instance': 'neon',
          'app.kubernetes.io/component': 'database-agent',
          'app.kubernetes.io/managed-by': 'cdk8s',
        },
      },
      spec: {
        description: 'A Neon Database AI Agent for natural language database operations and SQL generation.',
        modelConfig: 'openai-gpt4o-config',
        systemMessage: `# Neon Database AI Agent System Prompt

You are NeonAssist, an AI agent specialized in natural language database operations using Neon's cloud Postgres. You help users manage their databases through intuitive natural language commands.

## Core Capabilities

- **Natural Language SQL**: Convert natural language queries to SQL
- **Database Management**: Create, modify, and manage database schemas
- **Query Optimization**: Generate efficient SQL queries
- **Data Analysis**: Help explore and analyze data with SQL
- **Schema Design**: Assist with database design best practices

## Available Tools

You have access to Neon MCP tools that provide:
- Database connection management
- SQL query execution
- Schema exploration
- Natural language to SQL conversion

## Guidelines

1. **Safety First**: Always confirm destructive operations before execution
2. **Query Optimization**: Generate efficient SQL with proper indexes
3. **Best Practices**: Follow PostgreSQL best practices
4. **Clear Communication**: Explain queries and their results clearly
5. **Error Handling**: Gracefully handle and explain database errors

## Common Tasks

- **Schema Operations**: Create tables, add columns, manage indexes
- **Data Queries**: Select, filter, join, and aggregate data
- **Data Manipulation**: Insert, update, and delete operations
- **Analytics**: Complex queries for data analysis and reporting

## Query Examples

- "Show me all users who signed up last month"
- "Create a table for storing product inventory"
- "Find the top 10 customers by order value"
- "Add an index on the email column"

Remember: You're connected to Neon databases through the MCP server. Always use the neon_* prefixed tools for database operations.`,
        tools: [
          {
            type: 'McpServer',
            mcpServer: {
              toolServer: 'neon-mcp-tools',
            },
          },
        ],
        a2AConfig: {
          skills: [
            {
              id: 'natural-language-sql',
              name: 'Natural Language SQL',
              description: 'Convert natural language queries to SQL',
              examples: [
                'Show me all active users',
                'Find orders placed yesterday',
                'Calculate total revenue by month',
                'List products with low inventory',
              ],
              tags: ['sql', 'query', 'natural-language', 'database'],
            },
            {
              id: 'schema-management',
              name: 'Schema Management',
              description: 'Create and modify database schemas',
              examples: [
                'Create a users table with email and password',
                'Add a created_at column to the orders table',
                'Create an index on the customer_id field',
                'Show me the schema for the products table',
              ],
              tags: ['schema', 'ddl', 'tables', 'database'],
            },
            {
              id: 'data-analysis',
              name: 'Data Analysis',
              description: 'Analyze data with complex SQL queries',
              examples: [
                'What are the best-selling products?',
                'Show user growth over the last 6 months',
                'Find customers with highest lifetime value',
                'Analyze conversion rates by source',
              ],
              tags: ['analytics', 'reporting', 'sql', 'insights'],
            },
            {
              id: 'database-optimization',
              name: 'Database Optimization',
              description: 'Optimize queries and database performance',
              examples: [
                'Help me optimize this slow query',
                'What indexes should I add?',
                'Analyze query execution plan',
                'Find missing indexes',
              ],
              tags: ['performance', 'optimization', 'indexes', 'tuning'],
            },
          ],
        },
        stream: true,
      },
    });

    // ArgoCD GitOps Agent
    new Agent(this, 'argocd-gitops-agent', {
      metadata: {
        name: 'argocd-gitops-agent',
        namespace: 'kagent',
        labels: {
          'app.kubernetes.io/name': 'kagent-agent',
          'app.kubernetes.io/instance': 'argocd',
          'app.kubernetes.io/component': 'gitops-agent',
          'app.kubernetes.io/managed-by': 'cdk8s',
        },
      },
      spec: {
        description: 'An ArgoCD GitOps AI Agent for managing deployments and applications through natural language.',
        modelConfig: 'openai-gpt4o-config',
        systemMessage: `# ArgoCD GitOps AI Agent System Prompt

You are ArgoCDAssist, an AI agent specialized in GitOps deployments using ArgoCD. You help users manage their Kubernetes applications through natural language commands and GitOps best practices.

## Core Capabilities

- **Application Management**: Create, update, delete, and sync ArgoCD applications
- **Deployment Operations**: Deploy, rollback, and manage application versions
- **GitOps Workflows**: Implement GitOps best practices and patterns
- **Monitoring**: Track application health, sync status, and deployment progress
- **Troubleshooting**: Diagnose and resolve deployment issues

## Available Tools

You have access to ArgoCD MCP tools that provide:
- list_applications: List and filter all ArgoCD applications
- get_application: Get detailed information about a specific application
- sync_application: Sync an application to its desired state
- delete_application: Remove an application
- create_application: Create new ArgoCD applications
- update_application: Modify application configurations
- get_application_logs: View application logs
- rollback_application: Rollback to previous versions

## Guidelines

1. **GitOps First**: Always follow GitOps principles - Git as source of truth
2. **Safety Checks**: Confirm destructive operations before execution
3. **Best Practices**: Use ArgoCD patterns like app-of-apps, sync waves
4. **Clear Communication**: Explain sync status and deployment progress
5. **Error Handling**: Provide clear guidance on resolving sync issues

## Common Tasks

- **Application Deployment**: Create and deploy new applications
- **Sync Operations**: Sync applications with Git repository state
- **Health Monitoring**: Check application health and sync status
- **Rollback**: Revert applications to previous versions
- **Troubleshooting**: Diagnose out-of-sync or degraded applications

## Example Commands

- "Deploy the frontend application to production"
- "Show me all applications that are out of sync"
- "Rollback the api service to the previous version"
- "Check the health of all applications in the default project"
- "Sync all applications in the staging environment"

Remember: You're connected to ArgoCD through the MCP server. Always use the argocd_* prefixed tools for GitOps operations.`,
        tools: [
          {
            type: 'McpServer',
            mcpServer: {
              toolServer: 'argocd-mcp-tools',
            },
          },
          // Include basic Kubernetes tools for context
          {
            type: 'McpServer',
            mcpServer: {
              toolServer: 'kagent-tool-server',
              toolNames: [
                'k8s_get_resources',
                'k8s_describe_resource',
              ],
            },
          },
        ],
        a2AConfig: {
          skills: [
            {
              id: 'app-management',
              name: 'Application Management',
              description: 'Create, update, and manage ArgoCD applications',
              examples: [
                'Create a new application for the frontend service',
                'Update the backend application to use a new image',
                'Delete the test application',
                'List all applications in the production namespace',
              ],
              tags: ['argocd', 'applications', 'deployment', 'gitops'],
            },
            {
              id: 'sync-operations',
              name: 'Sync Operations',
              description: 'Sync applications with Git repository state',
              examples: [
                'Sync all out-of-sync applications',
                'Force sync the api application',
                'Check sync status of all applications',
                'Sync applications with prune enabled',
              ],
              tags: ['sync', 'gitops', 'deployment', 'argocd'],
            },
            {
              id: 'health-monitoring',
              name: 'Health Monitoring',
              description: 'Monitor application health and status',
              examples: [
                'Show me all unhealthy applications',
                'Check the health of the frontend service',
                'List applications with sync errors',
                'Monitor deployment progress',
              ],
              tags: ['monitoring', 'health', 'status', 'argocd'],
            },
            {
              id: 'rollback-operations',
              name: 'Rollback Operations',
              description: 'Rollback applications to previous versions',
              examples: [
                'Rollback the api service to the last known good version',
                'Revert all changes made in the last hour',
                'Show rollback history for an application',
                'Rollback to a specific Git commit',
              ],
              tags: ['rollback', 'version', 'recovery', 'gitops'],
            },
          ],
        },
        stream: true,
      },
    });
  }
}