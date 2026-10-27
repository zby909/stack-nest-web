FROM node:24-alpine AS builder

WORKDIR /src
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . ./
ARG VERSION=dev
ARG REVISION=unknown
RUN STACKNEST_BUILD_VERSION="$VERSION" STACKNEST_BUILD_REVISION="$REVISION" pnpm build

FROM nginx:1.29-alpine

RUN rm /etc/nginx/conf.d/default.conf
COPY --from=builder /src/dist/ /usr/share/nginx/html/
COPY LICENSE NOTICE /usr/share/licenses/stacknest/
LABEL org.opencontainers.image.licenses="Apache-2.0"

EXPOSE 80
