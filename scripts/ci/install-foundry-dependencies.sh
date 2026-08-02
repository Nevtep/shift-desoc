#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

TEMP_DIRS=()
cleanup() {
  if [[ ${#TEMP_DIRS[@]} -eq 0 ]]; then
    return
  fi

  for dir in "${TEMP_DIRS[@]}"; do
    if [[ -n "$dir" ]]; then
      rm -rf "$dir"
    fi
  done
}
trap cleanup EXIT

verify_dep_files() {
  if [[ ! -f lib/forge-std/src/Test.sol ]]; then
    echo "ERROR: missing lib/forge-std/src/Test.sol after Foundry dependency bootstrap." >&2
    exit 1
  fi

  if [[ ! -f lib/openzeppelin-contracts/contracts/access/manager/AccessManager.sol ]]; then
    echo "ERROR: missing lib/openzeppelin-contracts/contracts/access/manager/AccessManager.sol after Foundry dependency bootstrap." >&2
    exit 1
  fi
}

install_or_verify_dep() {
  local target="$1"
  local repo="$2"
  local commit="$3"

  if [[ -e "$target" ]]; then
    if [[ ! -d "$target/.git" ]]; then
      echo "ERROR: $target exists but is not a git repository. Refusing to mutate it." >&2
      exit 1
    fi

    local actual_remote
    actual_remote="$(git -C "$target" config --get remote.origin.url || true)"
    if [[ "$actual_remote" != "$repo" ]]; then
      echo "ERROR: $target remote.origin.url is $actual_remote, expected $repo. Refusing to mutate it." >&2
      exit 1
    fi

    local actual_commit
    actual_commit="$(git -C "$target" rev-parse HEAD)"
    if [[ "$actual_commit" != "$commit" ]]; then
      echo "ERROR: $target is at $actual_commit, expected $commit. Refusing to mutate it." >&2
      exit 1
    fi
    return
  fi

  mkdir -p "$(dirname "$target")"

  local tmp_target
  tmp_target="$(mktemp -d "$(dirname "$target")/.bootstrap.$(basename "$target").XXXXXX")"
  TEMP_DIRS+=("$tmp_target")

  git clone --no-checkout "$repo" "$tmp_target"
  git -C "$tmp_target" checkout --detach "$commit"

  mv "$tmp_target" "$target"
  tmp_target=""
}

install_or_verify_dep \
  "lib/forge-std" \
  "https://github.com/foundry-rs/forge-std.git" \
  "bf647bd6046f2f7da30d0c2bf435e5c76a780c1b"

install_or_verify_dep \
  "lib/openzeppelin-contracts" \
  "https://github.com/OpenZeppelin/openzeppelin-contracts.git" \
  "c64a1edb67b6e3f4a15cca8909c9482ad33a02b0"

verify_dep_files
