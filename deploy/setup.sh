#!/usr/bin/env bash
# Lobby bootstrap: checks Docker, writes deploy/.env with strong random secrets, and tells you
# exactly what to run next. Safe to run again: it never overwrites deploy/.env without --force,
# and with --force it keeps your existing secrets.
#
#   ./deploy/setup.sh                                   ask a few questions
#   ./deploy/setup.sh --demo                            demo company on http://localhost:4100
#   ./deploy/setup.sh --blank --url https://lobby.example.com
#   ./deploy/setup.sh --force ...                       rewrite deploy/.env (secrets are kept)
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$HERE/.env"
EXAMPLE_FILE="$HERE/.env.example"
MIN_COMPOSE="2.24.0"
DEMO_URL="http://localhost:4100"

mode=""
url=""
force=0
assume_yes=0

say() { printf '%s\n' "$*"; }
warn() { printf 'Warning: %s\n' "$*" >&2; }
die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage: deploy/setup.sh [--demo | --blank] [--url URL] [--force] [--yes]

  --demo        Install the demo company (Northwind Labs) with its own identity provider.
                Runs on http://localhost:4100 on this computer.
  --blank       Install an empty Lobby and connect your own identity provider in the wizard.
  --url URL     The address people will use, e.g. https://lobby.example.com
                (default http://localhost:4100).
  --force       Rewrite deploy/.env even if it exists. Existing secrets are kept.
  --yes         Do not ask questions; use the flags and defaults.
  -h, --help    Show this help.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --demo) mode="demo" ;;
    --blank) mode="blank" ;;
    --url)
      [ $# -ge 2 ] || die "--url needs a value, e.g. --url https://lobby.example.com"
      url="$2"
      shift
      ;;
    --url=*) url="${1#--url=}" ;;
    --force) force=1 ;;
    -y | --yes) assume_yes=1 ;;
    -h | --help)
      usage
      exit 0
      ;;
    *) die "unknown option: $1 (see --help)" ;;
  esac
  shift
done

interactive=0
if [ "$assume_yes" -eq 0 ] && [ -t 0 ]; then interactive=1; fi

ask() {
  # ask "Question" "default" -> prints the answer (or the default)
  local answer=""
  if [ "$interactive" -eq 1 ]; then
    printf '%s [%s]: ' "$1" "$2" >&2
    IFS= read -r answer || answer=""
  fi
  printf '%s' "${answer:-$2}"
}

# --- 1. Docker and Compose ----------------------------------------------------------------------

version_ge() {
  # version_ge A B: true when version A >= version B (numeric, dot separated)
  local IFS=.
  # shellcheck disable=SC2206 # splitting on dots is the point
  local a=($1) b=($2)
  local i
  for i in 0 1 2; do
    local x="${a[$i]:-0}" y="${b[$i]:-0}"
    x="${x%%[!0-9]*}"
    y="${y%%[!0-9]*}"
    if [ "${x:-0}" -gt "${y:-0}" ]; then return 0; fi
    if [ "${x:-0}" -lt "${y:-0}" ]; then return 1; fi
  done
  return 0
}

say "Checking Docker..."
command -v docker >/dev/null 2>&1 || die "Docker is not installed. Install Docker Engine (Linux) or Docker Desktop (Mac, Windows) first: https://docs.docker.com/get-docker/"
compose_version="$(docker compose version --short 2>/dev/null || true)"
[ -n "$compose_version" ] || die "Docker Compose v2 is not available. Install the Compose plugin: https://docs.docker.com/compose/install/"
compose_version="${compose_version#v}"
version_ge "$compose_version" "$MIN_COMPOSE" || die "Docker Compose $compose_version is too old. Lobby needs $MIN_COMPOSE or newer."
if server_version="$(docker version --format '{{.Server.Version}}' 2>/dev/null)"; then
  say "  Docker $server_version, Compose $compose_version"
else
  warn "Docker is installed but the Docker daemon is not answering. Start Docker before running compose."
  say "  Compose $compose_version"
fi

# --- 2. Existing configuration ------------------------------------------------------------------

[ -f "$EXAMPLE_FILE" ] || die "missing $EXAMPLE_FILE; run this script from a complete Lobby checkout."

