#!/bin/bash

echo "🚀 Setting up NGINX Proxy for WSL2 Browser Access (idpbuilder/cnoe)"
echo "=================================================================="
echo ""

# Get the Kind control plane container details for idpbuilder
KIND_CLUSTER_NAME="${KIND_CLUSTER_NAME:-localdev}"
CP_NAME=$(docker ps --filter "label=io.x-k8s.kind.cluster=${KIND_CLUSTER_NAME}" \
                    --filter "label=io.x-k8s.kind.role=control-plane" \
                    --format '{{.Names}}' | head -n 1)

if [[ -z "$CP_NAME" ]]; then
    echo "❌ ERROR: Could not locate Kind control-plane container for cluster '${KIND_CLUSTER_NAME}'."
    echo "   Make sure idpbuilder is running."
    exit 1
fi

CP_IP=$(docker inspect -f "{{.NetworkSettings.Networks.kind.IPAddress}}" "${CP_NAME}" 2>/dev/null)
if [[ -z "$CP_IP" ]]; then
    echo "❌ ERROR: Could not get IP address for Kind control-plane node '${CP_NAME}'."
    exit 1
fi

echo "✅ Found Kind control-plane: Name='${CP_NAME}', IP='${CP_IP}'"

# Create nginx configuration
WORK_DIR=$(mktemp -d)
proxy_container_name="idpbuilder-nginx-proxy"

echo "📝 Creating NGINX configuration..."
cat >"${WORK_DIR}/nginx.conf" <<EOF
events {}

# HTTP proxy with host-based routing
http {
  # Upstream for idpbuilder's ingress-nginx NodePorts
  upstream ingress {
    server ${CP_IP}:30666;  # HTTP NodePort
  }
  
  upstream ingress_ssl {
    server ${CP_IP}:30791;  # HTTPS NodePort (8443)
  }

  # Main server block that handles all HTTP requests
  server {
    listen 80;
    server_name *.cnoe.localtest.me;
    
    location / {
      proxy_pass http://ingress;
      proxy_set_header Host \$host;
      proxy_set_header X-Real-IP \$remote_addr;
      proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto \$scheme;
      
      # WebSocket support (for live updates)
      proxy_http_version 1.1;
      proxy_set_header Upgrade \$http_upgrade;
      proxy_set_header Connection "upgrade";
      
      # Increase timeouts for long-running requests
      proxy_connect_timeout 60s;
      proxy_send_timeout 60s;
      proxy_read_timeout 60s;
    }
  }
  
  # SSL support - forwards to idpbuilder's HTTPS ingress
  server {
    listen 443;
    server_name *.cnoe.localtest.me;
    
    location / {
      proxy_pass https://ingress_ssl;
      proxy_set_header Host \$host;
      proxy_set_header X-Real-IP \$remote_addr;
      proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto https;
      
      # WebSocket support
      proxy_http_version 1.1;
      proxy_set_header Upgrade \$http_upgrade;
      proxy_set_header Connection "upgrade";
      
      # SSL settings
      proxy_ssl_verify off;
      
      # Increase timeouts
      proxy_connect_timeout 60s;
      proxy_send_timeout 60s;
      proxy_read_timeout 60s;
    }
  }
}
EOF

# Check if proxy container already exists
if docker inspect "$proxy_container_name" &>/dev/null; then
    echo "🔄 Removing existing proxy container..."
    docker rm -f "$proxy_container_name" &>/dev/null || true
fi

# Run nginx proxy container
echo "🏃 Starting NGINX proxy container..."
docker run -d \
    --name "$proxy_container_name" \
    --network kind \
    --restart unless-stopped \
    -p 80:80 \
    -p 443:443 \
    -v "${WORK_DIR}/nginx.conf:/etc/nginx/nginx.conf:ro" \
    nginx:alpine

# Wait for proxy to be ready
echo "⏳ Waiting for proxy to be ready..."
sleep 2

# Test the proxy
echo ""
echo "🧪 Testing proxy connectivity..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost -H "Host: argocd.cnoe.localtest.me" --max-time 5 | grep -q "200\|301\|302\|307"; then
    echo "✅ Proxy is working!"
else
    echo "⚠️  Proxy might need a moment to initialize"
fi

echo ""
echo "🎯 Browser Access URLs (Standard Ports):"
echo "======================================="
echo "ArgoCD:         http://argocd.cnoe.localtest.me"
echo "Gitea:          http://gitea.cnoe.localtest.me"
echo "Backstage:      http://backstage.cnoe.localtest.me"
echo "NextJS Chat:    http://chat.cnoe.localtest.me"
echo "Headlamp:       http://headlamp.cnoe.localtest.me"
echo "Kargo UI:       http://kargo.cnoe.localtest.me"
echo "Keycloak:       http://keycloak.cnoe.localtest.me"
echo ""
echo "🔒 HTTPS Access (port 443) is also available for all services"
echo ""
echo "🔑 Default Credentials:"
echo "======================"
echo "ArgoCD:"
echo "  Username: admin"
echo "  Password: $(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" 2>/dev/null | base64 -d || echo 'Check: kubectl -n argocd get secret argocd-initial-admin-secret')"
echo ""
echo "Gitea:"
echo "  Username: giteaAdmin"
echo "  Password: giteaPassword"
echo ""
echo "Kargo:"
echo "  Username: admin"
echo "  Password: admin"
echo ""
echo "💡 Notes:"
echo "  - The proxy container will continue running in the background"
echo "  - Both standard ports (80/443) and idpbuilder port (8443) will work"
echo "  - To stop proxy: docker stop $proxy_container_name"
echo "  - To remove proxy: docker rm -f $proxy_container_name"
echo "  - To view logs: docker logs $proxy_container_name"
echo ""

# Clean up temp directory
rm -rf "${WORK_DIR}"