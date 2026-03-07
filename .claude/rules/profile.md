# Profile

## Purpose

Stable facts about this workspace and project.

## Workspace

- Root workspace: `/Users/yuri_baker/dev`
- This root currently holds the shared `api-middleware` package plus top-level project docs.

## Project

- Project: Olive & Ivory Gifts
- Brand: premium Australian gifting brand
- Location context: Canberra, Australia

## Repos

- `api-middleware`
  - local path: `/Users/yuri_baker/dev`
  - shared edge-safe middleware package
- `olive_and_ivory_gifts`
  - local path: `/Users/yuri_baker/dev/olive_and_ivory_gifts`
  - public storefront
- `admin_olive_and_ivory_gifts`
  - local path: `/Users/yuri_baker/dev/admin_olive_and_ivory_gifts`
  - internal admin app
- `olive_and_ivory_api`
  - local path: `/Users/yuri_baker/dev/olive_and_ivory_api`
  - backend API worker

## Platform

- Cloudflare Pages for storefront and admin
- Cloudflare Workers for API
- D1 for relational data
- R2 for media storage

## Important Product Facts

- Collections can contain zero or more gifts.
- Storefront visibility rules are separate from admin CRUD validity.
- The API worker is the single writer for core business data.

## Update Triggers

- Add or remove repos
- Platform changes
- Business rules that affect all future work