print_next_steps() {
  local env_url="$1" env_profiles="$2"
  say ""
  say "Next steps:"
  say ""
  say "  1. Start Lobby (the first run builds the images, which takes a few minutes):"
  say "       cd \"$HERE\" && docker compose up -d"
  say ""
  say "  2. Wait until every service reports healthy or exited (0):"
  say "       docker compose ps"
  say ""
  case ",$env_profiles," in
    *,demo-seed,*)
      say "  3. Open $env_url and sign in with the demo identity provider:"
      say "       maya.chen / northwind      (engineer)"
      say "       alex.morgan / northwind    (Head of IT, admin)"
      say "     The guided tour is in docs/demo.md."
      ;;
    *)
      say "  3. Open $env_url to start the setup wizard."
      say "     The first person to finish its first step becomes the administrator,"
      say "     so do this straight away."
      ;;
  esac
  say ""
  say "  Logs, if anything looks wrong:  docker compose logs -f web worker"
}

read_env_value() {
  # read_env_value FILE KEY -> prints the value of KEY in FILE, or nothing
  local file="$1" key="$2"
  [ -f "$file" ] || return 0
  sed -n "s/^${key}=//p" "$file" | tail -n 1
}

if [ -f "$ENV_FILE" ] && [ "$force" -eq 0 ]; then
  say ""
  say "deploy/.env already exists, so I left it alone. Use --force to rewrite it (your secrets are kept)."
  print_next_steps "$(read_env_value "$ENV_FILE" LOBBY_URL)" "$(read_env_value "$ENV_FILE" COMPOSE_PROFILES)"
  exit 0
fi

# --- 3. Questions ------------------------------------------------------------------------------

if [ -z "$mode" ]; then
  say ""
  say "Lobby can start with a demo company (Northwind Labs, with its own sign-in and sample"
  say "people, pages and tickets) or blank, ready to connect your own identity provider."
  while :; do
    answer="$(ask "Demo company or blank install? (demo/blank)" "blank")"
    case "$answer" in
      demo | d) mode="demo" && break ;;
      blank | b) mode="blank" && break ;;
      *) say "Please type demo or blank." ;;
    esac
  done
fi

if [ -z "$url" ]; then
  if [ "$mode" = "demo" ]; then
    url="$DEMO_URL"
  else
    url="$(ask "Public address of Lobby (https://lobby.example.com, or $DEMO_URL to try it locally)" "$DEMO_URL")"
  fi
fi
url="${url%/}"

# --- 4. Work out the address -------------------------------------------------------------------

case "$url" in
  http://* | https://*) ;;
  *) die "the address must start with http:// or https:// (got: $url)" ;;
