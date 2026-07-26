# Oracle Cloud Always Free — production backend ($0)

Chosen path when Railway/Render aren’t affordable: **one Always Free Ampere VM** running the same production Compose stack as Railway would.

```text
Internet → Oracle VM (Caddy optional) → Next.js web
                                    → Redis + BullMQ worker (Sarvam + ffmpeg)
         → Neon Postgres (keep — already production DB)
         → Local disk first, then Cloudflare R2 for videos
```

Vercel (`captions-gilt.vercel.app`) can stay as a demo; **real processing** moves here.

Related: [11-production-magazine.md](./11-production-magazine.md) · [env.production.example.md](./env.production.example.md) · `docker-compose.prod.yml` + `docker-compose.oracle.yml`

---

## What you get vs Vercel Hobby

| | Vercel (now) | Oracle Always Free |
|--|--------------|--------------------|
| Postgres | Neon ✅ | Neon ✅ (same) |
| Long ASR + ffmpeg | Timeouts / stuck jobs | Always-on **worker** |
| Queue | Inline | Redis + BullMQ |
| Cost | $0 | $0 (Always Free Ampere) |
| Ops | Low | You manage the VM |

---

## Phase overview

| Phase | Goal | You need |
|-------|------|----------|
| **A** | VM up + Docker + web/worker/redis + Neon | Oracle account + SSH |
| **B** | HTTPS domain + Google auth | Domain DNS |
| **C** | R2 for durable videos | Cloudflare account |
| **D** | Cut over from Vercel demo | Update `APP_URL` / OAuth |

Do **not** start with MongoDB or Firebase. Keep **Postgres (Neon)**.

---

## Phase A — Create the free VM (you do this in Oracle Console)

### A1. Account
1. Go to https://cloud.oracle.com and create an account (card may be required for verification; Always Free is still $0 if you stay in free shape).
2. Pick a home region close to users (e.g. Mumbai / Hyderabad if offered, else Singapore / Tokyo).

### A2. Networking
1. **Networking → Virtual Cloud Networks → Start VCN Wizard → Create VCN with Internet Connectivity**.
2. **Networking → Security Lists** (or NSG on the subnet) → Ingress:
   - `22` TCP (SSH) — restrict Source CIDR to your IP if possible
   - `3000` TCP (app smoke test)
   - Later for HTTPS: `80` and `443` TCP (Source `0.0.0.0/0`)

### A3. Compute instance
1. **Compute → Instances → Create Instance**
2. Name: `captions-prod`
3. Image: **Ubuntu 22.04** (aarch64)
4. Shape: **VM.Standard.A1.Flex** (Ampere) — Always Free eligible  
   Suggested: **2 OCPU / 12 GB RAM** (or 4 / 24 if the region allows and you have quota)
5. Networking: public subnet + **Assign public IPv4**
6. SSH keys: paste your public key (`ssh-keygen -t ed25519` if needed)
7. Create → copy **Public IP**

If A1.Flex is “out of capacity”, retry another AD/region or start with 1 OCPU / 6 GB and upgrade shape later.

### A4. SSH in

```bash
ssh -i ~/.ssh/your_key ubuntu@YOUR_PUBLIC_IP
```

---

## Phase A — Install Docker on the VM

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
# log out / back in so docker works without sudo
exit
ssh -i ~/.ssh/your_key ubuntu@YOUR_PUBLIC_IP

docker --version
docker compose version
```

---

## Phase A — App on the VM

```bash
git clone https://github.com/Lakshmiyadav65/captions.git
cd captions
cp docs/env.oracle.example.md .env
nano .env   # paste Neon DATABASE_URL, SARVAM_API_KEY, AUTH_SECRET, APP_URL
```

`APP_URL` for first smoke (no domain yet):

```bash
APP_URL=http://YOUR_PUBLIC_IP:3000
```

Generate secret (on your laptop or the VM):

```bash
openssl rand -hex 32
```

Start stack (local media volume — no R2 required yet):

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.oracle.yml up --build -d
docker compose -f docker-compose.prod.yml -f docker-compose.oracle.yml ps
docker compose -f docker-compose.prod.yml -f docker-compose.oracle.yml logs -f worker
```

Smoke:

1. `curl -s http://YOUR_PUBLIC_IP:3000/api/health` → `db: ok`, queue bullmq  
2. Open `http://YOUR_PUBLIC_IP:3000`  
3. Upload a **short** Telugu clip (< ~3 min) → job reaches `done`  
4. Confirm worker logs: `worker.listening`, then `job.done`

---

## Phase B — Domain + HTTPS + Google auth

1. DNS: `A` record `captions.yourdomain.com` → VM public IP  
2. Security list: open **80** and **443**  
3. In `.env`:
   ```bash
   APP_DOMAIN=captions.yourdomain.com
   APP_URL=https://captions.yourdomain.com
   AUTH_ENABLED=true
   AUTH_DEV_LOGIN=false
   STRICT_PROD_AUTH=true
   AUTH_GOOGLE_ID=...
   AUTH_GOOGLE_SECRET=...
   AUTH_SECRET=...   # strong
   ```
4. Google OAuth redirect: `https://captions.yourdomain.com/api/auth/callback/google`
5. Start with TLS profile (Caddy):
   ```bash
   docker compose -f docker-compose.prod.yml -f docker-compose.oracle.yml --profile tls up -d
   ```
6. Prefer hitting **port 443** only in public; you can stop publishing `3000` later by adjusting the app port publish.

---

## Phase C — Cloudflare R2 (durable video storage)

Local Docker volume is fine for early demos; for production retention use R2.

1. Create R2 bucket + API token  
2. In `.env` set `STORAGE_DRIVER=s3` and all `S3_*` from [env.production.example.md](./env.production.example.md)  
3. Recreate app + worker:
   ```bash
   docker compose -f docker-compose.prod.yml -f docker-compose.oracle.yml up -d --force-recreate app worker
   ```

---

## Phase D — Cut over

1. Point creators at the Oracle HTTPS URL (not Vercel) for real uploads  
2. Keep Vercel as marketing/demo if useful  
3. Confirm Sentry + quotas  
4. Razorpay when plan tiers are decided  

---

## Ops cheat sheet

```bash
cd ~/captions
docker compose -f docker-compose.prod.yml -f docker-compose.oracle.yml logs -f app worker
docker compose -f docker-compose.prod.yml -f docker-compose.oracle.yml restart worker
docker compose -f docker-compose.prod.yml -f docker-compose.oracle.yml pull   # if using images
git pull && docker compose -f docker-compose.prod.yml -f docker-compose.oracle.yml up --build -d
```

Update Ubuntu monthly:

```bash
sudo apt-get update && sudo apt-get upgrade -y
```

---

## What not to do

| Avoid | Why |
|-------|-----|
| MongoDB / Firestore as main DB | App is Prisma + Postgres |
| Only Vercel for magazine traffic | No durable ffmpeg/ASR worker |
| Railway volume as only video store | Prefer R2; local volume OK only on single VM early |
| Skipping Redis | Need `QUEUE_DRIVER=bullmq` for real prod |

---

## Your next message

When the VM exists, send:

1. Public IP (or domain)  
2. Confirm SSH works  
3. Confirm Docker + Compose installed  

Then we’ll fill `.env` together and bring the stack up.
