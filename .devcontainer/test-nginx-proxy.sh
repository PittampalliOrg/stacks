#!/bin/bash

echo "🧪 Testing NGINX Proxy for idpbuilder/cnoe"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if proxy container is running
echo "1️⃣  Checking proxy container status..."
if docker ps --filter "name=idpbuilder-nginx-proxy" --format '{{.Names}}' | grep -q "idpbuilder-nginx-proxy"; then
    echo -e "${GREEN}✅ Proxy container is running${NC}"
    docker ps --filter "name=idpbuilder-nginx-proxy" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
else
    echo -e "${RED}❌ Proxy container is not running${NC}"
    echo "   Run: /home/vscode/workspace/stacks/.devcontainer/setup-nginx-proxy.sh"
    exit 1
fi

echo ""
echo "2️⃣  Checking proxy logs for errors..."
ERRORS=$(docker logs idpbuilder-nginx-proxy 2>&1 | grep -i error | tail -5)
if [ -n "$ERRORS" ]; then
    echo -e "${YELLOW}⚠️  Found errors in proxy logs:${NC}"
    echo "$ERRORS"
else
    echo -e "${GREEN}✅ No errors in proxy logs${NC}"
fi

echo ""
echo "3️⃣  Testing HTTP connectivity (port 80)..."
echo "----------------------------------------"

# List of services to test
declare -A services=(
    ["ArgoCD"]="argocd.cnoe.localtest.me"
    ["Gitea"]="gitea.cnoe.localtest.me"
    ["Backstage"]="backstage.cnoe.localtest.me"
    ["Kargo"]="kargo.cnoe.localtest.me"
)

for service in "${!services[@]}"; do
    host="${services[$service]}"
    echo -n "Testing $service ($host): "
    
    # Test HTTP
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost -H "Host: $host" --max-time 5 2>/dev/null)
    
    if [[ "$HTTP_CODE" =~ ^(200|301|302|307|308)$ ]]; then
        echo -e "${GREEN}✅ HTTP OK (Status: $HTTP_CODE)${NC}"
    else
        echo -e "${RED}❌ HTTP Failed (Status: $HTTP_CODE)${NC}"
    fi
done

echo ""
echo "4️⃣  Testing HTTPS connectivity (port 443)..."
echo "-----------------------------------------"

for service in "${!services[@]}"; do
    host="${services[$service]}"
    echo -n "Testing $service ($host): "
    
    # Test HTTPS (with --insecure for self-signed certs)
    HTTPS_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://localhost -H "Host: $host" --insecure --max-time 5 2>/dev/null)
    
    if [[ "$HTTPS_CODE" =~ ^(200|301|302|307|308)$ ]]; then
        echo -e "${GREEN}✅ HTTPS OK (Status: $HTTPS_CODE)${NC}"
    else
        echo -e "${RED}❌ HTTPS Failed (Status: $HTTPS_CODE)${NC}"
    fi
done

echo ""
echo "5️⃣  Testing direct NodePort access..."
echo "-----------------------------------"

# Get NodePort info
HTTP_NODEPORT=$(kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.spec.ports[?(@.name=="http")].nodePort}' 2>/dev/null)
HTTPS_NODEPORT=$(kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.spec.ports[?(@.name=="https")].nodePort}' 2>/dev/null)

if [ -n "$HTTP_NODEPORT" ] && [ -n "$HTTPS_NODEPORT" ]; then
    echo -e "HTTP NodePort:  ${YELLOW}$HTTP_NODEPORT${NC}"
    echo -e "HTTPS NodePort: ${YELLOW}$HTTPS_NODEPORT${NC}"
    
    # Test direct NodePort access
    echo -n "Testing direct NodePort HTTP: "
    NODEPORT_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$HTTP_NODEPORT -H "Host: argocd.cnoe.localtest.me" --max-time 5 2>/dev/null)
    if [[ "$NODEPORT_CODE" =~ ^(200|301|302|307|308|404)$ ]]; then
        echo -e "${GREEN}✅ NodePort accessible${NC}"
    else
        echo -e "${RED}❌ NodePort not accessible${NC}"
    fi
else
    echo -e "${RED}❌ Could not determine NodePorts${NC}"
fi

echo ""
echo "6️⃣  DNS Resolution Check..."
echo "-------------------------"
for service in "${!services[@]}"; do
    host="${services[$service]}"
    echo -n "Resolving $host: "
    
    # Check DNS resolution
    if nslookup $host >/dev/null 2>&1; then
        IP=$(nslookup $host | grep -A1 "Name:" | grep "Address:" | awk '{print $2}')
        echo -e "${GREEN}✅ Resolves to $IP${NC}"
    else
        echo -e "${YELLOW}⚠️  DNS not configured (expected with /etc/hosts)${NC}"
    fi
done

echo ""
echo "7️⃣  Browser Access Instructions:"
echo "--------------------------------"
echo "From your WSL2 host browser, you should be able to access:"
echo ""
echo "HTTP URLs (port 80):"
for service in "${!services[@]}"; do
    echo "  - http://${services[$service]}"
done
echo ""
echo "HTTPS URLs (port 443):"
for service in "${!services[@]}"; do
    echo "  - https://${services[$service]}"
done

echo ""
echo "💡 Troubleshooting Tips:"
echo "----------------------"
echo "1. If URLs don't resolve, add to Windows hosts file:"
echo "   C:\\Windows\\System32\\drivers\\etc\\hosts"
echo "   Add: 127.0.0.1 *.cnoe.localtest.me"
echo ""
echo "2. View proxy logs:"
echo "   docker logs -f idpbuilder-nginx-proxy"
echo ""
echo "3. Test from WSL2 terminal:"
echo "   curl -H 'Host: argocd.cnoe.localtest.me' http://localhost"
echo ""
echo "4. Check proxy configuration:"
echo "   docker exec idpbuilder-nginx-proxy cat /etc/nginx/nginx.conf"