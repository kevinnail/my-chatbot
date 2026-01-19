name: Jest Tests

on:
push:
branches: - main # Runs only when pushing to main
pull_request:
branches: - main # Runs only when a PR is created or updated targeting main

jobs:
build:
runs-on: ubuntu-latest
services:
postgres:
image: ankane/pgvector
env:
POSTGRES_USER: knail
POSTGRES_PASSWORD: knail
POSTGRES_DB: chatbot_test
steps: - uses: actions/checkout@v4

      - name: Use Node.js (pinned)
        uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: npm
          cache-dependency-path: |
            package-lock.json
            server/package-lock.json

      - name: Show tool versions
        run: |
          node --version
          npm --version

      - name: Install root dependencies
        run: npm ci

      - name: Install server dependencies
        run: npm ci
        working-directory: ./server

      - name: Lint server (no fix)
        run: npx eslint ./server --max-warnings 10

      - name: Run server tests
        run: npm test -- -u
        working-directory: ./server
        env:
          CI: true
          NODE_OPTIONS: --experimental-vm-modules
          DATABASE_URL: postgres://knail:knail@postgres:5432/knail
          PG_USER: knail
          PG_HOST: postgres
          PG_PASSWORD: knail
          PG_PORT: 5432
          JWT_SECRET: test-jwt-secret-for-testing-only
          COOKIE_NAME: test-session-cookie
          SALT_ROUNDS: 10
          SECURE_COOKIES: false
          ENCRYPTION_KEY: test-encryption-key-for-testing-only
