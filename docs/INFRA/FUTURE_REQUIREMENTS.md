# Future Deployment Requirements

This document tracks infrastructure tasks that are deferred until a domain name is assigned to the instance.

## 1. Domain Name Mapping
- Purchase/Assign a domain (e.g., `api.neoterritory.com`).
- Update the AWS Lightsail/EC2 static IP to point to the domain via A-records in your DNS provider (Route53, Cloudflare, etc.).

## 2. SSL/TLS (Let's Encrypt)
- Once a domain is mapped, run `certbot` to obtain certificates.
- The `deploy-aws` scripts have been updated with placeholders to assist this.
- Commands to run on the server:
  ```bash
  sudo apt-get update
  sudo apt-get install certbot python3-certbot-nginx
  sudo certbot --nginx -d yourdomain.com
  ```

## 3. Production HTTPS Routing
- Ensure `Codebase/Backend` is configured to handle the `X-Forwarded-Proto` header if behind a reverse proxy (Nginx).
- The `httpsHandler` adapter in the backend is prepared to enforce HTTPS when a domain is active.

## 4. Decoupled Fastify Service
- The Fastify service in `Codebase/FastifyService` should be deployed as a sidecar or a separate container.
- Update `BACKEND_FASTIFY_URL` in the production `.env` to point to this service.
