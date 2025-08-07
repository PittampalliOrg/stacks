# Kargo-Gitea Webhook Configuration

## Configuration Details

### Webhook URL
https://kargo-webhooks.cnoe.localtest.me:8443/webhooks/github/661cf0989545b1bd92b763966c09315f5e6fa5d0b48e79ee79fa983acde57967

### Webhook Secret
lwxtOFx10Jrox11Zi40r3L3zEvR6J8q9

## Gitea Configuration Steps

1. Navigate to https://gitea.cnoe.localtest.me:8443/
2. Go to Organization Settings > Webhooks
3. Add new webhook with:
   - Target URL: (see above)
   - Secret: (see above)
   - Trigger: Package Events
   - Skip TLS Verification: Yes
EOF < /dev/null
