#!/usr/bin/env bash
#
# Prepara Ubuntu 24.04 per il solo controller observe. Eseguire come root.
# Non riceve, legge o installa private key blockchain.
#
set -Eeuo pipefail
IFS=$'\n\t'

readonly NODE_VERSION="22.23.1"
readonly NODE_ARCHIVE="node-v${NODE_VERSION}-linux-x64.tar.xz"
readonly NODE_BASE_URL="https://nodejs.org/dist/v${NODE_VERSION}"
readonly SERVICE_USER="vaultops"
readonly INSTALL_ROOT="/opt/vault-automation"
readonly REPOSITORY_DIR="${INSTALL_ROOT}/TestSmartContract"
readonly REPOSITORY_URL="https://github.com/Poppo753/TestPOC.git"
readonly REPOSITORY_BRANCH="dev-26"
readonly ENVIRONMENT_DIR="/etc/vault-automation"
readonly SERVICE_NAME="vault-automation-observe.service"

if [[ "${EUID}" -ne 0 ]]; then
  echo "ERROR: eseguire come root." >&2
  exit 1
fi

source /etc/os-release
if [[ "${ID:-}" != "ubuntu" || "${VERSION_ID:-}" != "24.04" ]]; then
  echo "ERROR: atteso Ubuntu 24.04; trovato ${PRETTY_NAME:-unknown}." >&2
  exit 1
fi
if [[ "$(dpkg --print-architecture)" != "amd64" ]]; then
  echo "ERROR: attesa architettura amd64/x86." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get upgrade -y
apt-get install -y --no-install-recommends ca-certificates curl git xz-utils build-essential jq
timedatectl set-ntp true

temporary_directory="$(mktemp -d)"
trap 'rm -rf "${temporary_directory}"' EXIT
curl --fail --silent --show-error --location "${NODE_BASE_URL}/${NODE_ARCHIVE}" --output "${temporary_directory}/${NODE_ARCHIVE}"
curl --fail --silent --show-error --location "${NODE_BASE_URL}/SHASUMS256.txt" --output "${temporary_directory}/SHASUMS256.txt"
(
  cd "${temporary_directory}"
  grep "  ${NODE_ARCHIVE}$" SHASUMS256.txt | sha256sum --check --strict
)
tar --extract --xz --file "${temporary_directory}/${NODE_ARCHIVE}" --directory /usr/local --strip-components=1
node --version
npm --version

if ! id "${SERVICE_USER}" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "${SERVICE_USER}"
fi

install --directory --owner="${SERVICE_USER}" --group="${SERVICE_USER}" --mode=0750 "${INSTALL_ROOT}"
if [[ -e "${REPOSITORY_DIR}" ]]; then
  echo "ERROR: ${REPOSITORY_DIR} esiste già; il bootstrap non sovrascrive installazioni." >&2
  exit 1
fi

runuser --user "${SERVICE_USER}" -- git clone --branch "${REPOSITORY_BRANCH}" --single-branch "${REPOSITORY_URL}" "${REPOSITORY_DIR}"
runuser --user "${SERVICE_USER}" -- bash -lc "cd '${REPOSITORY_DIR}' && npm ci"
install --directory --owner="${SERVICE_USER}" --group="${SERVICE_USER}" --mode=0750 "${REPOSITORY_DIR}/.automation-state"
install --directory --owner=root --group="${SERVICE_USER}" --mode=0750 "${ENVIRONMENT_DIR}"
install --owner=root --group=root --mode=0644 "${REPOSITORY_DIR}/ops/systemd/${SERVICE_NAME}" "/etc/systemd/system/${SERVICE_NAME}"
systemctl daemon-reload

echo "Bootstrap completato."
echo "Commit installato: $(git -C "${REPOSITORY_DIR}" rev-parse HEAD)"
echo "Il servizio NON è stato avviato: prima installare il file RPC, eseguire test e preflight."
