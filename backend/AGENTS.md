# Backend agent guide

## Purpose

Backend is a FastAPI service for the Project Management MVP.

## Current Part 2 scope

- Serves GET /api/health for container health checks.
- Serves GET / with simple hello world HTML to verify routing and API reachability.
- Runs in Docker and installs Python dependencies with uv.

## Layout

- app/main.py: FastAPI app and routes.
- requirements.txt: backend dependencies.

## Notes

- Keep backend implementation simple and MVP-focused.
- Future parts will add static frontend serving, auth, persistence, and AI endpoints.
