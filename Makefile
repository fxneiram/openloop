# openloop — developer Makefile
# Thin wrappers around the existing bun/turbo scripts so common tasks
# don't require remembering package paths. Run `make help` for the list.
#
# Prerequisites: bun (see package.json "packageManager") and turbo (installed
# as a dev dependency; available via `bun turbo` after `make install`).

# Use bash for recipes. Set PATH so bun is found by scripts spawned by
# `bun run` even when the login shell is zsh and bash doesn't source ~/.zshrc.
SHELL := /bin/bash
BUN := $(HOME)/.bun/bin/bun
export PATH := $(HOME)/.bun/bin:$(PATH)

# Default target: show help.
.DEFAULT_GOAL := help

.PHONY: help check-bun install run run-desktop build build-cli build-desktop test typecheck lint clean

help: ## Show this help
	@echo "openloop — available targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

# Fail early with a helpful message if bun is missing.
check-bun:
	@test -x "$(BUN)" || { \
		echo "error: 'bun' not found at $(BUN)."; \
		echo "Install it with: curl -fsSL https://bun.sh/install | bash"; \
		exit 1; \
	}

install: check-bun ## Install dependencies (bun install)
	$(BUN) install

run: check-bun ## Run the CLI in dev mode
	$(BUN) run dev

run-desktop: check-bun ## Run the desktop app (Electron) in dev mode
	$(BUN) run dev:desktop

build: check-bun ## Build the whole monorepo
	$(BUN) turbo build

build-cli: check-bun ## Build only the CLI
	$(BUN) run --cwd packages/opencode build

build-desktop: check-bun ## Package the desktop app
	$(BUN) --cwd packages/desktop package

test: check-bun ## Run tests (via turbo; root `bun test` is intentionally disabled)
	$(BUN) turbo test

typecheck: check-bun ## Type-check the monorepo
	$(BUN) turbo typecheck

lint: check-bun ## Run the linter (oxlint)
	$(BUN) run lint

clean: ## Remove build artifacts and turbo cache
	rm -rf packages/*/dist packages/desktop/out .turbo packages/*/.turbo