esac
scheme="${url%%://*}"
rest="${url#*://}"
case "$rest" in */*) die "the address must not contain a path (got: $url)" ;; esac
host="${rest%%:*}"
port=""
case "$rest" in *:*) port="${rest##*:}" ;; esac
[ -n "$host" ] || die "could not read a host name from $url"
case "$port" in "" | *[!0-9]*) [ -z "$port" ] || die "invalid port in $url" ;; esac

if [ "$mode" = "demo" ] && [ "$url" != "$DEMO_URL" ]; then
  die "the demo identity provider only knows $DEMO_URL, so the demo must run there. Use --blank for a real address."
fi

case "$host" in
  localhost | 127.0.0.1)
    # Local: plain HTTP on this computer only.
    [ "$scheme" = "http" ] || die "use http:// for a local address (Caddy cannot get a public certificate for $host)"
    site_address=":80"
    bind_address="127.0.0.1"
    http_port="${port:-80}"
    https_port="4443"
    ;;
  *)
    bind_address="0.0.0.0"
    if [ "$scheme" = "https" ]; then
      [ -z "$port" ] || [ "$port" = "443" ] || die "an https address must use the standard port 443 (got $port)"
      site_address="$host"
      http_port="80"
      https_port="443"
    else
      warn "$url is plain HTTP on a network address. Use this only behind another proxy that adds HTTPS."
      site_address="http://$host"
      http_port="${port:-80}"
      https_port="443"
      [ "$http_port" = "80" ] || die "a plain http address on a network host must use port 80 (got $http_port)"
    fi
    ;;
esac

if [ "$mode" = "demo" ]; then
  profiles="app,demo-idp,demo-apps,demo-seed"
  smtp_url="smtp://mailpit:1025"
  mail_from="Northwind Lobby <lobby@northwind.example>"
else
  profiles="app"
  smtp_url=""
  mail_from="Lobby <lobby@${host}>"
fi

# --- 5. Secrets (kept from an existing .env when rewriting) -------------------------------------

random_hex() {
  # random_hex BYTES -> 2*BYTES hex characters from a cryptographic source
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex "$1"
  else
    od -An -N"$1" -tx1 /dev/urandom | tr -d ' \n'
  fi
}

existing_or_new() {
  local value
  value="$(read_env_value "$ENV_FILE" "$1")"
  if [ -n "$value" ]; then printf '%s' "$value"; else random_hex "$2"; fi
}

lobby_secret="$(existing_or_new LOBBY_SECRET 32)"
postgres_password="$(existing_or_new POSTGRES_PASSWORD 24)"
keycloak_password="$(existing_or_new KEYCLOAK_ADMIN_PASSWORD 16)"
setup_token="$(existing_or_new LOBBY_SETUP_TOKEN 12)"
[ "${#lobby_secret}" -ge 32 ] || die "could not generate LOBBY_SECRET"

# --- 6. Write deploy/.env ----------------------------------------------------------------------

value_for() {
  # Prints the value setup.sh manages for a key; returns 1 for keys it leaves as in the example.
  case "$1" in
    COMPOSE_PROFILES) printf '%s' "$profiles" ;;
    LOBBY_URL) printf '%s' "$url" ;;
    LOBBY_SITE_ADDRESS) printf '%s' "$site_address" ;;
    LOBBY_BIND_ADDRESS) printf '%s' "$bind_address" ;;
    LOBBY_HTTP_PORT) printf '%s' "$http_port" ;;
    LOBBY_HTTPS_PORT) printf '%s' "$https_port" ;;
    LOBBY_SECRET) printf '%s' "$lobby_secret" ;;
    POSTGRES_PASSWORD) printf '%s' "$postgres_password" ;;
    KEYCLOAK_ADMIN_PASSWORD) printf '%s' "$keycloak_password" ;;
    LOBBY_SETUP_TOKEN) printf '%s' "$setup_token" ;;
    SMTP_URL) printf '%s' "$smtp_url" ;;
    MAIL_FROM) printf '%s' "$mail_from" ;;
    *) return 1 ;;
  esac
}

tmp_file="$(mktemp "$HERE/.env.XXXXXX")"
trap 'rm -f "$tmp_file"' EXIT
chmod 600 "$tmp_file"

while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    [A-Z]*=*)
      key="${line%%=*}"
      if value="$(value_for "$key")"; then
        printf '%s=%s\n' "$key" "$value"
      else
        # Keys setup.sh does not manage: keep a value you set before, else the example's.
        old="$(read_env_value "$ENV_FILE" "$key")"
        if [ -n "$old" ]; then printf '%s=%s\n' "$key" "$old"; else printf '%s\n' "$line"; fi
      fi
      ;;
    *) printf '%s\n' "$line" ;;
  esac
done <"$EXAMPLE_FILE" >"$tmp_file"

backup_file=""
if [ -f "$ENV_FILE" ]; then
  backup_file="$ENV_FILE.backup-$(date +%Y%m%d-%H%M%S)"
  cp -p "$ENV_FILE" "$backup_file"
  say "Saved your previous settings to $backup_file"
fi
mv "$tmp_file" "$ENV_FILE"
trap - EXIT

say ""
say "Wrote deploy/.env for a $mode install at $url"
if [ -n "$(read_env_value "$backup_file" LOBBY_SECRET)" ]; then
  say "  Your existing LOBBY_SECRET, POSTGRES_PASSWORD and KEYCLOAK_ADMIN_PASSWORD were kept."
else
  say "  Generated strong random values for LOBBY_SECRET, POSTGRES_PASSWORD and KEYCLOAK_ADMIN_PASSWORD."
fi
say "  Keep a copy of deploy/.env somewhere safe: without LOBBY_SECRET, stored secrets cannot be read."
say "  Setup token for the first-run wizard (asked for when Lobby is not on localhost): $setup_token"
if [ "$bind_address" = "0.0.0.0" ] && [ "$scheme" = "https" ]; then
  say ""
  say "Before you start: point DNS for $host at this machine and open ports 80 and 443."
  say "Caddy fetches the HTTPS certificate on first start and renews it on its own."
fi
print_next_steps "$url" "$profiles"
