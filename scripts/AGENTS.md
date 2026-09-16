# Scripts agent guide

## Purpose

This folder contains local Docker lifecycle helpers for the MVP.

## Current scripts

- start.sh / start.ps1 / start.cmd
- stop.sh / stop.ps1 / stop.cmd
- status.sh / status.ps1 / status.cmd

## Behavior

- start: builds image pm-mvp:local and runs container pm-mvp on localhost:8000.
- stop: removes container pm-mvp if present.
- status: reports container running state and queries /api/health when possible.

## Configuration

- Optional env var PM_MVP_PORT overrides host port mapping and health URL port.

## Notes

- Keep scripts simple and idempotent.
- PowerShell scripts fail fast on Docker command errors.
